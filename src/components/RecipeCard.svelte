<script lang="ts">
	import { CachedMetadata, Component, Platform, TFile } from "obsidian";
	import RecipeCardTitleBlock from "./RecipeCardTitleBlock.svelte";
	import RecipeViewPlugin from "../main";
	import store from "../store";
	import ScaleSelector from "./ScaleSelector.svelte";
	import Fraction from "fraction.js";
	import RecipeCardSplitSteps from "./RecipeCardSplitSteps.svelte";
	import { ParsedRecipe, parseFrontmatterTimeMinutes } from "../parsing";

	import { get } from "svelte/store";

	let plugin: RecipeViewPlugin = get(store.plugin);
	store.plugin.subscribe((p) => (plugin = p));

	// Props to be passed in
	export let parsedRecipe: ParsedRecipe;
	export let metadata: CachedMetadata | undefined;
	export let file: TFile;
	export let view: Component;

	function extractBaseServings(
		fm: Record<string, unknown> | undefined,
		propName: string
	): number {
		if (!fm) return 1;
		const key = (propName || "servings").trim() || "servings";
		const raw = fm[key] ?? fm["servings"];
		if (typeof raw === "number" && isFinite(raw) && raw > 0) {
			return raw;
		}
		if (typeof raw === "string") {
			const match = raw.match(/(\d+(?:[.,]\d+)?)/);
			if (match) {
				const parsed = parseFloat(match[1].replace(",", "."));
				if (isFinite(parsed) && parsed > 0) {
					return parsed;
				}
			}
		}
		return 1;
	}

	function getCaseInsensitiveFmValue(
		fm: Record<string, unknown> | undefined,
		targetKey: string
	): unknown {
		if (!fm) return undefined;
		const lower = targetKey.toLowerCase();
		for (const [k, v] of Object.entries(fm)) {
			if (k.trim().toLowerCase() === lower) {
				return v;
			}
		}
		return undefined;
	}

	// Titleblock & frontmatter variables
	$: title = parsedRecipe.title ? parsedRecipe.title : file.basename;
	$: frontmatter = metadata?.frontmatter || {};
	$: baseServings = extractBaseServings(
		frontmatter,
		plugin?.settings?.servingsProperty || "servings"
	);

	// Synchronize calculated total_time as a pure numeric integer (minutes) into YAML frontmatter
	let lastSyncedTotalMinutes: number | null = null;
	$: totalTimerMinutes = parsedRecipe?.totalTimerMinutes ?? 0;
	$: rawExtraTime =
		getCaseInsensitiveFmValue(frontmatter, "extra_time") ??
		getCaseInsensitiveFmValue(frontmatter, "prep_time");
	$: extraMinutes = parseFrontmatterTimeMinutes(rawExtraTime);
	$: totalMinutes = Math.round(
		(totalTimerMinutes > 0 ? totalTimerMinutes : 0) + extraMinutes
	);

	$: {
		const fmTotal = getCaseInsensitiveFmValue(frontmatter, "total_time");
		const alreadyMatchesNumeric =
			typeof fmTotal === "number" && fmTotal === totalMinutes;
		if (
			totalMinutes > 0 &&
			!alreadyMatchesNumeric &&
			lastSyncedTotalMinutes !== totalMinutes
		) {
			lastSyncedTotalMinutes = totalMinutes;
			const targetFile =
				file || plugin?.app?.workspace?.getActiveFile?.();
			if (targetFile && plugin?.app?.fileManager?.processFrontMatter) {
				void plugin.app.fileManager.processFrontMatter(
					targetFile,
					(fm) => {
						if (fm["total_time"] !== totalMinutes) {
							fm["total_time"] = totalMinutes;
						}
					}
				);
			}
		}
	}

	// Recipe scaling - initialize with baseServings from frontmatter (default: 1)
	let lastBaseServings: number | null = null;
	let scaleNum: number = extractBaseServings(
		metadata?.frontmatter,
		plugin?.settings?.servingsProperty || "servings"
	);
	$: {
		if (baseServings !== lastBaseServings) {
			lastBaseServings = baseServings;
			scaleNum = baseServings;
		}
	}

	let qtyScale: Fraction = new Fraction(1);
	$: if (qtyScale) {
		parsedRecipe?.qtyScaleStore.set(qtyScale);
	}

	// Determining responsive single-column breakpoint
	let containerWidth: number =
		typeof window !== "undefined" ? window.innerWidth : 800;
	$: isBelowSingleColumnWidth =
		!containerWidth ||
		containerWidth < plugin.settings.singleColumnMaxWidth;

	$: isPhone =
		(typeof Platform !== "undefined" && Boolean(Platform?.isPhone)) ||
		(typeof document !== "undefined" &&
			document.body.classList.contains("is-phone"));

	// On smartphones, always use single-column view.
	// On tablets and desktop, dynamically switch according to container width / settings.
	$: singleColumn = isPhone || isBelowSingleColumnWidth;

	// DOM searching and manipulating keyboard shortcuts
	let container: HTMLDivElement;

	function checkNext(focusOnly: boolean) {
		const nextUnchecked = container.querySelector(
			"input[type=checkbox]:not(:checked)"
		) as HTMLInputElement;
		if (nextUnchecked) {
			if (!focusOnly) nextUnchecked.checked = true;
			nextUnchecked.focus();
		}
	}

	function uncheckPrevious() {
		const checked = container.querySelectorAll(
			"input[type=checkbox]:checked"
		) as NodeListOf<HTMLInputElement>;
		if (checked.length > 0) {
			const lastChecked = checked.item(checked.length - 1);
			lastChecked.checked = false;
			lastChecked.focus();
		}
	}

	function advanceStep(focusOnly: boolean) {
		const steps = container.querySelectorAll(
			"input[type=radio]"
		) as NodeListOf<HTMLInputElement>;
		for (let i = 0; i < steps.length; i++) {
			if (steps.item(i).checked) {
				if (!focusOnly && steps.item(i + 1))
					steps.item(i + 1).checked = true;
				if (focusOnly || steps.item(i + 1))
					steps.item(focusOnly ? i : i + 1).focus();
				return;
			}
		}
		if (!focusOnly) steps.item(0).checked = true;
		steps.item(0).focus();
	}

	function retreatStep() {
		const steps = container.querySelectorAll(
			"input[type=radio]"
		) as NodeListOf<HTMLInputElement>;
		for (let i = 1; i < steps.length; i++) {
			if (steps.item(i).checked) {
				steps.item(i - 1).checked = true;
				steps.item(i - 1).focus();
				return;
			}
		}
	}

	let lastTapTime = 0;
	let lastTapTarget: EventTarget | null = null;

	function handleDblClick(e: MouseEvent) {
		const target = e.target as HTMLElement | null;
		if (target?.closest("input.inline-fm-input, input[type='number']")) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
	}

	function handleTouchEnd(e: TouchEvent) {
		const now = Date.now();
		const target = e.target as HTMLElement | null;
		const isInteractiveControl = Boolean(
			target?.closest(
				"input, button, a, label, .scale-btn, .is-editable, .recipe-ingredient-checkbox"
			)
		);

		if (
			!isInteractiveControl &&
			lastTapTime > 0 &&
			now - lastTapTime < 320 &&
			lastTapTarget === e.target
		) {
			if (e.cancelable) {
				e.preventDefault();
			}
			e.stopPropagation();
			lastTapTime = 0;
			lastTapTarget = null;
			return;
		}

		// Prevent rapid taps (e.g. checking ingredients or tapping +/- stepper) from
		// bubbling up to Obsidian's mobile .markdown-preview-view double-tap-to-edit handler
		if (lastTapTime > 0 && now - lastTapTime < 320) {
			e.stopPropagation();
		}

		lastTapTime = now;
		lastTapTarget = e.target;
	}

	function handleKeypress(e: KeyboardEvent) {
		if (e.key == "n") {
			checkNext(false);
		} else if (e.key == "p") {
			uncheckPrevious();
		} else if (e.key == "j") {
			advanceStep(false);
		} else if (e.key == "k") {
			retreatStep();
		} else if (e.key == "[") {
			const step = baseServings > 1 ? 1 : 0.25;
			if (scaleNum && scaleNum > step) {
				scaleNum = Number((scaleNum - step).toFixed(2));
			} else {
				scaleNum = step;
			}
		} else if (e.key == "]") {
			const step = baseServings > 1 ? 1 : 0.25;
			if (scaleNum) {
				scaleNum = Number((scaleNum + step).toFixed(2));
			} else {
				scaleNum = baseServings + step;
			}
		} else if (e.key == "h") {
			checkNext(true);
		} else if (e.key == "l") {
			advanceStep(true);
		}
	}
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
	class={frontmatter?.cssclasses?.join(" ")}
	class:container={true}
	class:markdown-rendered={true}
	bind:clientWidth={containerWidth}
	bind:this={container}
	on:keypress={handleKeypress}
	on:dblclick={handleDblClick}
	on:touchend={handleTouchEnd}
	role="document"
>
	<RecipeCardSplitSteps
		globalIngredients={parsedRecipe?.globalIngredients || []}
		steps={parsedRecipe?.steps || []}
		sections={parsedRecipe?.sections || []}
		singleColumn={Boolean(singleColumn)}
		description={parsedRecipe?.description ?? ""}
	>
		<ScaleSelector
			slot="scaleselector"
			bind:scale={qtyScale}
			bind:scaleNum
			{baseServings}
		/>

		<RecipeCardTitleBlock
			slot="titleblock"
			{title}
			{frontmatter}
			totalTimerMinutes={parsedRecipe?.totalTimerMinutes ?? 0}
			thumbnailPath={parsedRecipe?.thumbnailPath}
			singleColumn={Boolean(singleColumn)}
			app={plugin.app}
			{file}
			{view}
		/>
	</RecipeCardSplitSteps>
</div>

<style>
	.container {
		position: relative;
		height: auto;
		width: 100% !important;
		max-width: 100% !important;
		box-sizing: border-box;
		align-self: stretch;
		display: block;
		touch-action: pan-x pan-y;
	}

	/* Hide strange mobile frontmatter stuff */
	:global(.recipe-card div:has(> .frontmatter-section)) {
		display: none;
	}
</style>
