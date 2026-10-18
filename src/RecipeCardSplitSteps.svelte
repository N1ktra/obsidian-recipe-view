<script lang="ts">
	import { ParsedRecipeSection } from "./parsing";

	export let sections: Array<ParsedRecipeSection>;
</script>

<div class="recipe-card split-steps">
	<div class="split-step split-step-title">
		<div class="column column-side" />
		<div class="column column-main">
			<slot name="titleblock" />
			<slot name="scaleselector" />
		</div>
	</div>
	{#if sections}
		{#each sections as section}
			<div class="split-step">
				<div class="column column-side">
					<div class="column-content">
						{#each section.sideComponents as c (c)}
							<svelte:component this={c.type} {...c.props} />
						{/each}
					</div>
				</div>
				<div class="column column-main">
					<div class="column-content">
						{#each section.mainComponents as c (c)}
							<svelte:component this={c.type} {...c.props} />
						{/each}
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>

<style>
	.split-step {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: stretch;
		gap: var(--file-margins);
		padding-block: calc(var(--file-margins) / 2);
		padding-inline: var(--size-4-4);
		margin-inline: calc(-1 * var(--size-4-4));
		border-radius: var(--radius-s);
	}

	.split-step:nth-child(odd) {
		background-color: var(--background-secondary);
	}

	.split-step-title {
		padding-block: 0 calc(var(--file-margins) / 2);
		background-color: transparent !important;
	}

	.split-steps {
		padding-block: 0;
		width: 100%;
	}

	.column {
		padding-inline: 0;
		display: block;
		min-width: 0;
	}

	.column:empty {
		display: none;
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

	.column-content {
		position: -webkit-sticky;
		position: sticky;
		top: var(--file-margins);
	}
</style>
