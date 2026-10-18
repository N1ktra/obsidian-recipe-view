<script lang="ts">
	import { ParsedRecipeComponent } from "./parsing";

	export let sections: Array<Array<ParsedRecipeComponent>>;
</script>

<div class="recipe-card one-column">
	<div class="split-step split-step-title">
		<div class="column column-main column-title">
			<slot name="titleblock" />
			<slot name="scaleselector" />
		</div>
	</div>
	{#if sections}
		{#each sections as section}
			<div class="split-step" class:only-step={sections.length == 1}>
				<div class="column column-main">
					{#each section as c (c)}
						<svelte:component
							this={c.type}
							{...c.props}
						/>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>

<style>
	.recipe-card.one-column {
		width: 100%;
	}

	.split-step {
		display: flex;
		flex-direction: row;
		justify-content: center;
		padding-block: var(--size-4-4);
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

	.column-main {
		width: 100%;
		max-width: var(--file-line-width, 100%);
		flex: 1 1 var(--file-line-width, 100%);
	}

	:global(.markdown-preview-view:not(.is-readable-line-width)) .column-main {
		max-width: 100%;
		flex-basis: 100%;
	}

	.column {
		padding-inline: 0;
	}
	.column-title {
		padding-bottom: 0;
	}
</style>
