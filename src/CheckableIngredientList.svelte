<script lang="ts">
	import RecipeLeaf from "./RecipeLeaf.svelte";
	import { sanitizeIngredientListElement } from "./parsing";

	export let list: HTMLUListElement;
	export let bullets: boolean;

	$: if (list) {
		sanitizeIngredientListElement(list);
	}

	function isChecked(index: number): boolean {
		return (
			list.children.item(index)?.getAttr("data-checked") == "true" ||
			false
		);
	}

	function changeChecked(index: number, e: Event) {
		list.children
			.item(index)
			?.setAttr(
				"data-checked",
				(e.target as HTMLInputElement).checked ? "true" : "false",
			);
	}

	function itemAt(index: number): HTMLElement {
		return (list.children.item(index) as HTMLLIElement)!;
	}
</script>

<div>
	<ul class:bullets>
		{#each list.children as _, i}
			<li>
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
				<label on:click|stopPropagation>
					<!-- Persist checkbox state on component re-construction by setting
				data-checked on the underlying LI element from the rendered markdown.
				-->
					<input
						type="checkbox"
						class="task-list-item-checkbox recipe-ingredient-checkbox"
						checked={isChecked(i)}
						on:click|stopPropagation
						on:change={(e) => changeChecked(i, e)}
					/>
					<div class="leaf">
						<RecipeLeaf childNodesOf={itemAt(i)} asTag="div" />
					</div>
				</label>
			</li>
		{/each}
	</ul>
</div>

<style>
	ul {
		list-style: none !important;
		padding-inline-start: 0 !important;
		margin-inline-start: 0 !important;
	}

	label {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: var(--size-4-2);
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	input[type="checkbox"].recipe-ingredient-checkbox {
		position: relative;
		opacity: 1;
		pointer-events: auto;
		flex-shrink: 0;
		margin-block-start: 0.22em !important;
		margin-block-end: 0 !important;
		margin-inline: 0 !important;
		cursor: pointer;
	}

	.leaf {
		flex: 1;
		min-width: 0;
		line-height: var(--line-height-normal, 1.5);
		transition: opacity 0.15s ease, color 0.15s ease;
	}

	.leaf :global(.recipe-leaf),
	.leaf :global(p) {
		display: inline;
		margin: 0;
	}

	.leaf :global(.list-bullet),
	.leaf :global(input[type="checkbox"]) {
		display: none !important;
	}

	input[type="checkbox"]:checked ~ .leaf {
		color: var(--text-muted);
		text-decoration: line-through;
		opacity: 0.55;
	}

	input[type="checkbox"]:focus-visible ~ .leaf {
		color: var(--text-accent-hover);
	}

	ul > li {
		list-style: none !important;
		list-style-type: none !important;
		margin-block: var(--list-spacing);
		margin-inline-start: 0 !important;
		padding-inline-start: 0 !important;
	}

	ul > li::marker {
		content: none !important;
		display: none !important;
	}
</style>
