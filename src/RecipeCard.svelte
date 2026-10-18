<script lang="ts">
	import { CachedMetadata, Component, TFile } from "obsidian";
	import RecipeCardTitleBlock from "./RecipeCardTitleBlock.svelte";
	import RecipeViewPlugin from "./main";
	import store from "./store";
	import ScaleSelector from "./ScaleSelector.svelte";
	import Fraction from "fraction.js";
	import RecipeCardSplitSteps from "./RecipeCardSplitSteps.svelte";
	import { ParsedRecipe } from "./parsing";

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

	// Titleblock & frontmatter variables
	$: title = parsedRecipe.title ? parsedRecipe.title : file.basename;
	$: frontmatter = metadata?.frontmatter || {};
	$: baseServings = extractBaseServings(
		frontmatter,
		plugin?.settings?.servingsProperty || "servings"
	);

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
	role="document"
>
	<RecipeCardSplitSteps
		globalIngredients={parsedRecipe?.globalIngredients || []}
		steps={parsedRecipe?.steps || []}
		sections={parsedRecipe?.sections || []}
		singleColumn={Boolean(isBelowSingleColumnWidth)}
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
			thumbnailPath={parsedRecipe?.thumbnailPath}
			singleColumn={Boolean(isBelowSingleColumnWidth)}
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
	}

	/* Hide strange mobile frontmatter stuff */
	:global(.recipe-card div:has(> .frontmatter-section)) {
		display: none;
	}
</style>
