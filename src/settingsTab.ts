import { App, PluginSettingTab, Setting } from "obsidian";
import type RecipeViewPlugin from "./main";
import { TimerTimeFormat } from "./timers";
import {
	DEFAULT_DIRECTIONS_HEADER_REGEX,
	DEFAULT_INGREDIENTS_HEADER_REGEX,
	DEFAULT_TIMER_URL_TEMPLATE,
} from "./settings";
import { cleanRegexPattern } from "./domUtils";

export class RecipeViewSettingsTab extends PluginSettingTab {
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
			.setName("Automatically switch to Reading View for recipes")
			.setDesc(
				"When opening a note that is recognized as a recipe, automatically switch the pane to Reading View (and restore your vault's default view mode when switching to a non-recipe note)."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoSwitchToReadingMode ?? true)
					.onChange(async (value) => {
						this.plugin.settings.autoSwitchToReadingMode = value;
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
			.setName("Header recognition")
			.setDesc("Configure regular expressions used to identify sections in recipe notes.")
			.setHeading();

		new Setting(containerEl)
			.setName("Directions header regex")
			.setDesc(
				"Regular expression to identify the directions / preparation heading (case-insensitive)."
			)
			.setClass("recipe-view-setting-wide")
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder(DEFAULT_DIRECTIONS_HEADER_REGEX)
					.setValue(
						this.plugin.settings.directionsHeaderRegex ||
							DEFAULT_DIRECTIONS_HEADER_REGEX
					)
					.onChange(async (value) => {
						const trimmed = value.trim();
						try {
							const pattern = cleanRegexPattern(trimmed);
							new RegExp(pattern || trimmed, "i");
							this.plugin.settings.directionsHeaderRegex = trimmed;
						} catch {
							this.plugin.settings.directionsHeaderRegex =
								DEFAULT_DIRECTIONS_HEADER_REGEX;
						}
						await this.plugin.saveSettings();
					});
				textArea.inputEl.rows = 4;
				textArea.inputEl.spellcheck = false;
			})
			.addExtraButton((btn) =>
				btn
					.setIcon("reset")
					.setTooltip("Restore default directions regex")
					.onClick(async () => {
						this.plugin.settings.directionsHeaderRegex =
							DEFAULT_DIRECTIONS_HEADER_REGEX;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName("Ingredients header regex")
			.setDesc(
				"Regular expression to identify ingredients headings and subgroups (case-insensitive)."
			)
			.setClass("recipe-view-setting-wide")
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder(DEFAULT_INGREDIENTS_HEADER_REGEX)
					.setValue(
						this.plugin.settings.ingredientsHeaderRegex ||
							this.plugin.settings.sideColumnRegex ||
							DEFAULT_INGREDIENTS_HEADER_REGEX
					)
					.onChange(async (value) => {
						const trimmed = value.trim();
						try {
							const pattern = cleanRegexPattern(trimmed);
							new RegExp(pattern || trimmed, "i");
							this.plugin.settings.ingredientsHeaderRegex = trimmed;
							this.plugin.settings.sideColumnRegex = trimmed;
						} catch {
							this.plugin.settings.ingredientsHeaderRegex =
								DEFAULT_INGREDIENTS_HEADER_REGEX;
							this.plugin.settings.sideColumnRegex =
								DEFAULT_INGREDIENTS_HEADER_REGEX;
						}
						await this.plugin.saveSettings();
					});
				textArea.inputEl.rows = 4;
				textArea.inputEl.spellcheck = false;
			})
			.addExtraButton((btn) =>
				btn
					.setIcon("reset")
					.setTooltip("Restore default ingredients regex")
					.onClick(async () => {
						this.plugin.settings.ingredientsHeaderRegex =
							DEFAULT_INGREDIENTS_HEADER_REGEX;
						this.plugin.settings.sideColumnRegex =
							DEFAULT_INGREDIENTS_HEADER_REGEX;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl).setName("Recipe parsing").setHeading();

		new Setting(containerEl)
			.setName("Require checkboxes for ingredients")
			.setDesc(
				"When enabled, only list items with checkboxes (- [ ] / - [x]) are treated as ingredients. Regular bullet points (- or *) in instructions remain step instructions."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.requireCheckboxesForIngredients ??
							true
					)
					.onChange(async (value) => {
						this.plugin.settings.requireCheckboxesForIngredients =
							value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Treat level one heading as filename")
			.setDesc(
				'If turned on, then in recipes that have a "# Level one heading", there should only be one – and it will be used as the recipe title. Turn this on if you usually start your notes with a level one heading that matches the filename, and turn it off if you would ever use headings like "# Ingredients", "# Directions", etc.'
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
			.setName("iOS / macOS Shortcut timers (@timer{...})")
			.setDesc(
				createFragment((frag) => {
					frag.appendText(
						"Trigger kitchen timers in Apple Shortcuts directly from your recipe instructions. "
					);
					frag.createEl("br");
					frag.appendText("Syntax: ");
					frag.createEl("code", { text: "@timer{15}" });
					frag.appendText(" or ");
					frag.createEl("code", { text: "@timer{30|Rest dough}" });
					frag.appendText(
						" anywhere in recipe steps creates an interactive button like "
					);
					frag.createEl("span", {
						text: "⏱ 30 min (Rest dough)",
						cls: "recipe-timer-preview-badge",
					});
					frag.appendText(
						" that launches your timer shortcut with duration and label pre-filled."
					);
				})
			)
			.setHeading();

		new Setting(containerEl)
			.setName("Shortcut name")
			.setDesc(
				"The exact name of the shortcut in your Apple Shortcuts app (e.g. 'StartTimer'). This value replaces the <SHORTCUT_NAME> placeholder in the URL template below."
			)
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
			.setName("Shortcut URL template")
			.setDesc(
				createFragment((frag) => {
					frag.appendText(
						"URL scheme triggered when clicking a timer button. Placeholders are dynamically replaced with values from the timer tag:"
					);
					const ul = frag.createEl("ul", {
						cls: "recipe-view-setting-desc-list",
					});
					const li1 = ul.createEl("li");
					li1.createEl("code", { text: "<SHORTCUT_NAME>" });
					li1.appendText(
						": replaced with the Shortcut name configured above."
					);

					const li2 = ul.createEl("li");
					li2.createEl("code", { text: "<MINUTES>" });
					li2.appendText(
						": exact numeric duration in minutes (e.g. 15, 90) parsed from @timer{...}."
					);

					const li3 = ul.createEl("li");
					li3.createEl("code", { text: "[|<LABEL>]" });
					li3.appendText(
						": appends |Label if provided (e.g. @timer{30|Rest dough}), or omitted if no label is present."
					);

					const li4 = ul.createEl("li");
					li4.createEl("code", { text: "<LABEL>" });
					li4.appendText(
						": URL-encoded label description (e.g. Rest%20dough)."
					);

					const note = frag.createEl("div", {
						cls: "recipe-view-setting-desc-hint",
					});
					note.appendText(
						"Your Apple Shortcut receives this text parameter as input to start the kitchen timer."
					);
				})
			)
			.setClass("recipe-view-setting-wide")
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder(DEFAULT_TIMER_URL_TEMPLATE)
					.setValue(
						this.plugin.settings.timerUrlTemplate ||
							DEFAULT_TIMER_URL_TEMPLATE
					)
					.onChange(async (value) => {
						this.plugin.settings.timerUrlTemplate = value.trim();
						await this.plugin.saveSettings();
					});
				textArea.inputEl.rows = 2;
				textArea.inputEl.spellcheck = false;
			})
			.addExtraButton((btn) =>
				btn
					.setIcon("reset")
					.setTooltip("Restore default URL template")
					.onClick(async () => {
						this.plugin.settings.timerUrlTemplate =
							DEFAULT_TIMER_URL_TEMPLATE;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName("Timer display format")
			.setDesc(
				"Choose how durations >= 60 minutes are formatted on timer buttons (the iOS Shortcut always receives the exact numeric minutes)."
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("de", "Deutsch (30 Min / 1 Std. / 1 Std. 30 Min)")
					.addOption("en", "English (30 min / 1 hr / 1 hr 30 min)")
					.addOption("compact", "Compact (30m / 1h / 1h 30m)")
					.addOption("minutes", "Minutes only (90 Min / 120 Min)")
					.setValue(this.plugin.settings.timerTimeFormat)
					.onChange(async (value) => {
						this.plugin.settings.timerTimeFormat =
							value as TimerTimeFormat;
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
			.setName("Maximum pixel width for single-column view")
			.setDesc(
				"Recipe cards wider than this pixel width (on desktop and tablet) will switch to two-column layout. Smartphones always remain in single-column layout."
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
