<script lang="ts">
	import { ParsedRecipeComponent } from "./parsing";
	import store from "./store";
	import RecipeViewPlugin from "./main";
	import { get } from "svelte/store";

	export let sideColumnComponents: Array<ParsedRecipeComponent> = [];
	export let mainColumnSections: Array<Array<ParsedRecipeComponent>> = [];

	let plugin: RecipeViewPlugin = get(store.plugin);
	store.plugin.subscribe((p) => (plugin = p));
	$: styleIngredientBox = plugin?.settings?.styleIngredientBox ?? true;
	$: nonEmptyMainSections = (mainColumnSections || []).filter(
		(s) => s && s.length > 0
	);
</script>

<div class="recipe-card one-column">
	<div class="column column-main">
		<div class="split-step split-step-title">
			<slot name="titleblock" />
		</div>

		<div class="column column-side" class:ingredient-box={styleIngredientBox}>
			<slot name="scaleselector" />
			{#each sideColumnComponents as c (c)}
				<svelte:component this={c.type} {...c.props} />
			{/each}
		</div>

		{#each nonEmptyMainSections as mainColumnComponents}
			<div
				class="split-step"
				class:only-step={nonEmptyMainSections.length == 1}
			>
				{#each mainColumnComponents as c (c)}
					<svelte:component this={c.type} {...c.props} />
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.recipe-card.one-column {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
	}

	.column {
		padding: 0;
		min-width: 0;
	}

	.column-main {
		width: 100%;
		max-width: var(--file-line-width, 100%);
	}

	:global(.markdown-preview-view:not(.is-readable-line-width)) .column-main {
		max-width: 100%;
	}

	.column-side {
		width: 100%;
		margin-block-end: var(--size-4-6, 1.5rem);
	}

	.column-side.ingredient-box {
		background-color: var(--background-secondary);
		padding: var(--size-4-4);
		border-radius: var(--radius-m);
		box-sizing: border-box;
	}

	.column-side.ingredient-box :global(.scale-selector) {
		background-color: var(--background-primary);
	}

	.column-side :global(.recipe-leaf:is(h1, h2, h3, h4, h5, h6)) {
		margin-block-start: var(--size-4-2);
		margin-block-end: var(--size-4-2);
	}

	.column-side :global(ul) {
		margin-block: var(--size-4-1) 0;
	}

	.split-step {
		padding-inline: var(--size-4-4);
		margin-inline: calc(-1 * var(--size-4-4));
		padding-block: calc(var(--file-margins) / 2);
		border-radius: var(--radius-s);
	}

	.split-step-title {
		background-color: transparent !important;
		padding-block: 0;
		padding-inline: 0;
		margin-inline: 0;
	}

	.split-step:nth-child(odd) {
		background-color: var(--background-secondary);
	}

	.split-step.only-step {
		background-color: transparent !important;
		padding-top: 0;
		padding-inline: 0;
		margin-inline: 0;
	}

	.split-step :global(.recipe-leaf:is(h1, h2, h3, h4, h5, h6):first-child) {
		margin-block-start: 0;
	}
</style>
