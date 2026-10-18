import {
	App,
	Keymap,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	WorkspaceLeaf,
	addIcon,
} from 'obsidian';

import { RecipeView, VIEW_TYPE_RECIPE } from './recipe-view';
import RecipeCard from './RecipeCard.svelte';
import { parseRecipeMarkdown } from './parsing';
import { isRecipeNote } from './detection';
import store from './store';
import { WHISK_SVG } from './whisk';
import { parseForTimers } from './timers';

export interface RecipeViewPluginSettings {
	sideColumnRegex: string;
	treatH1AsFilename: boolean;
	renderUnicodeFractions: boolean;
	singleColumnMaxWidth: number;
	showBulletsTwoColumn: boolean;
	coverProperty: string;
	servingsProperty: string;
	timerShortcutName: string;
	timerUrlTemplate: string;
	autoRenderReadingView: boolean;
	recipeFilterKey: string;
	recipeFilterValue: string;
	showRibbonIcon: boolean;
}

const DEFAULT_SETTINGS: RecipeViewPluginSettings = {
	sideColumnRegex: 'Ingredients|Zutaten|Nutrition|Nährwerte',
	treatH1AsFilename: false,
	renderUnicodeFractions: true,
	singleColumnMaxWidth: 600,
	showBulletsTwoColumn: false,
	coverProperty: 'cover',
	servingsProperty: 'servings',
	timerShortcutName: 'StartTimer',
	timerUrlTemplate: '',
	autoRenderReadingView: true,
	recipeFilterKey: 'type',
	recipeFilterValue: 'rezept',
	showRibbonIcon: false,
};

interface MountedReadingRecipe {
	card: RecipeCard;
	containerEl: HTMLElement;
	previewViewEl: HTMLElement;
	signature: string;
}

export default class RecipeViewPlugin extends Plugin {
	settings: RecipeViewPluginSettings = DEFAULT_SETTINGS;
	ribbonIconEl: HTMLElement | null = null;
	private mountedReadingViews = new Map<MarkdownView, MountedReadingRecipe>();

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_RECIPE, (leaf) => new RecipeView(leaf, this));

		this.registerMarkdownPostProcessor((el) => {
			parseForTimers(el, this.settings);
		});

		addIcon("recipe-whisk", WHISK_SVG);
		this.updateRibbonIcon();

		this.addCommand({
			id: "toggle-recipe-view",
			name: "Toggle between recipe card and markdown",
			checkCallback: (c) => this.toggleView(c),
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

		// This adds a settings tab so the user can configure various aspects of the plugin
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
		if (this.ribbonIconEl) {
			this.ribbonIconEl.remove();
			this.ribbonIconEl = null;
		}
	}

	updateRibbonIcon() {
		if (this.settings.showRibbonIcon) {
			if (!this.ribbonIconEl) {
				this.ribbonIconEl = this.addRibbonIcon(
					"recipe-whisk",
					"Toggle recipe view",
					() => {
						this.toggleView(false);
					}
				);
			}
		} else if (this.ribbonIconEl) {
			this.ribbonIconEl.remove();
			this.ribbonIconEl = null;
		}
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
			typeof view.data === "string"
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
			signature,
		});
	}

	cleanupReadingView(view: MarkdownView) {
		const mounted = this.mountedReadingViews.get(view);
		if (mounted) {
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

	toggleView(checking: boolean) {
		const activeLeaf = this.app.workspace.getMostRecentLeaf();

		if (activeLeaf?.getViewState().type == "markdown") {
			if (!checking) {
				this.setRecipeView(activeLeaf!);
			}
		} else if (activeLeaf?.getViewState().type == VIEW_TYPE_RECIPE) {
			if (!checking) {
				this.setMarkdownView(activeLeaf!);
			}
		} else {
			return false;
		}
		return true;
	}

	async setRecipeView(leaf: WorkspaceLeaf) {
		await leaf.setViewState({
			type: VIEW_TYPE_RECIPE,
			state: leaf.view.getState(),
			active: true,
			// @ts-ignore
			popstate: true,
		});
	}

	async setMarkdownView(leaf: WorkspaceLeaf) {
		await leaf.setViewState({
			type: "markdown",
			state: leaf.view.getState(),
			active: true,
			// @ts-ignore
			popstate: true,
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateAllReadingViews();
	}
}

class RecipeViewSettingsTab extends PluginSettingTab {
	plugin: RecipeViewPlugin;

	constructor(app: App, plugin: RecipeViewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName("Reading View integration").setHeading();

		new Setting(containerEl)
			.setName("Auto-render in Reading View")
			.setDesc(
				"Automatically render matching recipe notes as interactive Recipe Cards inside Obsidian's native Reading View (while Source Mode and Live Preview remain pure Markdown)."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoRenderReadingView)
					.onChange(async (value) => {
						this.plugin.settings.autoRenderReadingView = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Frontmatter filter key")
			.setDesc(
				'Frontmatter property key used to identify recipe notes in Reading View (e.g. "type"). Notes with "recipe: true", "servings", or an "Ingredients"/"Zutaten" heading are also detected automatically.'
			)
			.addText((text) =>
				text
					.setPlaceholder("type")
					.setValue(this.plugin.settings.recipeFilterKey)
					.onChange(async (value) => {
						this.plugin.settings.recipeFilterKey = value.trim() || "type";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Frontmatter filter value")
			.setDesc(
				'Expected value for the frontmatter filter key (case-insensitive, e.g. "rezept"). Supports comma-separated values (e.g. "rezept, recipe").'
			)
			.addText((text) =>
				text
					.setPlaceholder("rezept")
					.setValue(this.plugin.settings.recipeFilterValue)
					.onChange(async (value) => {
						this.plugin.settings.recipeFilterValue = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Show "Toggle recipe view" ribbon icon')
			.setDesc(
				"Optional: Show the dedicated whisk icon in the left ribbon to manually toggle the standalone Recipe View."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showRibbonIcon)
					.onChange(async (value) => {
						this.plugin.settings.showRibbonIcon = value;
						this.plugin.updateRibbonIcon();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Recipe parsing").setHeading();

		new Setting(containerEl)
			.setName("Side column regex")
			.setDesc(
				"A regular expression for headings of sections to pull to the side column"
			)
			.addText((text) =>
				text
					.setPlaceholder("Ingredients|Zutaten|Nutrition|Nährwerte")
					.setValue(this.plugin.settings.sideColumnRegex)
					.onChange(async (value) => {
						this.plugin.settings.sideColumnRegex = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Treat level one heading as filename")
			.setDesc(
				'If turned on, then in recipes that have a "# Level one heading", there should only be one – and it will be used as the recipe title. Turn this on if you usually start your notes with a level one heading that matches the filename, and turn it off if you would ever use headings like "# Ingredients", "# Directons", etc.'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.treatH1AsFilename)
					.onChange(async (value) => {
						this.plugin.settings.treatH1AsFilename = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Cover image frontmatter property")
			.setDesc(
				'Name of the frontmatter property that specifies the cover/hero image (e.g. "Pasted image ...png", wikilink, or URL). If empty or missing in a note, falls back to the first image in the note text.'
			)
			.addText((text) =>
				text
					.setPlaceholder("cover")
					.setValue(this.plugin.settings.coverProperty)
					.onChange(async (value) => {
						this.plugin.settings.coverProperty = value.trim() || "cover";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Servings frontmatter property")
			.setDesc(
				"Name of the frontmatter property for the default/base number of servings (defaults to 1 if not defined in frontmatter)."
			)
			.addText((text) =>
				text
					.setPlaceholder("servings")
					.setValue(this.plugin.settings.servingsProperty)
					.onChange(async (value) => {
						this.plugin.settings.servingsProperty =
							value.trim() || "servings";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("iOS Shortcut timers (@timer{...})")
			.setDesc(
				"Configure how inline @timer{minutes} and @timer{minutes|Label} buttons launch iOS Shortcuts."
			)
			.setHeading();

		new Setting(containerEl)
			.setName("Shortcut name")
			.setDesc("Name of the iOS Shortcut to trigger when clicking a timer button.")
			.addText((text) =>
				text
					.setPlaceholder("StartTimer")
					.setValue(this.plugin.settings.timerShortcutName)
					.onChange(async (value) => {
						this.plugin.settings.timerShortcutName =
							value.trim() || "StartTimer";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Custom URL template (optional)")
			.setDesc(
				"Optional custom URL template. Placeholders: <SHORTCUT_NAME>, <MINUTEN>, <URL_ENCODED_LABEL>, [|<URL_ENCODED_LABEL>]. Leave empty to use the default iOS Shortcuts URL scheme."
			)
			.addText((text) =>
				text
					.setPlaceholder(
						"shortcuts://run-shortcut?name=<SHORTCUT_NAME>&input=text&text=<MINUTEN>[|<URL_ENCODED_LABEL>]"
					)
					.setValue(this.plugin.settings.timerUrlTemplate)
					.onChange(async (value) => {
						this.plugin.settings.timerUrlTemplate = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Recipe card appearance")
			.setDesc("More options are available using the style settings plugin.")
			.setHeading();

		new Setting(containerEl)
			.setName("Render fractions in quantities as unicode")
			.setDesc(
				'If on, fractions will appear like e.g. "½ cup". If off, they will appear like e.g. "1/2 cup".'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.renderUnicodeFractions)
					.onChange(async (value) => {
						this.plugin.settings.renderUnicodeFractions = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Display ingredients in two-column view with bullets")
			.setDesc(
				"If turned on, will display bullets for all checkable ingredient lists – not just in single-column view."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showBulletsTwoColumn)
					.onChange(async (value) => {
						this.plugin.settings.showBulletsTwoColumn = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Maximum pixel width for single-column view")
			.setDesc(
				"Recipe cards shown wider than this view will switch to two-column layout."
			)
			.addSlider((slider) =>
				slider
					.setDynamicTooltip()
					.setLimits(50, 2000, 10)
					.setValue(this.plugin.settings.singleColumnMaxWidth)
					.onChange(async (value) => {
						this.plugin.settings.singleColumnMaxWidth = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
