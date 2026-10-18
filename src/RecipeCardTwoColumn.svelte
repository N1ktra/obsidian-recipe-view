<script lang="ts">
	import { ParsedRecipeComponent } from "./parsing";
	import store from "./store";
	import RecipeViewPlugin from "./main";
	import { get } from "svelte/store";

	export let sideColumnComponents: Array<ParsedRecipeComponent>;
	export let mainColumnSections: Array<Array<ParsedRecipeComponent>>;

	let plugin: RecipeViewPlugin = get(store.plugin);
	store.plugin.subscribe((p) => (plugin = p));
	$: styleIngredientBox = plugin?.settings?.styleIngredientBox ?? true;
</script>

<div class="recipe-card two-column">
	<div class="column column-side" class:ingredient-box={styleIngredientBox}>
		<slot name="scaleselector" />
		{#each sideColumnComponents as c}
			<svelte:component this={c.type} {...c.props} />
		{/each}
	</div>
	<div class="column column-main">
		<div class="split-step split-step-title">
			<slot name="titleblock" />
		</div>
		{#each mainColumnSections as mainColumnComponents}
			<div
				class="split-step"
				class:only-step={mainColumnSections.length == 1}
			>
				{#each mainColumnComponents as c}
					<svelte:component this={c.type} {...c.props} />
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.recipe-card {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		justify-content: center;
		gap: var(--file-margins);
		width: 100%;
		position: relative;
	}

	.column {
		padding: 0;
		min-width: 0;
	}

	.column-side {
		flex-basis: calc(var(--file-line-width, 700px) / 2);
		flex-grow: 0;
		flex-shrink: 1;
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

	.column-main {
		flex-basis: var(--file-line-width, 700px);
		flex-grow: 1;
		flex-shrink: 1;
		max-width: var(--file-line-width, 100%);
	}

	:global(.markdown-preview-view:not(.is-readable-line-width)) .column-main {
		max-width: 100%;
	}

	.split-step {
		padding-inline: var(--size-4-4);
		margin-inline: calc(-1 * var(--size-4-4));
		padding-block: calc(var(--file-margins) / 2);
		border-radius: var(--radius-s);
	}

	.split-step-title {
		background-color: transparent !important;
		padding-top: 0;
	}

	.split-step:nth-child(odd) {
		background-color: var(--background-secondary);
	}

	.split-step.only-step {
		background-color: transparent !important;
		padding-top: 0;
	}
</style>
