<script lang="ts">
	import { ParsedRecipeComponent } from "./parsing";
	export let sideColumnComponents: Array<ParsedRecipeComponent>;
	export let mainColumnSections: Array<Array<ParsedRecipeComponent>>;
</script>

<div class="recipe-card two-column">
	<div class="column column-side">
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
