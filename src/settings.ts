import { TimerTimeFormat } from "./timers";

export interface RecipeViewSettings {
	directionsHeaderRegex: string;
	ingredientsHeaderRegex: string;
	sideColumnRegex: string;
	treatH1AsFilename: boolean;
	renderUnicodeFractions: boolean;
	singleColumnMaxWidth: number;
	showBulletsTwoColumn: boolean;
	styleIngredientBox: boolean;
	coverProperty: string;
	servingsProperty: string;
	timerShortcutName: string;
	timerUrlTemplate: string;
	timerTimeFormat: TimerTimeFormat;
	autoRenderReadingView: boolean;
	recipeFilterKey: string;
	recipeFilterValue: string;
	requireCheckboxesForIngredients: boolean;
}

export type RecipeViewPluginSettings = RecipeViewSettings;

export const DEFAULT_DIRECTIONS_HEADER_REGEX =
	"directions|instructions|zubereitung|preparation|method|schritte|anleitung|steps";

export const DEFAULT_INGREDIENTS_HEADER_REGEX =
	"ingredients|zutaten|nutrition|nährwerte";

export const DEFAULT_SETTINGS: RecipeViewSettings = {
	directionsHeaderRegex: DEFAULT_DIRECTIONS_HEADER_REGEX,
	ingredientsHeaderRegex: DEFAULT_INGREDIENTS_HEADER_REGEX,
	sideColumnRegex: DEFAULT_INGREDIENTS_HEADER_REGEX,
	treatH1AsFilename: false,
	renderUnicodeFractions: true,
	singleColumnMaxWidth: 600,
	showBulletsTwoColumn: false,
	styleIngredientBox: true,
	coverProperty: "cover",
	servingsProperty: "servings",
	timerShortcutName: "StartTimer",
	timerUrlTemplate: "",
	timerTimeFormat: "de",
	autoRenderReadingView: true,
	recipeFilterKey: "type",
	recipeFilterValue: "rezept",
	requireCheckboxesForIngredients: true,
};
