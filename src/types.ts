import { ComponentType } from "svelte";
import { Writable } from "svelte/store";
import Fraction from "fraction.js";

export interface ParsedRecipeComponent {
    type: ComponentType;
    props: Record<string, unknown>;
    origIndex: number;
}

export interface ParsedRecipeSection {
    containsHeader: boolean;
    isExplicitSideSection?: boolean;
    sideComponents: Array<ParsedRecipeComponent>;
    mainComponents: Array<ParsedRecipeComponent>;
}

export interface ParsedRecipeStep {
    stepNumber: number | null;
    isHeadingOnly: boolean;
    stepTitle?: string;
    stepIngredients: Array<ParsedRecipeComponent>;
    mainComponents: Array<ParsedRecipeComponent>;
}

export interface ParsedRecipe {
    title: string;
    description?: string;
    thumbnailPath: string;
    sections: Array<ParsedRecipeSection>;
    globalIngredients: Array<ParsedRecipeComponent>;
    steps: Array<ParsedRecipeStep>;
    hasStepIngredients: boolean;
    totalTimerMinutes: number;
    highlightIngredients: Array<string>;
    renderedMarkdownParent: HTMLElement;
    qtyScaleStore: Writable<Fraction>;
}
