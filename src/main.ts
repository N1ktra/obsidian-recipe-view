import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, addIcon } from 'obsidian';

import { RecipeView, VIEW_TYPE_RECIPE } from './recipe-view';
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
}

const DEFAULT_SETTINGS: RecipeViewPluginSettings = {
	sideColumnRegex: 'Ingredients|Nutrition',
	treatH1AsFilename: false,
	renderUnicodeFractions: true,
	singleColumnMaxWidth: 600,
	showBulletsTwoColumn: false,
	coverProperty: 'cover',
	servingsProperty: 'servings',
	timerShortcutName: 'StartTimer',
	timerUrlTemplate: '',
}

export default class RecipeViewPlugin extends Plugin {
	settings: RecipeViewPluginSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_RECIPE, (leaf) => new RecipeView(leaf, this));

		this.registerMarkdownPostProcessor((el) => {
			parseForTimers(el, this.settings);
		});

		addIcon("recipe-whisk", WHISK_SVG)
		this.addRibbonIcon("recipe-whisk", "Toggle recipe view", () => {
			this.toggleView(false);
		});

		this.addCommand({
			id: "toggle-recipe-view",
			name: "Toggle between recipe card and markdown",
			checkCallback: (c) => this.toggleView(c),
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new RecipeViewSettingsTab(this.app, this));

		// Load style settings variables
		this.app.workspace.trigger("parse-style-settings");

		store.plugin.set(this);
	}

	onunload() {

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
		})
	}

	async setMarkdownView(leaf: WorkspaceLeaf) {
		await leaf.setViewState({
			type: "markdown",
			state: leaf.view.getState(),
			active: true,
			// @ts-ignore
			popstate: true,
		})
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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

		new Setting(containerEl).setName("Recipe parsing").setHeading()

		new Setting(containerEl)
			.setName('Side column regex')
			.setDesc('A regular expression for headings of sections to pull to the side column')
			.addText(text => text
				.setPlaceholder('Ingredients|Nutrition')
				.setValue(this.plugin.settings!.sideColumnRegex)
				.onChange(async (value) => {
					this.plugin.settings!.sideColumnRegex = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Treat level one heading as filename')
			.setDesc('If turned on, then in recipes that have a "# Level one heading", there should only be one – and it will be used as the recipe title. Turn this on if you usually start your notes with a level one heading that matches the filename, and turn it off if you would ever use headings like "# Ingredients", "# Directons", etc.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings!.treatH1AsFilename)
				.onChange(async (value) => {
					this.plugin.settings!.treatH1AsFilename = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Cover image frontmatter property')
			.setDesc('Name of the frontmatter property that specifies the cover/hero image (e.g. "Pasted image ...png", wikilink, or URL). If empty or missing in a note, falls back to the first image in the note text.')
			.addText(text => text
				.setPlaceholder('cover')
				.setValue(this.plugin.settings!.coverProperty)
				.onChange(async (value) => {
					this.plugin.settings!.coverProperty = value.trim() || 'cover';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Servings frontmatter property')
			.setDesc('Name of the frontmatter property for the default/base number of servings (defaults to 1 if not defined in frontmatter).')
			.addText(text => text
				.setPlaceholder('servings')
				.setValue(this.plugin.settings!.servingsProperty)
				.onChange(async (value) => {
					this.plugin.settings!.servingsProperty = value.trim() || 'servings';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("iOS Shortcut timers (@timer{...})")
			.setDesc("Configure how inline @timer{minutes} and @timer{minutes|Label} buttons launch iOS Shortcuts.")
			.setHeading()

		new Setting(containerEl)
			.setName('Shortcut name')
			.setDesc('Name of the iOS Shortcut to trigger when clicking a timer button.')
			.addText(text => text
				.setPlaceholder('StartTimer')
				.setValue(this.plugin.settings!.timerShortcutName)
				.onChange(async (value) => {
					this.plugin.settings!.timerShortcutName = value.trim() || 'StartTimer';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Custom URL template (optional)')
			.setDesc('Optional custom URL template. Placeholders: <SHORTCUT_NAME>, <MINUTEN>, <URL_ENCODED_LABEL>, [|<URL_ENCODED_LABEL>]. Leave empty to use the default iOS Shortcuts URL scheme.')
			.addText(text => text
				.setPlaceholder('shortcuts://run-shortcut?name=<SHORTCUT_NAME>&input=text&text=<MINUTEN>[|<URL_ENCODED_LABEL>]')
				.setValue(this.plugin.settings!.timerUrlTemplate)
				.onChange(async (value) => {
					this.plugin.settings!.timerUrlTemplate = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Recipe card appearance")
			.setDesc("More options are available using the style settings plugin.")
			.setHeading()

		new Setting(containerEl)
			.setName('Render fractions in quantities as unicode')
			.setDesc('If on, fractions will appear like e.g. "½ cup". If off, they will appear like e.g. "1/2 cup".')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings!.renderUnicodeFractions)
				.onChange(async (value) => {
					this.plugin.settings!.renderUnicodeFractions = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Display ingredients in two-column view with bullets')
			.setDesc('If turned on, will display bullets for all checkable ingredient lists – not just in single-column view.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings!.showBulletsTwoColumn)
				.onChange(async (value) => {
					this.plugin.settings!.showBulletsTwoColumn = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Maximum pixel width for single-column view')
			.setDesc('Recipe cards shown wider than this view will switch to two-column layout.')
			.addSlider(slider => slider
				.setDynamicTooltip()
				.setLimits(50, 2000, 10)
				.setValue(this.plugin.settings!.singleColumnMaxWidth)
				.onChange(async (value) => {
					this.plugin.settings!.singleColumnMaxWidth = value;
					await this.plugin.saveSettings()
				}))
	}
}
