<script lang="ts">
	import { App, Component, MarkdownRenderer, TFile, moment } from "obsidian";
	import store from "./store";
	import RecipeViewPlugin from "./main";
	import { formatDuration, parseFrontmatterTimeMinutes } from "./parsing";
	import { TimerTimeFormat } from "./timers";

	export let thumbnailPath: string | undefined;
	export let title: string;
	export let frontmatter: object;
	export let totalTimerMinutes = 0;
	export let singleColumn: boolean;
	export let app: App;
	export let file: TFile;
	export let view: Component;

	let plugin: RecipeViewPlugin;
	store.plugin.subscribe((p) => (plugin = p));

	interface HeaderPropertyItem {
		key: string;
		label: string;
		displayValue: string;
		rawValue: unknown;
		isPlaceholder: boolean;
		isHtml: boolean;
		editable: boolean;
	}

	const EDITABLE_KEYS = new Set(["type", "servings", "extra_time"]);

	let editingKey: string | null = null;
	let editValue = "";

	function focusInput(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	function isGermanLocale(configuredFormat?: string): boolean {
		try {
			const loc =
				(typeof moment !== "undefined" &&
				typeof moment.locale === "function"
					? moment.locale()
					: "") ||
				(typeof window !== "undefined"
					? window.localStorage?.getItem("language") || ""
					: "");
			if (loc) {
				return loc.toLowerCase().startsWith("de");
			}
		} catch (_e) {
			/* ignore */
		}
		return (configuredFormat || "de") === "de";
	}

	function findFrontmatterKey(
		fm: Record<string, unknown>,
		targetKey: string
	): string | undefined {
		const lower = targetKey.trim().toLowerCase();
		for (const k of Object.keys(fm)) {
			if (k.trim().toLowerCase() === lower) {
				return k;
			}
		}
		return undefined;
	}

	function findFrontmatterValue(
		fm: Record<string, unknown>,
		targetKey: string
	): unknown {
		const actualKey = findFrontmatterKey(fm, targetKey);
		return actualKey !== undefined ? fm[actualKey] : undefined;
	}

	function hasNonEmptyValue(val: unknown): boolean {
		if (val == null) return false;
		if (typeof val === "string") return val.trim().length > 0;
		if (Array.isArray(val)) return val.length > 0;
		return true;
	}

	function formatFrontmatterValue(
		key: string,
		value: any
	): string | undefined {
		if (!hasNonEmptyValue(value)) {
			return undefined;
		}

		// See if it's a URL
		try {
			let url = new URL(value);
			return createEl("a", {
				href: url.toString(),
				text: url.host,
			}).outerHTML;
		} catch (e) {
			/* empty */
		}

		// See if it's tags
		if (key.trim().toLowerCase() == "tags" && Array.isArray(value)) {
			return value
				.map((tag: string) => {
					let a = createEl("a", {
						cls: "tag",
						href: "#" + tag,
						text: "#" + tag,
					});
					a.setAttribute("target", "_blank");
					a.setAttribute("rel", "noopener");
					return a.outerHTML;
				})
				.join(" ");
		}

		if (typeof value === "number" || typeof value === "boolean") {
			return String(value);
		}

		if (typeof value === "string" || value instanceof String) {
			const trimmed = value.toString().trim();
			if (!trimmed) {
				return undefined;
			}
			const markdownContainer = createSpan();
			MarkdownRenderer.render(
				app,
				trimmed,
				markdownContainer,
				file.path,
				view
			);
			return markdownContainer.children.item(0)?.innerHTML || trimmed;
		}

		return undefined;
	}

	function startEditing(item: HeaderPropertyItem, e: MouseEvent) {
		if (!item.editable || editingKey === item.key) return;
		e.stopPropagation();

		if (item.key === "servings") {
			editValue =
				rawServings != null && String(rawServings).trim() !== ""
					? String(rawServings).trim()
					: "1";
		} else if (item.key === "extra_time") {
			editValue =
				rawExtra != null && String(rawExtra).trim() !== ""
					? String(rawExtra).trim()
					: "";
		} else if (item.key === "type") {
			editValue =
				rawType != null && String(rawType).trim() !== ""
					? String(rawType).trim()
					: "";
		} else {
			editValue = item.isPlaceholder ? "" : item.displayValue;
		}

		editingKey = item.key;
	}

	function cancelEdit() {
		editingKey = null;
		editValue = "";
	}

	async function commitEdit(key: string) {
		if (editingKey !== key) return;
		const trimmed = editValue.trim();
		editingKey = null;

		let targetFmKey: string;
		if (key === "servings") {
			const defaultServingsKey =
				(plugin?.settings?.servingsProperty || "servings").trim() ||
				"servings";
			targetFmKey =
				findFrontmatterKey(fmRecord, defaultServingsKey) ||
				findFrontmatterKey(fmRecord, "servings") ||
				defaultServingsKey;
		} else if (key === "extra_time") {
			targetFmKey =
				findFrontmatterKey(fmRecord, "extra_time") ||
				findFrontmatterKey(fmRecord, "prep_time") ||
				"prep_time";
		} else {
			targetFmKey = findFrontmatterKey(fmRecord, key) || key;
		}

		// Optimistic local update so UI and total_time react immediately
		const updatedFm = { ...fmRecord };
		if (trimmed === "" && key !== "servings") {
			delete updatedFm[targetFmKey];
			if (key === "extra_time") {
				const altExtraKey = findFrontmatterKey(updatedFm, "extra_time");
				const altPrepKey = findFrontmatterKey(updatedFm, "prep_time");
				if (altExtraKey) delete updatedFm[altExtraKey];
				if (altPrepKey) delete updatedFm[altPrepKey];
				const newTotal = Math.round(
					totalTimerMinutes > 0 ? totalTimerMinutes : 0
				);
				if (newTotal > 0) {
					updatedFm["total_time"] = newTotal;
				} else {
					delete updatedFm["total_time"];
				}
			}
		} else if (key === "servings") {
			const parsedNum = parseFloat(trimmed.replace(",", "."));
			updatedFm[targetFmKey] =
				/^\d+(?:[.,]\d+)?$/.test(trimmed) &&
				isFinite(parsedNum) &&
				parsedNum > 0
					? parsedNum
					: trimmed || 1;
		} else if (key === "extra_time") {
			const newExtraMins = parseFrontmatterTimeMinutes(trimmed);
			updatedFm[targetFmKey] =
				/^\d+(?:[.,]\d+)?$/.test(trimmed) && newExtraMins > 0
					? Math.round(newExtraMins)
					: trimmed;
			const newTotal = Math.round(
				(totalTimerMinutes > 0 ? totalTimerMinutes : 0) + newExtraMins
			);
			if (newTotal > 0) {
				updatedFm["total_time"] = newTotal;
			}
		} else {
			updatedFm[targetFmKey] = trimmed;
		}
		frontmatter = updatedFm;

		// Persist to file frontmatter via Obsidian's official API
		const targetFile = file || app?.workspace?.getActiveFile?.();
		if (targetFile && app?.fileManager?.processFrontMatter) {
			await app.fileManager.processFrontMatter(targetFile, (fm) => {
				if (trimmed === "" && key !== "servings") {
					delete fm[targetFmKey];
					if (key === "extra_time") {
						const altExtraKey = findFrontmatterKey(fm, "extra_time");
						const altPrepKey = findFrontmatterKey(fm, "prep_time");
						if (altExtraKey) delete fm[altExtraKey];
						if (altPrepKey) delete fm[altPrepKey];
						const newTotal = Math.round(
							totalTimerMinutes > 0 ? totalTimerMinutes : 0
						);
						if (newTotal > 0) {
							fm["total_time"] = newTotal;
						} else {
							delete fm["total_time"];
						}
					}
				} else if (key === "servings") {
					const parsedNum = parseFloat(trimmed.replace(",", "."));
					fm[targetFmKey] =
						/^\d+(?:[.,]\d+)?$/.test(trimmed) &&
						isFinite(parsedNum) &&
						parsedNum > 0
							? parsedNum
							: trimmed || 1;
				} else if (key === "extra_time") {
					const newExtraMins = parseFrontmatterTimeMinutes(trimmed);
					fm[targetFmKey] =
						/^\d+(?:[.,]\d+)?$/.test(trimmed) && newExtraMins > 0
							? Math.round(newExtraMins)
							: trimmed;
					const newTotal = Math.round(
						(totalTimerMinutes > 0 ? totalTimerMinutes : 0) +
							newExtraMins
					);
					if (newTotal > 0) {
						fm["total_time"] = newTotal;
					}
				} else {
					fm[targetFmKey] = trimmed;
				}
			});
		}
	}

	function handleEditKeydown(e: KeyboardEvent, key: string) {
		e.stopPropagation();
		if (e.key === "Enter") {
			e.preventDefault();
			commitEdit(key);
		} else if (e.key === "Escape") {
			e.preventDefault();
			cancelEdit();
		}
	}

	$: fmRecord = (frontmatter || {}) as Record<string, unknown>;
	$: configuredTimeFormat = plugin?.settings?.timerTimeFormat || "de";
	$: isDe = isGermanLocale(configuredTimeFormat);
	$: timeFormat = (
		configuredTimeFormat === "compact" || configuredTimeFormat === "minutes"
			? configuredTimeFormat
			: isDe
			? "de"
			: "en"
	) as TimerTimeFormat;

	$: coverKey = (
		(plugin?.settings?.coverProperty || "cover").trim() || "cover"
	).toLowerCase();
	$: servingsKey = (
		(plugin?.settings?.servingsProperty || "servings").trim() || "servings"
	).toLowerCase();

	$: rawType = findFrontmatterValue(fmRecord, "type");
	$: rawServings =
		findFrontmatterValue(fmRecord, servingsKey) ??
		findFrontmatterValue(fmRecord, "servings");
	$: rawExtra =
		findFrontmatterValue(fmRecord, "extra_time") ??
		findFrontmatterValue(fmRecord, "prep_time");

	$: timerMinutes = totalTimerMinutes > 0 ? totalTimerMinutes : 0;
	$: extraMinutes = parseFrontmatterTimeMinutes(rawExtra);
	$: totalMinutes = Math.round(timerMinutes + extraMinutes);

	$: formattedType = formatFrontmatterValue("type", rawType);
	$: formattedServings = formatFrontmatterValue("servings", rawServings);

	$: timerDisplay =
		timerMinutes > 0 ? formatDuration(timerMinutes, timeFormat) : "";

	$: extraDisplay =
		extraMinutes > 0
			? formatDuration(extraMinutes, timeFormat)
			: typeof rawExtra === "string" && rawExtra.trim()
			? rawExtra.trim()
			: "";

	$: totalDisplay =
		totalMinutes > 0 ? formatDuration(totalMinutes, timeFormat) : "";

	// Row 1: Base properties (type + servings with default 1 + dynamic extra properties)
	$: baseStandardProperties = [
		{
			key: "type",
			label: "type",
			displayValue: formattedType || "—",
			rawValue: rawType ?? "—",
			isPlaceholder: !formattedType,
			isHtml: Boolean(formattedType),
			editable: EDITABLE_KEYS.has("type"),
		},
		{
			key: "servings",
			label: "servings",
			displayValue: formattedServings || "1",
			rawValue: rawServings ?? 1,
			isPlaceholder: false,
			isHtml: Boolean(formattedServings),
			editable: EDITABLE_KEYS.has("servings"),
		},
	] as Array<HeaderPropertyItem>;

	$: reservedKeys = new Set([
		coverKey,
		servingsKey,
		"position",
		"cssclasses",
		"cssclass",
		"type",
		"servings",
		"extra_time",
		"prep_time",
		"cook_time",
		"rest_time",
		"total_time",
		"total_timer",
	]);

	$: extraProperties = Object.entries(fmRecord)
		.filter(([key]) => !reservedKeys.has(key.trim().toLowerCase()))
		.map(([key, value]) => {
			const formatted = formatFrontmatterValue(key, value);
			if (!formatted) return null;
			return {
				key,
				label: key,
				displayValue: formatted,
				rawValue: value,
				isPlaceholder: false,
				isHtml: true,
				editable: false,
			} as HeaderPropertyItem;
		})
		.filter((item): item is HeaderPropertyItem => item !== null);

	$: row1Properties = [...baseStandardProperties, ...extraProperties];

	// Row 2: Minimalist 3-badge time bar:
	// 1. Timer/Kochzeit (read-only from @timer{...})
	// 2. Zusatzzeit (editable via extra_time / prep_time)
	// 3. Gesamt (read-only sum of Timer + Zusatzzeit)
	$: timeBarItems = [
		{
			key: "timer_time",
			label: isDe ? "Kochzeit" : "Cook",
			displayValue: timerDisplay || "—",
			rawValue: timerDisplay || "—",
			isPlaceholder: !timerDisplay,
			isHtml: false,
			editable: false,
		},
		{
			key: "extra_time",
			label: isDe ? "Zusatzzeit" : "Extra",
			displayValue: extraDisplay || "—",
			rawValue: extraDisplay || "—",
			isPlaceholder: !extraDisplay,
			isHtml: false,
			editable: true,
		},
		{
			key: "total_time",
			label: isDe ? "Gesamt" : "Total",
			displayValue: totalDisplay || "—",
			rawValue: totalDisplay || "—",
			isPlaceholder: !totalDisplay,
			isHtml: false,
			editable: false,
		},
	] as Array<HeaderPropertyItem>;
</script>

<div class="title-block" class:single-column={singleColumn}>
	{#if thumbnailPath}
		<img
			class="thumbnail"
			src={thumbnailPath}
			alt="Thumbnail for {title} recipe"
		/>
	{/if}
	<div class="metadata">
		<div class="inline-title">{title}</div>
		<div class="frontmatter recipe-properties-row">
			{#each row1Properties as prop (prop.key)}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<span
					class="title-block-property"
					class:is-editable={prop.editable}
					data-property-key={prop.key}
					on:click={(e) => startEditing(prop, e)}
				>
					<span class="key" data-property-key={prop.key}
						>{prop.label}</span
					>
					{#if editingKey === prop.key}
						<input
							class="inline-fm-input"
							type="text"
							bind:value={editValue}
							use:focusInput
							on:click|stopPropagation
							on:keypress|stopPropagation
							on:keydown={(e) => handleEditKeydown(e, prop.key)}
							on:blur={() => commitEdit(prop.key)}
						/>
					{:else if prop.isPlaceholder}
						<span
							class="value placeholder"
							data-property-value="—">—</span
						>
					{:else if prop.isHtml}
						<span
							class="value"
							data-property-value={String(prop.rawValue)}
						>
							<!-- eslint-disable -->
							{@html prop.displayValue}
						</span>
					{:else}
						<span
							class="value"
							data-property-value={prop.displayValue}
							>{prop.displayValue}</span
						>
					{/if}
				</span>
			{/each}
		</div>
		<div class="recipe-time-bar">
			{#each timeBarItems as item (item.key)}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<span
					class="recipe-time-item"
					class:recipe-time-total={item.key === "total_time"}
					class:is-editable={item.editable}
					data-property-key={item.key}
					on:click={(e) => startEditing(item, e)}
				>
					<span class="time-label" data-property-key={item.key}
						>{item.label}:</span
					>
					{#if editingKey === item.key}
						<input
							class="inline-fm-input"
							type="text"
							placeholder={isDe ? "z. B. 20 Min" : "e.g. 20 min"}
							bind:value={editValue}
							use:focusInput
							on:click|stopPropagation
							on:keypress|stopPropagation
							on:keydown={(e) => handleEditKeydown(e, item.key)}
							on:blur={() => commitEdit(item.key)}
						/>
					{:else if item.isPlaceholder}
						<span
							class="time-value value placeholder"
							data-property-value="—">—</span
						>
					{:else}
						<span
							class="time-value value"
							data-property-value={item.displayValue}
							>{item.displayValue}</span
						>
					{/if}
				</span>
			{/each}
		</div>
	</div>
</div>

<style>
	.title-block {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		gap: var(--size-4-4);
		margin-block-end: var(--size-4-6);
		width: 100%;
	}
	img.thumbnail {
		height: var(--thumbnail-size, 150px);
		width: var(--thumbnail-size, 150px);
		object-fit: cover;
		flex: 0 0 var(--thumbnail-size, 150px);
		flex-shrink: 0;
		margin: 0;
		border-radius: var(--radius-m, var(--radius-s));
	}
	.metadata {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.inline-title {
		margin-block-start: 0;
		margin-block-end: var(--size-4-2);
		overflow-wrap: break-word;
	}
	.recipe-properties-row {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-start;
		gap: var(--size-2-1) var(--size-4-3);
	}
	.title-block-property {
		display: inline-flex;
		align-items: center;
		gap: var(--size-4-1);
		font-size: var(--font-small);
		line-height: 1.4;
		border-radius: var(--radius-s);
		transition: background-color 0.15s ease, color 0.15s ease;
	}
	.title-block-property.is-editable {
		cursor: pointer;
		padding: 1px 4px;
		margin: -1px -4px;
	}
	.title-block-property.is-editable:hover {
		background-color: var(--background-modifier-hover);
	}
	.key {
		color: var(--text-accent);
		font-weight: 500;
	}
	.value {
		color: var(--text-normal);
	}
	.value.placeholder {
		color: var(--text-faint);
	}
	.recipe-time-bar {
		display: flex;
		gap: var(--size-4-2);
		flex-wrap: wrap;
		margin-top: var(--size-4-2);
		align-items: center;
	}
	.recipe-time-item {
		display: inline-flex;
		align-items: center;
		gap: var(--size-4-1);
		padding: 3px 10px;
		background-color: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		font-size: var(--font-ui-small);
		line-height: 1.4;
		cursor: default;
		transition: border-color 0.15s ease, background-color 0.15s ease;
	}
	.recipe-time-item.is-editable {
		cursor: pointer;
	}
	.recipe-time-item.is-editable:hover {
		border-color: var(--interactive-accent);
		background-color: var(--background-modifier-hover);
	}
	.recipe-time-item .time-label {
		color: var(--text-muted);
		font-weight: 500;
	}
	.recipe-time-item .time-value {
		color: var(--text-normal);
		font-weight: 600;
	}
	.recipe-time-item .time-value.placeholder {
		color: var(--text-faint);
		font-weight: 400;
	}
	.recipe-time-item.recipe-time-total {
		border-color: var(--interactive-accent);
		background-color: hsla(
			var(--accent-h),
			var(--accent-s),
			var(--accent-l),
			0.1
		);
	}
	.inline-fm-input {
		width: 85px;
		height: 1.5em;
		padding: 1px 6px;
		font-size: var(--font-ui-small);
		border: 1px solid var(--interactive-accent);
		border-radius: var(--radius-s);
		background-color: var(--background-primary);
		color: var(--text-normal);
		outline: none;
	}

	/* Single-column & mobile layout: keep cover thumbnail on the left and title/properties on the right */
	.single-column.title-block,
	:global(body.is-mobile) .title-block {
		flex-direction: row;
		align-items: flex-start;
	}
	.single-column img.thumbnail,
	:global(body.is-mobile) img.thumbnail {
		height: var(--thumbnail-size-mobile, 90px);
		width: var(--thumbnail-size-mobile, 90px);
		flex: 0 0 var(--thumbnail-size-mobile, 90px);
		flex-shrink: 0;
		object-fit: cover;
		border-radius: var(--radius-m, var(--radius-s));
		margin: 0;
	}
</style>
