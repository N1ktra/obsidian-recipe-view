import { App, PluginSettingTab, Setting } from "obsidian";
import type RecipeViewPlugin from "./main";
import { TimerTimeFormat } from "./timers";
import {
	DEFAULT_DIRECTIONS_HEADER_REGEX,
	DEFAULT_INGREDIENTS_HEADER_REGEX,
} from "./settings";

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
				"When opening a note that is recognized as a recipe, automatically switch the pane to Reading View (on both Desktop and Mobile)."
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
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_DIRECTIONS_HEADER_REGEX)
					.setValue(
						this.plugin.settings.directionsHeaderRegex ||
							DEFAULT_DIRECTIONS_HEADER_REGEX
					)
					.onChange(async (value) => {
						const trimmed = value.trim();
						try {
							new RegExp(trimmed, "i");
							this.plugin.settings.directionsHeaderRegex = trimmed;
						} catch {
							this.plugin.settings.directionsHeaderRegex =
								DEFAULT_DIRECTIONS_HEADER_REGEX;
						}
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Ingredients header regex")
			.setDesc(
				"Regular expression to identify ingredients headings and subgroups (case-insensitive)."
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_INGREDIENTS_HEADER_REGEX)
					.setValue(
						this.plugin.settings.ingredientsHeaderRegex ||
							this.plugin.settings.sideColumnRegex ||
							DEFAULT_INGREDIENTS_HEADER_REGEX
					)
					.onChange(async (value) => {
						const trimmed = value.trim();
						try {
							new RegExp(trimmed, "i");
							this.plugin.settings.ingredientsHeaderRegex = trimmed;
							this.plugin.settings.sideColumnRegex = trimmed;
						} catch {
							this.plugin.settings.ingredientsHeaderRegex =
								DEFAULT_INGREDIENTS_HEADER_REGEX;
							this.plugin.settings.sideColumnRegex =
								DEFAULT_INGREDIENTS_HEADER_REGEX;
						}
						await this.plugin.saveSettings();
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
			.setName("Style ingredients column as card box")
			.setDesc(
				"Render the side ingredients column with a subtle card background and rounded corners to visually separate it from the directions."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.styleIngredientBox)
					.onChange(async (value) => {
						this.plugin.settings.styleIngredientBox = value;
						await this.plugin.saveSettings();
					})
			);

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
