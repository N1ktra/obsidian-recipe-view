<script lang="ts">
	import {
		ParsedRecipeComponent,
		ParsedRecipeSection,
		ParsedRecipeStep,
	} from "./parsing";
	import store from "./store";
	import RecipeViewPlugin from "./main";
	import { get } from "svelte/store";

	export let globalIngredients: Array<ParsedRecipeComponent> = [];
	export let steps: Array<ParsedRecipeStep> = [];
	export let sections: Array<ParsedRecipeSection> = [];
	export let singleColumn = false;

	let plugin: RecipeViewPlugin = get(store.plugin);
	store.plugin.subscribe((p) => (plugin = p));
	$: styleIngredientBox = plugin?.settings?.styleIngredientBox ?? true;

	let wrapperEl: HTMLDivElement;
	let selectedStepNumber: number | null = null;

	function syncSelectedFromDom() {
		if (!wrapperEl) return;
		const checkedRadio = wrapperEl.querySelector(
			'input[type="radio"]:checked'
		) as HTMLInputElement | null;
		if (!checkedRadio) {
			selectedStepNumber = null;
			return;
		}
		const stepOwner = checkedRadio.closest(
			"[data-step-number]"
		) as HTMLElement | null;
		const numAttr = stepOwner?.getAttribute("data-step-number");
		selectedStepNumber = numAttr ? parseInt(numAttr, 10) : null;
	}

	function handleStepMainClick(e: MouseEvent, stepNumber: number | null) {
		const target = e.target as HTMLElement | null;
		if (!target) return;

		// Do not hijack clicks on links or buttons (e.g. @timer{...} buttons)
		if (target.closest("a, button")) {
			return;
		}

		const mainEl = e.currentTarget as HTMLElement | null;
		if (!mainEl) return;

		const radio = mainEl.querySelector(
			'input[type="radio"]'
		) as HTMLInputElement | null;
		if (radio) {
			radio.checked = true;
			radio.dispatchEvent(new Event("change", { bubbles: true }));
			radio.focus({ preventScroll: true });
		}
		selectedStepNumber = stepNumber;
	}

	$: effectiveSteps = steps || [];
	$: hasGlobalIngredients = (globalIngredients?.length ?? 0) > 0;
	$: firstStepWithIngIdx = effectiveSteps.findIndex(
		(s) => s.stepIngredients.length > 0
	);

	// Partition steps:
	// - When globalIngredients exist, steps before the first step with its own stepIngredients
	//   sit in the right column of the top grid next to the global ingredients card.
	// - All steps from the first step with stepIngredients onward (or all steps when there are no
	//   globalIngredients) are rendered in synchronized .recipe-step-row grid rows.
	$: topRightSteps = hasGlobalIngredients
		? firstStepWithIngIdx === -1
			? effectiveSteps
			: effectiveSteps.slice(0, firstStepWithIngIdx)
		: [];

	$: bottomStepRows = hasGlobalIngredients
		? firstStepWithIngIdx === -1
			? []
			: effectiveSteps.slice(firstStepWithIngIdx)
		: effectiveSteps;

	// Find the last numbered step across the entire recipe
	$: lastNumberedStep = [...effectiveSteps]
		.reverse()
		.find((s) => !s.isHeadingOnly);
</script>

<div
	class="recipe-card split-steps recipe-card-split-steps"
	class:single-column={singleColumn}
	data-sections-count={sections?.length ?? 0}
	bind:this={wrapperEl}
	on:change={syncSelectedFromDom}
>
	<div class="split-steps-wrapper">
		<div
			class="recipe-top-grid"
			class:has-top-steps={topRightSteps.length > 0}
			class:has-bottom-rows={bottomStepRows.length > 0}
		>
			<div class="top-title-area">
				<slot name="titleblock" />
			</div>

			<div class="top-sidebar-area">
				<div
					class="recipe-sidebar-card global-ingredients-card"
					class:ingredient-box={styleIngredientBox}
					class:has-global-ingredients={hasGlobalIngredients}
				>
					<slot name="scaleselector" />
					{#if hasGlobalIngredients}
						<div class="global-ingredients-body recipe-ingredients-column">
							{#each globalIngredients as c (c)}
								<svelte:component this={c.type} {...c.props} />
							{/each}
						</div>
					{/if}
				</div>
			</div>

			{#if topRightSteps.length > 0}
				<div class="top-steps-area">
					{#each topRightSteps as step (step)}
						{#if step.isHeadingOnly}
							<div class="step-heading-block">
								{#each step.mainComponents as c (c)}
									<svelte:component
										this={c.type}
										{...c.props}
									/>
								{/each}
							</div>
						{:else}
							<div
								class="top-step-item"
								class:is-last-step={step === lastNumberedStep}
								class:is-selected={step.stepNumber !== null &&
									selectedStepNumber === step.stepNumber}
								data-step-number={step.stepNumber}
							>
								<!-- svelte-ignore a11y-click-events-have-key-events -->
								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<div
									class="step-card-main"
									on:click={(e) =>
										handleStepMainClick(e, step.stepNumber)}
								>
									{#if step.stepNumber !== null}
										<span
											class="step-card-number"
											aria-label="Step {step.stepNumber}"
										>
											{step.stepNumber}.
										</span>
									{/if}
									<div class="step-card-body">
										{#each step.mainComponents as c (c)}
											<svelte:component
												this={c.type}
												{...c.props}
											/>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		{#if bottomStepRows.length > 0}
			<div class="step-cards-list">
				{#each bottomStepRows as step (step)}
					<div
						class="recipe-step-row"
						class:has-ingredients={step.stepIngredients.length > 0}
						class:is-heading-row={step.isHeadingOnly}
						class:is-selected={step.stepNumber !== null &&
							selectedStepNumber === step.stepNumber}
						data-step-number={step.stepNumber}
					>
						{#if step.stepIngredients.length > 0}
							<div class="step-ingredients-card recipe-ingredients-column">
								{#each step.stepIngredients as c (c)}
									<svelte:component
										this={c.type}
										{...c.props}
									/>
								{/each}
							</div>
						{:else}
							<div class="step-ingredients-empty" />
						{/if}

						{#if step.isHeadingOnly}
							<div class="step-heading-block">
								{#each step.mainComponents as c (c)}
									<svelte:component
										this={c.type}
										{...c.props}
									/>
								{/each}
							</div>
						{:else}
							<div class="step-right-cell">
								<!-- svelte-ignore a11y-click-events-have-key-events -->
								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<div
									class="step-card-main"
									on:click={(e) =>
										handleStepMainClick(e, step.stepNumber)}
								>
									{#if step.stepNumber !== null}
										<span
											class="step-card-number"
											aria-label="Step {step.stepNumber}"
										>
											{step.stepNumber}.
										</span>
									{/if}
									<div class="step-card-body">
										{#each step.mainComponents as c (c)}
											<svelte:component
												this={c.type}
												{...c.props}
											/>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.recipe-card.split-steps,
	.recipe-card-split-steps,
	.split-steps-wrapper,
	.recipe-top-grid,
	.step-cards-list,
	.recipe-step-row {
		width: 100% !important;
		max-width: 100% !important;
		box-sizing: border-box;
		align-self: stretch;
	}

	.recipe-card.split-steps {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		padding-block: 0;
	}

	.split-steps-wrapper {
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}

	/* Top overview grid:
	   - Desktop: Left column (280px) has Scale recipe + Global Ingredients card;
	              Right column (1fr) has TitleBlock + initial Directions steps.
	   - Mobile:  1 column (TitleBlock -> Scale recipe + Global Ingredients -> Directions). */
	.recipe-top-grid {
		display: grid;
		grid-template-columns: 280px 1fr;
		column-gap: var(--size-4-5);
		row-gap: 0;
		align-items: start;
	}

	.recipe-top-grid.has-bottom-rows {
		margin-bottom: var(--size-4-4);
	}

	.recipe-top-grid.has-top-steps {
		grid-template-rows: auto 1fr;
	}

	.top-sidebar-area {
		grid-column: 1;
		grid-row: 1;
		width: 100%;
		min-width: 0;
	}

	.recipe-top-grid.has-top-steps .top-sidebar-area {
		grid-row: 1 / span 2;
	}

	.top-title-area {
		grid-column: 2;
		grid-row: 1;
		width: 100%;
		min-width: 0;
	}

	.top-steps-area {
		grid-column: 2;
		grid-row: 2;
		width: 100%;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	/* Unified Sidebar Card (Scale recipe + Global ingredients) & Step ingredients card */
	.recipe-sidebar-card,
	.global-ingredients-card.ingredient-box,
	.step-ingredients-card {
		background-color: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-3);
		box-sizing: border-box;
		width: 100%;
		cursor: default;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	/* Remove separate border/background/radius from inner ScaleSelector so sidebar card looks unified */
	.recipe-sidebar-card :global(.scale-selector) {
		background-color: transparent !important;
		border: none !important;
		border-radius: 0 !important;
		padding: 0 !important;
		margin: 0 !important;
		box-shadow: none !important;
	}

	/* Subtle divider line between Scale recipe and Global ingredients below it */
	.recipe-sidebar-card.has-global-ingredients :global(.scale-selector) {
		padding-block-end: var(--size-4-3) !important;
		margin-block-end: var(--size-4-3) !important;
		border-bottom: 1px solid var(--background-modifier-border) !important;
	}

	.global-ingredients-body {
		width: 100%;
		min-width: 0;
	}

	.global-ingredients-card :global(> div > :first-child > .recipe-leaf:is(h1, h2, h3, h4, h5, h6)),
	.global-ingredients-card :global(.recipe-ingredients-column > :first-child > .recipe-leaf:is(h1, h2, h3, h4, h5, h6)),
	.global-ingredients-card :global(.recipe-ingredients-column > .recipe-leaf:is(h1, h2, h3, h4, h5, h6):first-child),
	.step-ingredients-card :global(> :first-child > .recipe-leaf:is(h1, h2, h3, h4, h5, h6)),
	.step-ingredients-card :global(.recipe-leaf:is(h1, h2, h3, h4, h5, h6):first-child) {
		margin-block-start: 0;
		margin-block-end: var(--size-4-2);
	}

	.global-ingredients-card :global(> div > :not(:first-child) > .recipe-leaf:is(h1, h2, h3, h4, h5, h6)),
	.global-ingredients-card :global(.recipe-ingredients-column > :not(:first-child) > .recipe-leaf:is(h1, h2, h3, h4, h5, h6)),
	.global-ingredients-card :global(.recipe-ingredients-column > .recipe-leaf:is(h1, h2, h3, h4, h5, h6):not(:first-child)),
	.step-ingredients-card :global(> :not(:first-child) > .recipe-leaf:is(h1, h2, h3, h4, h5, h6)),
	.step-ingredients-card :global(.recipe-leaf:is(h1, h2, h3, h4, h5, h6):not(:first-child)) {
		margin-block-start: var(--size-4-4);
		margin-block-end: var(--size-4-2);
	}

	.global-ingredients-card :global(ul),
	.global-ingredients-card :global(ul.bullets),
	.step-ingredients-card :global(ul),
	.step-ingredients-card :global(ul.bullets) {
		list-style: none !important;
		list-style-type: none !important;
		margin-block: 0 !important;
		padding-inline-start: 0 !important;
		margin-inline-start: 0 !important;
	}

	.global-ingredients-card :global(ul > li),
	.global-ingredients-card :global(ul.bullets > li),
	.step-ingredients-card :global(ul > li),
	.step-ingredients-card :global(ul.bullets > li) {
		list-style: none !important;
		list-style-type: none !important;
		margin-inline-start: 0 !important;
		padding-inline-start: 0 !important;
	}

	.global-ingredients-card :global(ul > li:first-child),
	.step-ingredients-card :global(ul > li:first-child) {
		margin-block-start: 0 !important;
	}

	.global-ingredients-card :global(ul > li:last-child),
	.step-ingredients-card :global(ul > li:last-child) {
		margin-block-end: 0 !important;
	}

	/* Unified Step Rows Grid:
	   - Transparent 1px border on all sides by default prevents layout jumping when selected.
	   - Bottom border serves as the full-row divider when unselected.
	   - Hover and selection are triggered ONLY from the right column (.step-card-main),
	     but visually style the entire .recipe-step-row as one closed unit. */
	.step-cards-list {
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}

	.recipe-step-row {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: var(--size-4-4);
		align-items: start;
		padding: var(--size-4-2);
		margin-bottom: var(--size-4-3);
		border: none;
		border-bottom: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		background-color: transparent;
		box-sizing: border-box;
		cursor: default;
		transition: background-color 0.15s ease, border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.recipe-step-row:last-child {
		border-bottom-color: transparent;
		margin-bottom: 0;
	}

	/* Hover triggered ONLY when hovering the right-hand step column (.step-card-main) */
	@media (hover: hover) {
		.recipe-step-row:has(.step-card-main:hover) {
			background-color: var(--background-modifier-hover);
			border-radius: var(--radius-m);
			border-bottom-color: transparent;
		}
	}

	/* Selected state: ONE closed accent frame around the entire row (left + right united)
	   using box-shadow so no horizontal border/padding offsets the left column alignment */
	.recipe-step-row.is-selected,
	.recipe-step-row:has(input[type="radio"]:checked) {
		border-bottom-color: transparent;
		border-radius: var(--radius-m);
		background-color: var(
			--background-secondary-alt,
			var(--background-secondary)
		);
		box-shadow: 0 0 0 1px var(--interactive-accent);
	}

	.step-ingredients-empty {
		min-width: 0;
	}

	.step-heading-block {
		width: 100%;
		min-width: 0;
		padding-block: var(--size-4-2) var(--size-4-1);
	}

	.step-heading-block :global(.recipe-leaf:is(h1, h2, h3, h4, h5, h6)) {
		margin-block: 0;
	}

	/* Steps inside topRightSteps (when beside global ingredients card) */
	.top-step-item {
		width: 100%;
		max-width: 100%;
		min-width: 0;
		box-sizing: border-box;
		border: none;
		border-bottom: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-2);
		margin-bottom: var(--size-4-2);
		background-color: transparent;
		transition: background-color 0.15s ease, border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.top-step-item.is-last-step {
		border-bottom-color: transparent;
		margin-bottom: 0;
	}

	@media (hover: hover) {
		.top-step-item:has(.step-card-main:hover) {
			background-color: var(--background-modifier-hover);
			border-radius: var(--radius-m);
			border-bottom-color: transparent;
		}
	}

	.top-step-item.is-selected,
	.top-step-item:has(input[type="radio"]:checked) {
		border-bottom-color: transparent;
		border-radius: var(--radius-m);
		background-color: var(
			--background-secondary-alt,
			var(--background-secondary)
		);
		box-shadow: 0 0 0 1px var(--interactive-accent);
	}

	/* Right column container inside .recipe-step-row */
	.step-right-cell {
		width: 100%;
		max-width: 100%;
		min-width: 0;
		box-sizing: border-box;
		padding: 0;
	}

	/* Right-hand step trigger area: ONLY this area has cursor: pointer and triggers hover/click.
	   No separate box border of its own so the parent row forms the single closed frame. */
	.step-card-main {
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: row;
		align-items: baseline;
		gap: var(--size-4-2);
		background-color: transparent;
		border: none;
		padding: var(--size-4-1) var(--size-4-2);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.recipe-step-row.is-selected .step-card-number,
	.recipe-step-row:has(input[type="radio"]:checked) .step-card-number,
	.top-step-item.is-selected .step-card-number,
	.top-step-item:has(input[type="radio"]:checked) .step-card-number {
		color: var(--text-accent);
		font-weight: 600;
	}

	.recipe-step-row.is-selected .step-card-body :global(:is(h1, h2, h3, h4, h5, h6)),
	.recipe-step-row.is-selected .step-card-body :global(.step-title),
	.recipe-step-row:has(input[type="radio"]:checked) .step-card-body :global(:is(h1, h2, h3, h4, h5, h6)),
	.recipe-step-row:has(input[type="radio"]:checked) .step-card-body :global(.step-title),
	.top-step-item.is-selected .step-card-body :global(:is(h1, h2, h3, h4, h5, h6)),
	.top-step-item.is-selected .step-card-body :global(.step-title),
	.top-step-item:has(input[type="radio"]:checked) .step-card-body :global(:is(h1, h2, h3, h4, h5, h6)),
	.top-step-item:has(input[type="radio"]:checked) .step-card-body :global(.step-title) {
		color: var(--text-accent);
	}

	@media (hover: hover) {
		.recipe-step-row:hover .step-card-number,
		.recipe-step-row:has(.step-card-main:hover) .step-card-number,
		.top-step-item:hover .step-card-number,
		.top-step-item:has(.step-card-main:hover) .step-card-number {
			color: var(--text-accent);
		}

		.recipe-step-row:hover .step-card-body :global(:is(h1, h2, h3, h4, h5, h6)),
		.recipe-step-row:hover .step-card-body :global(.step-title),
		.recipe-step-row:has(.step-card-main:hover) .step-card-body :global(:is(h1, h2, h3, h4, h5, h6)),
		.recipe-step-row:has(.step-card-main:hover) .step-card-body :global(.step-title),
		.top-step-item:hover .step-card-body :global(:is(h1, h2, h3, h4, h5, h6)),
		.top-step-item:hover .step-card-body :global(.step-title),
		.top-step-item:has(.step-card-main:hover) .step-card-body :global(:is(h1, h2, h3, h4, h5, h6)),
		.top-step-item:has(.step-card-main:hover) .step-card-body :global(.step-title) {
			color: var(--text-accent);
		}
	}

	.step-card-number,
	.step-card-body :global(:is(h1, h2, h3, h4, h5, h6)),
	.step-card-body :global(.step-title) {
		transition: color 0.15s ease;
	}

	.step-card-number {
		flex-shrink: 0;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		min-width: 1.5em;
		user-select: none;
	}

	.step-card-body {
		flex: 1 1 0;
		min-width: 0;
		width: 100%;
		max-width: 100%;
	}

	.step-card-body :global(> div),
	.step-card-body :global(p),
	.step-card-body :global(ol),
	.step-card-body :global(.recipe-leaf) {
		max-width: 100% !important;
	}

	.step-card-body :global(> div:first-child > p:first-child),
	.step-card-body :global(> div:first-child > ol:first-child),
	.step-card-body
		:global(> div:first-child > .recipe-leaf:is(h1, h2, h3, h4, h5, h6):first-child) {
		margin-block-start: 0 !important;
	}

	.step-card-body :global(> div:last-child > p:last-child),
	.step-card-body :global(> div:last-child > ol:last-child) {
		margin-block-end: 0 !important;
	}

	.step-card-body :global(ol > li:first-child) {
		margin-block-start: 0 !important;
	}

	.step-card-body :global(ol > li:last-child) {
		margin-block-end: 0 !important;
	}

	/* Responsive mobile / narrow window layout (singleColumn) */
	.recipe-card.split-steps.single-column .recipe-top-grid,
	:global(body.is-mobile) .recipe-card.split-steps .recipe-top-grid {
		grid-template-columns: 1fr;
		grid-template-rows: auto;
		row-gap: var(--size-4-4);
	}

	.recipe-card.split-steps.single-column .top-title-area,
	:global(body.is-mobile) .recipe-card.split-steps .top-title-area {
		grid-column: 1;
		grid-row: 1;
	}

	.recipe-card.split-steps.single-column .top-sidebar-area,
	:global(body.is-mobile) .recipe-card.split-steps .top-sidebar-area {
		grid-column: 1;
		grid-row: 2;
	}

	.recipe-card.split-steps.single-column .top-steps-area,
	:global(body.is-mobile) .recipe-card.split-steps .top-steps-area {
		grid-column: 1;
		grid-row: 3;
	}

	.recipe-card.split-steps.single-column .recipe-step-row,
	:global(body.is-mobile) .recipe-card.split-steps .recipe-step-row {
		grid-template-columns: 1fr;
		gap: var(--size-4-2);
	}

	.recipe-card.split-steps.single-column .step-ingredients-empty,
	:global(body.is-mobile) .recipe-card.split-steps .step-ingredients-empty {
		display: none;
	}

	@media (max-width: 650px) {
		.recipe-top-grid {
			grid-template-columns: 1fr;
			grid-template-rows: auto;
			row-gap: var(--size-4-4);
		}

		.top-title-area {
			grid-column: 1;
			grid-row: 1;
		}

		.top-sidebar-area {
			grid-column: 1;
			grid-row: 2;
		}

		.top-steps-area {
			grid-column: 1;
			grid-row: 3;
		}

		.recipe-step-row {
			grid-template-columns: 1fr;
			gap: var(--size-4-2);
		}

		.step-ingredients-empty {
			display: none;
		}
	}
</style>
