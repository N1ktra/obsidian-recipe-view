<script lang="ts">
	import { App, Component, MarkdownRenderer, TFile } from "obsidian";
	import store from "./store";
	import RecipeViewPlugin from "./main";

	export let thumbnailPath: string | undefined;
	export let title: string;
	export let frontmatter: object;
	export let singleColumn: boolean;
	export let app: App;
	export let file: TFile;
	export let view: Component;

	let plugin: RecipeViewPlugin;
	store.plugin.subscribe((p) => (plugin = p));

	function formatFrontmatterValue(key: string, value: any) {
		const coverKey = (plugin?.settings?.coverProperty || "cover").trim() || "cover";
		if (
			key === coverKey ||
			key === "position" ||
			key === "cssclasses" ||
			key === "cssclass"
		) {
			return undefined;
		}

		// See if it's a URL
		try {
			let url = new URL(value);
			return createEl("a", {
				href: url.toString(),
				text: url.host,
			}).outerHTML;
		} catch (e) {
			/* empty */
		}

		// See if it's tags
		if (key == "tags" && Array.isArray(value)) {
			return value
				.map((tag: string) => {
					let a = createEl("a", {
						cls: "tag",
						href: "#" + tag,
						text: "#" + tag,
					});
					a.setAttribute("target", "_blank");
					a.setAttribute("rel", "noopener");
					return a.outerHTML;
				})
				.join(" ");
		}

		if (typeof value === "number" || typeof value === "boolean") {
			return String(value);
		}

		if (typeof value === "string" || value instanceof String) {
			const markdownContainer = createSpan();
			MarkdownRenderer.render(
				app,
				value.toString(),
				markdownContainer,
				file.path,
				view
			);
			// Will just return what's in the first paragraph, so only really works with
			// a single line – but imo that's fine
			return markdownContainer.children.item(0)?.innerHTML || "-";
		}

		return undefined;
	}
</script>

<div class="title-block" class:single-column={singleColumn}>
	{#if thumbnailPath}
		<img
			class="thumbnail"
			src={thumbnailPath}
			alt="Thumbnail for {title} recipe"
		/>
	{/if}
	<div class="metadata">
		<div class="inline-title">{title}</div>
		<div class="frontmatter">
			{#if frontmatter}
				{#each Object.entries(frontmatter) as [key, value]}
					{#if formatFrontmatterValue(key, value)}
						<span class="title-block-property">
							<span class="key" data-property-key={key}
								>{key}</span
							>
							<span class="value" data-property-value={value}>
								<!-- eslint-disable -->
								{@html formatFrontmatterValue(key, value)}
							</span>
						</span>
					{/if}
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.title-block {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		gap: var(--size-4-4);
		margin-block-end: var(--size-4-6);
		width: 100%;
	}
	img.thumbnail {
		height: var(--thumbnail-size, 150px);
		width: var(--thumbnail-size, 150px);
		object-fit: cover;
		flex: 0 0 var(--thumbnail-size, 150px);
		flex-shrink: 0;
		margin: 0;
		border-radius: var(--radius-m, var(--radius-s));
	}
	.metadata {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.inline-title {
		margin-block-start: 0;
		margin-block-end: var(--size-4-2);
		overflow-wrap: break-word;
	}
	.frontmatter {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		justify-content: flex-start;
		gap: var(--size-2-1) var(--size-4-4);
	}
	.title-block-property {
		display: inline-block;
		font-size: var(--font-small);
	}
	.key {
		color: var(--text-accent);
		padding-right: var(--size-4-1);
		font-weight: 500;
	}

	/* Single-column & mobile layout: keep cover thumbnail on the left and title/properties on the right */
	.single-column.title-block,
	:global(body.is-mobile) .title-block {
		flex-direction: row;
		align-items: flex-start;
	}
	.single-column img.thumbnail,
	:global(body.is-mobile) img.thumbnail {
		height: var(--thumbnail-size-mobile, 90px);
		width: var(--thumbnail-size-mobile, 90px);
		flex: 0 0 var(--thumbnail-size-mobile, 90px);
		flex-shrink: 0;
		object-fit: cover;
		border-radius: var(--radius-m, var(--radius-s));
		margin: 0;
	}
</style>
