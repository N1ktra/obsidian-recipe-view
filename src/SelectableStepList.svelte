<script lang="ts">
	import RecipeLeaf from "./RecipeLeaf.svelte";

	export let list: HTMLOListElement | Array<HTMLElement>;
	export let kind: string;
	export let radioName: string;

	function olChildren() {
		return (list as HTMLOListElement).children;
	}

	function olStart() {
		return (list as HTMLOListElement).start || 1;
	}

	function olChild(index: number) {
		return olChildren().item(index)! as HTMLElement;
	}

	function pList() {
		return list as Array<HTMLElement>;
	}
</script>

{#if kind == "ol"}
	<!-- means steps is the children of an OL element -->
	<div>
		<ol class="recipe-mutex-select">
			{#each olChildren() as _, i}
				<li>
					<label>
						<input type="radio" name={radioName} />
						<div class="leaf step-flex">
							<span class="step-number"
								>{olStart() + i}.</span
							>
							<div class="step-body">
								<RecipeLeaf childNodesOf={olChild(i)} asTag="div" />
							</div>
						</div>
					</label>
				</li>
			{/each}
		</ol>
	</div>
{:else if kind == "p"}
	<!-- means steps is an array of P elements -->
	{#each pList() as p}
		<div>
			<p>
				<label>
					<input type="radio" name={radioName} />
					<div class="leaf">
						<RecipeLeaf childNodesOf={p} asTag="div" />
					</div>
				</label>
			</p>
		</div>
	{/each}
{/if}

<style>
	ol.recipe-mutex-select {
		list-style: none !important;
		padding-inline-start: 0 !important;
		margin-inline-start: 0 !important;
	}

	li {
		list-style: none !important;
		list-style-type: none !important;
		margin-block: var(--p-spacing);
		margin-inline-start: 0 !important;
		padding-inline-start: 0 !important;
	}

	li::marker {
		content: none !important;
		display: none !important;
	}

	input[type="radio"] {
		opacity: 0;
		position: absolute;
		height: 100%;
		width: 100%;
		margin: 0;
		padding: 0;
		z-index: -1;
	}

	label {
		position: relative;
		display: block;
		cursor: pointer;
	}

	.leaf {
		border-radius: var(--radius-m);
		padding: var(--size-4-2);
		margin: calc(-1 * var(--size-4-2));
	}

	.leaf.step-flex {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		gap: var(--size-4-2);
	}

	.step-number {
		flex-shrink: 0;
		color: var(--list-marker-color, var(--text-muted));
		font-variant-numeric: tabular-nums;
		min-width: 1.4em;
	}

	.step-body {
		flex: 1;
		min-width: 0;
	}

	.step-body :global(p:first-child) {
		margin-block-start: 0;
	}

	.step-body :global(p:last-child) {
		margin-block-end: 0;
	}

	.step-body :global(.list-bullet) {
		display: none !important;
	}

	input[type="radio"]:checked ~ .leaf {
		background-color: hsla(
			var(--accent-h),
			var(--accent-s),
			var(--accent-l),
			var(--selected-step-alpha)
		);
	}

	input[type="radio"]:focus ~ .leaf {
		box-shadow: inset 0px 0px 0px var(--border-width)
			var(--interactive-accent);
	}
</style>
