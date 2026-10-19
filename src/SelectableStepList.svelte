<script lang="ts">
	import RecipeLeaf from "./RecipeLeaf.svelte";
	import { highlightIngredientsInDom } from "./parsing";

	export let list: HTMLOListElement | Array<HTMLElement>;
	export let kind: string;
	export let radioName: string = "";
	export let highlightIngredients: Array<string> = [];

	$: void radioName;

	$: if (list) {
		if (Array.isArray(list)) {
			list.forEach((el) => highlightIngredientsInDom(el, highlightIngredients || []));
		} else {
			highlightIngredientsInDom(list, highlightIngredients || []);
		}
	}

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
	<div class="selectable-step-list">
		<ol class="recipe-mutex-select">
			{#each olChildren() as _, i}
				<li class="step-list-item">
					<div class="leaf step-flex">
						<span class="step-number">{olStart() + i}.</span>
						<div class="step-body">
							<RecipeLeaf childNodesOf={olChild(i)} asTag="div" />
						</div>
					</div>
				</li>
			{/each}
		</ol>
	</div>
{:else if kind == "p"}
	<!-- means steps is an array of P elements -->
	<div class="selectable-step-list recipe-mutex-p-list">
		{#each pList() as p}
			<div class="step-p-item">
				<div class="leaf">
					<div class="step-body">
						<RecipeLeaf childNodesOf={p} asTag="div" />
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.selectable-step-list {
		width: 100%;
	}

	ol.recipe-mutex-select,
	.recipe-mutex-p-list {
		display: flex;
		flex-direction: column;
		gap: 0;
		list-style: none !important;
		padding-inline-start: 0 !important;
		margin-inline-start: 0 !important;
		margin-block: var(--size-4-2) 0 !important;
		width: 100%;
	}

	li.step-list-item,
	.step-p-item {
		list-style: none !important;
		list-style-type: none !important;
		margin: 0 !important;
		padding: 0 !important;
		border-bottom: 1px solid var(--background-modifier-border);
		width: 100%;
	}

	li.step-list-item:last-child,
	.step-p-item:last-child {
		border-bottom: none;
	}

	li.step-list-item::marker {
		content: none !important;
		display: none !important;
	}

	/* Transparent 1px border in default state prevents layout jumping when selected */
	.leaf {
		background-color: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-m);
		padding: var(--size-4-3) var(--size-4-2);
		margin: 0;
		box-sizing: border-box;
		width: 100%;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.leaf.step-flex {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		gap: var(--size-4-2);
	}

	.step-number {
		flex-shrink: 0;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		min-width: 1.5em;
		user-select: none;
	}

	.step-body {
		flex: 1 1 0;
		min-width: 0;
		line-height: var(--line-height-normal, 1.5);
	}

	.step-body :global(.recipe-leaf),
	.step-body :global(p:first-child) {
		margin-block-start: 0 !important;
	}

	.step-body :global(.recipe-leaf),
	.step-body :global(p:last-child) {
		margin-block-end: 0 !important;
	}

	.step-body :global(.list-bullet) {
		display: none !important;
	}

	/* Inside Split-Steps (.step-card-body), the parent .step-card handles the row border & highlight */
	:global(.step-card-body) ol.recipe-mutex-select,
	:global(.step-card-body) .recipe-mutex-p-list {
		margin-block: 0 !important;
	}

	:global(.step-card-body) li.step-list-item,
	:global(.step-card-body) .step-p-item {
		border-bottom: none;
	}

	:global(.step-card-body) .leaf {
		padding: 0;
		background-color: transparent !important;
		border-color: transparent !important;
	}
</style>
