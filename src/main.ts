import {
	App,
	Keymap,
	MarkdownView,
	Platform,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	WorkspaceLeaf,
} from 'obsidian';

import RecipeCard from './components/RecipeCard.svelte';
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
			this.app.workspace.on("file-open", (file) => {
				if (file) {
					this.ensureReadingModeIfRecipe(file);
				}
				this.updateAllReadingViews();
			})
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.view instanceof MarkdownView && leaf.view.file) {
					this.ensureReadingModeIfRecipe(leaf.view.file, leaf);
				}
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
			const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
			const activeFile = this.app.workspace.getActiveFile();
			if (activeLeaf && activeFile) {
				this.ensureReadingModeIfRecipe(activeFile, activeLeaf);
			}
			this.updateAllReadingViews();
		});
	}

	async checkAndSwitchLeafToPreview(leaf: WorkspaceLeaf, file: TFile): Promise<boolean> {
		if (!(leaf.view instanceof MarkdownView) || leaf.view.file?.path !== file.path) {
			return false;
		}

		if (leaf.view.getMode() !== "preview") {
			await leaf.setViewState({
				...leaf.getViewState(),
				state: {
					...leaf.getViewState().state,
					mode: "preview",
				},
			});
			return true;
		}
		return false;
	}

	async ensureReadingModeIfRecipe(file: TFile, targetLeaf?: WorkspaceLeaf) {
		const autoSwitch = this.settings.autoSwitchToReadingMode ?? true;
		if (!this.settings.autoRenderReadingView || !autoSwitch) {
			return;
		}

		// 1. Check cache first
		let metadata = this.app.metadataCache.getFileCache(file);
		let isRecipe = isRecipeNote(
			metadata?.frontmatter,
			metadata?.headings,
			this.settings
		);

		// 2. If not yet cached (e.g. freshly loaded file), read frontmatter directly
		if (!isRecipe && (!metadata || !metadata.frontmatter)) {
			try {
				const content = await this.app.vault.cachedRead(file);
				// Quick regex check for recipe frontmatter markers or ingredients headings
				const hasRecipeFm = /(?:^|\n)(?:type:\s*(?:['"]?rezept['"]?|['"]?recipe['"]?)|recipe:\s*true|rezept:\s*true|servings:\s*\d+)/i.test(content);
				const hasIngHeader = /(?:^|\n)#{1,6}\s*(?:ingredients|zutaten)\b/i.test(content);
				if (hasRecipeFm || hasIngHeader) {
					isRecipe = true;
				}
			} catch (_err) {
				/* ignore */
			}
		}

		if (!isRecipe) {
			return;
		}

		const findMatchingLeaves = (): Array<WorkspaceLeaf> => {
			if (targetLeaf && targetLeaf.view instanceof MarkdownView && targetLeaf.view.file?.path === file.path) {
				return [targetLeaf];
			}
			const leaves: Array<WorkspaceLeaf> = [];
			this.app.workspace.iterateAllLeaves((l) => {
				if (l.view instanceof MarkdownView && l.view.file?.path === file.path) {
					leaves.push(l);
				}
			});
			return leaves;
		};

		// Immediate attempt: switch if leaf is already ready
		for (const leaf of findMatchingLeaves()) {
			void this.checkAndSwitchLeafToPreview(leaf, file);
		}

		// Secondary delayed attempt (handles mobile lifecycle / async leaf initialization)
		window.setTimeout(() => {
			for (const leaf of findMatchingLeaves()) {
				void this.checkAndSwitchLeafToPreview(leaf, file);
			}
		}, 120);
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

