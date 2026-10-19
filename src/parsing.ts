import RecipeViewPlugin from "./main";
import { CachedMetadata, Component, MarkdownRenderer } from "obsidian";
import store from "./store";
import { get, writable } from "svelte/store";
import Fraction from "fraction.js";
import {
    LEADING_CHECKBOX_REGEX,
    ParsedCheckboxText,
    stripLeadingCheckboxSyntax,
} from "./quantities";
import {
    parseForTimers,
    matchIngredientTags,
    extractMarkedIngredientsFromText,
    extractAndCleanIngredientListDom,
    sortHighlightIngredients,
    matchHighlightedIngredientsInStep,
    highlightIngredientsInDom,
    formatDuration,
    calculateTotalTimerMinutes,
    parseFrontmatterTimeMinutes,
} from "./timers";
import {
    ParsedRecipe,
    ParsedRecipeComponent,
    ParsedRecipeSection,
    ParsedRecipeStep,
} from "./types";
import {
    isListItemWithCheckbox,
    sanitizeIngredientListElement,
    getDirectionsRegex,
    getIngredientsRegex,
    isDirectionsHeaderElement,
    isIngredientsHeaderElement,
    normalizeMarkdownStepListSpacing,
    extractTrailingInstructionsFromList,
} from "./domUtils";
import {
    parseForQty,
    injectQuantities,
    injectHighlightedIngredients,
} from "./ingredientProcessor";
import { resolveCoverImage } from "./media";
import { buildUnifiedRecipeStructure } from "./recipeStructure";

export {
    formatDuration,
    calculateTotalTimerMinutes,
    parseFrontmatterTimeMinutes,
    matchIngredientTags,
    extractMarkedIngredientsFromText,
    extractAndCleanIngredientListDom,
    sortHighlightIngredients,
    matchHighlightedIngredientsInStep,
    highlightIngredientsInDom,
    LEADING_CHECKBOX_REGEX,
    stripLeadingCheckboxSyntax,
    parseForQty,
    injectQuantities,
    resolveCoverImage,
    isListItemWithCheckbox,
    sanitizeIngredientListElement,
    getDirectionsRegex,
    getIngredientsRegex,
    isDirectionsHeaderElement,
    isIngredientsHeaderElement,
    normalizeMarkdownStepListSpacing,
    extractTrailingInstructionsFromList,
    buildUnifiedRecipeStructure,
};
export type {
    ParsedCheckboxText,
    ParsedRecipe,
    ParsedRecipeComponent,
    ParsedRecipeSection,
    ParsedRecipeStep,
};

export function parseRecipeMarkdown(
    plugin: RecipeViewPlugin,
    text: string,
    path: string,
    component: Component,
    metadata?: CachedMetadata | null
): ParsedRecipe {
    const frontmatterCover = resolveCoverImage(plugin, metadata?.frontmatter, path);
    const textTimerMinutes = calculateTotalTimerMinutes(text);
    const frontmatterDesc =
        typeof metadata?.frontmatter?.description === "string"
            ? (metadata.frontmatter.description as string).trim()
            : "";

    const result: ParsedRecipe = {
        title: "",
        description: frontmatterDesc,
        thumbnailPath: frontmatterCover,
        sections: [],
        globalIngredients: [],
        steps: [],
        hasStepIngredients: false,
        totalTimerMinutes: textTimerMinutes,
        highlightIngredients: [],
        renderedMarkdownParent: createDiv(),
        qtyScaleStore: writable(new Fraction(1)),
    };

    const normalizedText = normalizeMarkdownStepListSpacing(text);
    MarkdownRenderer.render(plugin.app, normalizedText, result.renderedMarkdownParent, path, component);

    // Transform inline @timer{...} syntax into clickable iOS Shortcut timer buttons and sum total duration
    const domTimerMinutes = parseForTimers(result.renderedMarkdownParent, plugin.settings);
    if (result.totalTimerMinutes <= 0 && domTimerMinutes > 0) {
        result.totalTimerMinutes = domTimerMinutes;
    }

    const radioName = `selectable-steps-${get(store.counter)}`;
    store.counter.update((n) => n + 1);

    // Pre-extract ingredient terms from all ingredient lists
    const requireCheckboxes =
        plugin?.settings?.requireCheckboxesForIngredients ?? true;
    const rawHighlightIngredients: Array<string> = [];
    const allUls = Array.from(
        result.renderedMarkdownParent.querySelectorAll("ul")
    ) as Array<HTMLElement>;
    for (const ul of allUls) {
        rawHighlightIngredients.push(
            ...sanitizeIngredientListElement(ul, requireCheckboxes)
        );
    }
    result.highlightIngredients = sortHighlightIngredients(rawHighlightIngredients);

    // Build unified recipe structure (global ingredients and segmented steps)
    buildUnifiedRecipeStructure(result, radioName, plugin);

    // Scale quantities and highlight ingredient occurrences across steps
    injectQuantities(result);
    injectHighlightedIngredients(result);

    return result;
}