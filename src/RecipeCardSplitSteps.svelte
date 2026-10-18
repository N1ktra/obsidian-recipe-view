<script lang="ts">
	import { ParsedRecipeSection } from "./parsing";

	export let sections: Array<ParsedRecipeSection> = [];
	export let singleColumn = false;

	interface NumberedSection {
		section: ParsedRecipeSection;
		stepNumber: number | null;
	}

	function isHeadingOnlySection(section: ParsedRecipeSection): boolean {
		return (
			section.sideComponents.length === 0 &&
			section.mainComponents.length > 0 &&
			section.mainComponents.every(
				(c) =>
					typeof c.props?.asTag === "string" &&
					/^H[1-6]$/i.test(c.props.asTag as string)
			)
		);
	}

	$: activeSections = (sections || []).filter(
		(s) => s.sideComponents.length > 0 || s.mainComponents.length > 0
	);

	$: numberedSections = (() => {
		let counter = 0;
		return activeSections.map((section): NumberedSection => {
			if (
				section.mainComponents.length > 0 &&
				!isHeadingOnlySection(section)
			) {
				counter += 1;
				return { section, stepNumber: counter };
			}
			return { section, stepNumber: null };
		});
	})();
</script>

<div
	class="recipe-card split-steps recipe-card-split-steps"
	class:single-column={singleColumn}
>
	<div class="split-steps-wrapper">
		<div class="split-steps-header">
			<slot name="titleblock" />
			<slot name="scaleselector" />
		</div>

		{#if numberedSections.length > 0}
			<div class="step-cards-list">
				{#each numberedSections as { section, stepNumber } (section)}
					<div
						class="step-card"
						class:has-ingredients={section.sideComponents.length > 0}
						class:has-steps={section.mainComponents.length > 0}
					>
						{#if section.sideComponents.length > 0}
							<div class="column column-side step-card-ingredients">
								{#each section.sideComponents as c (c)}
									<svelte:component this={c.type} {...c.props} />
								{/each}
							</div>
						{/if}

						{#if section.mainComponents.length > 0}
							<div class="column column-main step-card-main">
								{#if stepNumber !== null}
									<div
										class="step-card-badge"
										aria-label="Step {stepNumber}"
									>
										{stepNumber}
									</div>
								{/if}
								<div class="step-card-body">
									{#each section.mainComponents as c (c)}
										<svelte:component
											this={c.type}
											{...c.props}
										/>
									{/each}
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
	.split-steps-header,
	.step-cards-list,
	.step-card {
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

	.split-steps-header {
		margin-block-end: var(--size-4-4);
	}

	.step-cards-list {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--size-4-4);
	}

	.step-card {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		gap: var(--size-4-4);
		background-color: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-4);
	}

	.column {
		padding: 0;
		min-width: 0;
	}

	/* Left column: Step ingredients */
	.step-card-ingredients {
		flex: 0 0 260px;
		min-width: 220px;
		max-width: 320px;
		box-sizing: border-box;
	}

	.step-card.has-steps .step-card-ingredients {
		border-inline-end: 1px solid var(--background-modifier-border);
		padding-inline-end: var(--size-4-4);
	}

	.step-card-ingredients :global(ul),
	.step-card-ingredients :global(ul.bullets) {
		list-style: none !important;
		list-style-type: none !important;
		margin-block: 0 !important;
		padding-inline-start: 0 !important;
		margin-inline-start: 0 !important;
	}

	.step-card-ingredients :global(ul > li),
	.step-card-ingredients :global(ul.bullets > li) {
		list-style: none !important;
		list-style-type: none !important;
		margin-inline-start: 0 !important;
		padding-inline-start: 0 !important;
	}

	.step-card-ingredients :global(ul > li:first-child) {
		margin-block-start: 0 !important;
	}

	.step-card-ingredients :global(ul > li:last-child) {
		margin-block-end: 0 !important;
	}

	.step-card-ingredients :global(.recipe-leaf:is(h1, h2, h3, h4, h5, h6):first-child) {
		margin-block-start: 0;
	}

	/* Right column: Step number badge + step content */
	.step-card-main {
		flex: 1 1 0;
		min-width: 0;
		width: 100%;
		max-width: 100%;
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		gap: var(--size-4-3);
	}

	.step-card-badge {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		padding: 0 6px;
		border-radius: 999px;
		background-color: hsla(
			var(--accent-h),
			var(--accent-s),
			var(--accent-l),
			0.16
		);
		border: 1px solid
			hsla(var(--accent-h), var(--accent-s), var(--accent-l), 0.35);
		color: var(--text-accent);
		font-size: var(--font-smaller, 0.85em);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		user-select: none;
		box-sizing: border-box;
		margin-top: 1px;
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

	/* Responsive mobile / narrow window layout */
	.recipe-card.split-steps.single-column .step-card,
	:global(body.is-mobile) .recipe-card.split-steps .step-card {
		flex-direction: column;
		gap: var(--size-4-3);
	}

	.recipe-card.split-steps.single-column .step-card-ingredients,
	:global(body.is-mobile) .recipe-card.split-steps .step-card-ingredients {
		flex: 1 1 auto;
		width: 100% !important;
		min-width: 0;
		max-width: 100% !important;
	}

	.recipe-card.split-steps.single-column
		.step-card.has-steps
		.step-card-ingredients,
	:global(body.is-mobile)
		.recipe-card.split-steps
		.step-card.has-steps
		.step-card-ingredients {
		border-inline-end: none;
		padding-inline-end: 0;
		border-block-end: 1px solid var(--background-modifier-border);
		padding-block-end: var(--size-4-3);
	}

	@media (max-width: 650px) {
		.step-card {
			flex-direction: column;
			gap: var(--size-4-3);
		}

		.step-card-ingredients {
			flex: 1 1 auto;
			width: 100% !important;
			min-width: 0;
			max-width: 100% !important;
		}

		.step-card.has-steps .step-card-ingredients {
			border-inline-end: none;
			padding-inline-end: 0;
			border-block-end: 1px solid var(--background-modifier-border);
			padding-block-end: var(--size-4-3);
		}
	}
</style>
