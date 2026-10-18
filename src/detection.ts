export interface RecipeDetectionSettings {
    autoRenderReadingView: boolean;
    recipeFilterKey: string;
    recipeFilterValue: string;
    servingsProperty: string;
}

export interface HeadingLike {
    heading: string;
}

/**
 * Determine whether a note should be automatically rendered as a Recipe Card
 * in Obsidian's native Reading View.
 *
 * Matches if autoRenderReadingView is enabled AND at least one of the following holds:
 * 1. The configured frontmatter key/value filter matches (e.g. `type: rezept`).
 * 2. Frontmatter contains `recipe: true` or `rezept: true`.
 * 3. Frontmatter contains a non-empty `servings` (or configured servingsProperty) field.
 * 4. The note contains an `Ingredients` or `Zutaten` heading.
 */
export function isRecipeNote(
    frontmatter: Record<string, unknown> | undefined | null,
    headings: Array<HeadingLike> | undefined | null,
    settings: RecipeDetectionSettings
): boolean {
    if (!settings.autoRenderReadingView) {
        return false;
    }

    if (frontmatter) {
        // 1. Configured frontmatter key/value filter (default: type: rezept)
        const filterKey = (settings.recipeFilterKey || "").trim();
        const filterValue = (settings.recipeFilterValue || "").trim();

        if (filterKey) {
            const actualKey = Object.keys(frontmatter).find(
                (k) => k.toLowerCase() === filterKey.toLowerCase()
            );

            if (actualKey !== undefined) {
                const rawVal = frontmatter[actualKey];
                if (rawVal !== undefined && rawVal !== null) {
                    if (!filterValue) {
                        if (
                            rawVal === true ||
                            (typeof rawVal === "string" &&
                                rawVal.trim().length > 0 &&
                                rawVal.trim().toLowerCase() !== "false") ||
                            typeof rawVal === "number"
                        ) {
                            return true;
                        }
                    } else {
                        const allowedValues = filterValue
                            .split(/[,|]/)
                            .map((v) => v.trim().toLowerCase().replace(/^#/, ""))
                            .filter(Boolean);

                        const candidates: Array<string> = Array.isArray(rawVal)
                            ? (rawVal as Array<unknown>)
                                  .flat(Infinity)
                                  .map((v) => String(v).trim().toLowerCase().replace(/^#/, ""))
                            : [String(rawVal).trim().toLowerCase().replace(/^#/, "")];

                        if (candidates.some((c) => allowedValues.includes(c))) {
                            return true;
                        }
                    }
                }
            }
        }

        // 2. Explicit boolean marker: recipe: true or rezept: true
        for (const markerKey of ["recipe", "rezept"]) {
            const matchedKey = Object.keys(frontmatter).find(
                (k) => k.toLowerCase() === markerKey
            );
            if (matchedKey !== undefined) {
                const val = frontmatter[matchedKey];
                if (val === true || String(val).trim().toLowerCase() === "true") {
                    return true;
                }
            }
        }

        // 3. Presence of servings property (default: servings)
        const servingsKey = (settings.servingsProperty || "servings").trim().toLowerCase();
        const servingsMatchKey = Object.keys(frontmatter).find(
            (k) => k.toLowerCase() === servingsKey || k.toLowerCase() === "servings"
        );
        if (servingsMatchKey !== undefined) {
            const val = frontmatter[servingsMatchKey];
            if (val !== null && val !== undefined && String(val).trim() !== "") {
                return true;
            }
        }
    }

    // 4. Presence of Ingredients / Zutaten heading
    if (headings && headings.length > 0) {
        if (headings.some((h) => /^\s*(ingredients|zutaten)\b/i.test(h.heading))) {
            return true;
        }
    }

    return false;
}
