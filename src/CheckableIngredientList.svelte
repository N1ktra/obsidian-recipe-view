<script lang="ts">
	import RecipeLeaf from "./RecipeLeaf.svelte";

	export let list: HTMLUListElement;
	export let bullets: boolean;

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
				<label>
					<!-- Persist checkbox state on component re-construction by setting
				data-checked on the underlying LI element from the rendered markdown.
				-->
					<input
						type="checkbox"
						checked={isChecked(i)}
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

	input[type="checkbox"] {
		opacity: 0;
		position: absolute;
		margin: 0;
		padding: 0;
		pointer-events: none;
	}

	label {
		position: relative;
		display: flex;
		align-items: baseline;
		cursor: pointer;
	}

	.leaf {
		flex: 1;
		min-width: 0;
	}

	.leaf :global(.recipe-leaf),
	.leaf :global(p) {
		display: inline;
		margin: 0;
	}

	.leaf :global(.list-bullet) {
		display: none !important;
	}

	input[type="checkbox"]:checked ~ .leaf {
		color: var(--text-muted);
		text-decoration: line-through;
	}

	input[type="checkbox"]:focus ~ .leaf {
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

	ul.bullets > li {
		list-style-type: square !important;
		margin-inline-start: var(--list-indent) !important;
	}

	:global(.column-side) ul.bullets > li {
		margin-inline-start: 0px !important;
	}

	:global(body.is-mobile) ul > li,
	:global(body.is-mobile) ul.bullets > li {
		list-style: none !important;
		list-style-type: none !important;
		margin-inline-start: 0 !important;
		padding-inline-start: 0 !important;
	}
</style>
