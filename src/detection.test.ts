import { describe, expect, test } from '@jest/globals';
import { isRecipeNote, RecipeDetectionSettings } from './detection';

const DEFAULT_DETECTION_SETTINGS: RecipeDetectionSettings = {
    autoRenderReadingView: true,
    recipeFilterKey: 'type',
    recipeFilterValue: 'rezept',
    servingsProperty: 'servings',
};

describe('isRecipeNote detection for Reading View', () => {
    test('returns true when configured frontmatter filter matches (type: rezept)', () => {
        expect(
            isRecipeNote({ type: 'rezept' }, [], DEFAULT_DETECTION_SETTINGS)
        ).toBe(true);
        expect(
            isRecipeNote({ Type: 'Rezept' }, [], DEFAULT_DETECTION_SETTINGS)
        ).toBe(true);
    });

    test('returns true when frontmatter has recipe: true', () => {
        expect(
            isRecipeNote({ recipe: true }, [], DEFAULT_DETECTION_SETTINGS)
        ).toBe(true);
        expect(
            isRecipeNote({ recipe: 'true' }, [], DEFAULT_DETECTION_SETTINGS)
        ).toBe(true);
    });

    test('returns true when frontmatter contains servings', () => {
        expect(
            isRecipeNote({ servings: 4 }, [], DEFAULT_DETECTION_SETTINGS)
        ).toBe(true);
    });

    test('returns true when headings contain Ingredients or Zutaten', () => {
        expect(
            isRecipeNote({}, [{ heading: 'Ingredients' }], DEFAULT_DETECTION_SETTINGS)
        ).toBe(true);
        expect(
            isRecipeNote({}, [{ heading: 'Zutaten für den Teig' }], DEFAULT_DETECTION_SETTINGS)
        ).toBe(true);
    });

    test('returns false for regular non-recipe notes', () => {
        expect(
            isRecipeNote(
                { type: 'meeting', author: 'Niklas' },
                [{ heading: 'Agenda' }, { heading: 'Notes' }],
                DEFAULT_DETECTION_SETTINGS
            )
        ).toBe(false);
        expect(
            isRecipeNote(undefined, undefined, DEFAULT_DETECTION_SETTINGS)
        ).toBe(false);
    });

    test('returns false when autoRenderReadingView is disabled', () => {
        expect(
            isRecipeNote(
                { type: 'rezept', servings: 4 },
                [{ heading: 'Ingredients' }],
                { ...DEFAULT_DETECTION_SETTINGS, autoRenderReadingView: false }
            )
        ).toBe(false);
    });
});
