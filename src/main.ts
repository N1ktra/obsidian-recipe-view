import {
	App,
	Keymap,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	WorkspaceLeaf,
} from 'obsidian';

import RecipeCard from './RecipeCard.svelte';
import { parseRecipeMarkdown } from './parsing';
import { isRecipeNote } from './detection';
import store from './store';
import { parseForTimers, TimerTimeFormat } from './timers';
import {
	RecipeViewSettings,
	RecipeViewPluginSettings,
	DEFAULT_SETTINGS,
} from './settings';
import { RecipeViewSettingsTab } from './settingsTab';

export type {
	RecipeViewSettings,
	RecipeViewPluginSettings,
};
export {
	DEFAULT_SETTINGS,
	RecipeViewSettingsTab,
};

interface MountedReadingRecipe {
	card: RecipeCard;
	containerEl: HTMLElement;
	previewViewEl: HTMLElement;
	onScrollCapture: (e: Event) => void;
	signature: string;
}

export default class RecipeViewPlugin extends Plugin {
	settings: RecipeViewPluginSettings = DEFAULT_SETTINGS;
	private mountedReadingViews = new Map<MarkdownView, MountedReadingRecipe>();

	async onload() {
		await this.loadSettings();

		this.registerMarkdownPostProcessor((el) => {
			parseForTimers(el, this.settings);
		});

		// Automatically render Recipe Cards inside native Reading View when a note matches recipe criteria
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.updateAllReadingViews();
			})
		);
		this.registerEvent(
			this.app.workspace.on("file-open", () => {
				this.updateAllReadingViews();
			})
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.updateAllReadingViews();
			})
		);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				this.onMetadataChanged(file);
			})
		);

		this.addSettingTab(new RecipeViewSettingsTab(this.app, this));

		// Load style settings variables
		this.app.workspace.trigger("parse-style-settings");

		store.plugin.set(this);

		this.app.workspace.onLayoutReady(() => {
			this.updateAllReadingViews();
		});
	}

	onunload() {
		this.cleanupAllReadingViews();
	}

	onMetadataChanged(changedFile: TFile) {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (
				leaf.view instanceof MarkdownView &&
				leaf.view.file?.path === changedFile.path
			) {
				this.updateReadingViewForLeaf(leaf);
			}
		});
	}

	updateAllReadingViews() {
		const activeMarkdownViews = new Set<MarkdownView>();
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				activeMarkdownViews.add(leaf.view);
				this.updateReadingViewForLeaf(leaf);
			}
		});

		// Clean up any views that were closed
		for (const [view] of this.mountedReadingViews.entries()) {
			if (!activeMarkdownViews.has(view)) {
				this.cleanupReadingView(view);
			}
		}
	}

	async updateReadingViewForLeaf(leaf: WorkspaceLeaf) {
		if (!(leaf.view instanceof MarkdownView)) {
			return;
		}

		const view = leaf.view;
		const file = view.file;
		const isReadingMode = view.getMode() === "preview";

		if (!isReadingMode || !file || !this.settings.autoRenderReadingView) {
			this.cleanupReadingView(view);
			return;
		}

		const metadata = this.app.metadataCache.getFileCache(file);
		const isRecipe = isRecipeNote(
			metadata?.frontmatter,
			metadata?.headings,
			this.settings
		);

		if (!isRecipe) {
			this.cleanupReadingView(view);
			return;
		}

		const previewViewEl = view.containerEl.querySelector(
			".markdown-preview-view"
		) as HTMLElement | null;
		if (!previewViewEl) {
			return;
		}

		const text =
			typeof view.data === "string" && view.data.length > 0
				? view.data
				: await this.app.vault.cachedRead(file);

		const signature = JSON.stringify({
			path: file.path,
			text,
			frontmatter: metadata?.frontmatter ?? null,
			settings: this.settings,
		});

		const existing = this.mountedReadingViews.get(view);
		if (
			existing &&
			existing.signature === signature &&
			previewViewEl.contains(existing.containerEl)
		) {
			previewViewEl.classList.add("is-recipe-view-active");
			return;
		}

		// Clean up old instance before mounting updated recipe card
		this.cleanupReadingView(view);

		previewViewEl.classList.add("is-recipe-view-active");
		const recipeContainerEl = previewViewEl.createDiv({
			cls: "recipe-view-reading-container",
		});

		// Prevent Obsidian's internal MarkdownPreviewRenderer virtualizer from
		// recalculating hidden section heights on scroll and jumping scrollTop back up
		const onScrollCapture = (e: Event) => {
			if (previewViewEl.classList.contains("is-recipe-view-active")) {
				e.stopImmediatePropagation();
			}
		};
		previewViewEl.addEventListener("scroll", onScrollCapture, {
			capture: true,
			passive: true,
		});

		// Delegate internal links and tags inside the Reading View recipe container
		recipeContainerEl.on("mouseover", "a.internal-link", (e, el) => {
			if (!view.file) return;
			this.app.workspace.trigger("hover-link", {
				event: e,
				source: "preview",
				hoverParent: view,
				el,
				linktext: el.getAttr("href"),
				sourcePath: view.file.path,
			});
		});
		recipeContainerEl.on("click", "a.internal-link", (e, el) => {
			if (!view.file) return;
			const href = el.getAttr("href");
			if (!href) return;
			const inNewLeaf = Keymap.isModEvent(e);
			this.app.workspace.openLinkText(href, view.file.path, inNewLeaf);
		});
		recipeContainerEl.on("click", "a.tag", (_e, el) => {
			const globalSearch = (
				this.app as unknown as {
					internalPlugins?: {
						getPluginById?: (id: string) => {
							instance?: { openGlobalSearch?: (q: string) => void };
						};
					};
				}
			).internalPlugins?.getPluginById?.("global-search");
			globalSearch?.instance?.openGlobalSearch?.(`tag:${el.getAttr("href")}`);
		});

		const parsedRecipe = parseRecipeMarkdown(
			this,
			text,
			file.path,
			view,
			metadata
		);

		const card = new RecipeCard({
			target: recipeContainerEl,
			props: {
				parsedRecipe,
				file,
				metadata: metadata || undefined,
				view,
			},
		});

		this.mountedReadingViews.set(view, {
			card,
			containerEl: recipeContainerEl,
			previewViewEl,
			onScrollCapture,
			signature,
		});
	}

	cleanupReadingView(view: MarkdownView) {
		const mounted = this.mountedReadingViews.get(view);
		if (mounted) {
			mounted.previewViewEl.removeEventListener(
				"scroll",
				mounted.onScrollCapture,
				{ capture: true }
			);
			mounted.card.$destroy();
			mounted.containerEl.remove();
			mounted.previewViewEl.classList.remove("is-recipe-view-active");
			this.mountedReadingViews.delete(view);
		} else {
			const previewViewEl = view.containerEl?.querySelector(
				".markdown-preview-view"
			);
			previewViewEl?.classList.remove("is-recipe-view-active");
			previewViewEl
				?.querySelectorAll(".recipe-view-reading-container")
				.forEach((el) => el.remove());
		}
	}

	cleanupAllReadingViews() {
		for (const [view] of this.mountedReadingViews.entries()) {
			this.cleanupReadingView(view);
		}
		this.mountedReadingViews.clear();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateAllReadingViews();
	}
}

