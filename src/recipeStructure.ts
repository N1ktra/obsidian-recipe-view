import RecipeViewPlugin from "./main";
import RecipeLeaf from "./components/RecipeLeaf.svelte";
import CheckableIngredientList from "./components/CheckableIngredientList.svelte";
import SelectableStepList from "./components/SelectableStepList.svelte";
import {
    ParsedRecipe,
    ParsedRecipeComponent,
    ParsedRecipeStep,
} from "./types";
import {
    getDirectionsRegex,
    getIngredientsRegex,
    isDirectionsHeaderElement,
    isIngredientsHeaderElement,
    isListItemWithCheckbox,
    sanitizeIngredientListElement,
    extractTrailingInstructionsFromList,
} from "./domUtils";

function pushInstructionParagraph(
    instructionComponents: Array<ParsedRecipeComponent>,
    p: HTMLElement,
    radioName: string,
    highlightIngredients: Array<string>,
    origIndex: number
) {
    const prev = instructionComponents[instructionComponents.length - 1];
    if (
        prev &&
        prev.type === SelectableStepList &&
        prev.props.kind === "p"
    ) {
        (prev.props.list as Array<HTMLElement>).push(p);
    } else {
        instructionComponents.push({
            type: SelectableStepList,
            props: {
                list: [p],
                kind: "p",
                radioName,
                highlightIngredients,
            },
            origIndex,
        });
    }
}

interface RawStepBlock {
    headerElement: HTMLElement | null;
    items: Array<HTMLElement>;
}

export function buildUnifiedRecipeStructure(
    result: ParsedRecipe,
    radioName: string,
    plugin: RecipeViewPlugin
): void {
    const directionsRegex = getDirectionsRegex(plugin);
    const ingredientsRegex = getIngredientsRegex(plugin);
    const requireCheckboxes =
        plugin?.settings?.requireCheckboxesForIngredients ?? true;

    const rawElements = Array.from(
        result.renderedMarkdownParent.children
    ).filter((el): el is HTMLElement => el instanceof HTMLElement);

    // 1. Filter out frontmatter pre tag
    const contentItems = rawElements.filter(
        (item) => !item.matches("pre.frontmatter")
    );

    let inDirections = false;
    let inIngredientsSection = false;
    let ingredientsSectionLevel = 7;
    let seenAnyHeader = false;

    const globalItems: Array<HTMLElement> = [];
    const directionsItems: Array<HTMLElement> = [];
    const descriptionParagraphs: Array<string> = [];

    // Check optional H1 title extraction
    let startIndex = 0;
    if (
        contentItems.length > 0 &&
        contentItems[0].nodeName.match(/^H1$/i) &&
        plugin?.settings?.treatH1AsFilename
    ) {
        if (!result.title) {
            result.title = (contentItems[0].textContent || "").trim();
        }
        startIndex = 1;
    }

    // Locate explicit Directions / Zubereitung header if present
    let directionsHeaderIndex = -1;
    for (let i = startIndex; i < contentItems.length; i++) {
        if (contentItems[i].nodeName.match(/^H[1-6]$/) && isDirectionsHeaderElement(contentItems[i], directionsRegex)) {
            directionsHeaderIndex = i;
            break;
        }
    }
    if (directionsHeaderIndex === -1) {
        for (let i = startIndex; i < contentItems.length; i++) {
            if (isDirectionsHeaderElement(contentItems[i], directionsRegex)) {
                directionsHeaderIndex = i;
                break;
            }
        }
    }

    // Locate explicit Ingredients / Zutaten header if present
    let ingredientsHeaderIndex = -1;
    for (let i = startIndex; i < contentItems.length; i++) {
        if (contentItems[i].nodeName.match(/^H[1-6]$/) && isIngredientsHeaderElement(contentItems[i], ingredientsRegex)) {
            ingredientsHeaderIndex = i;
            break;
        }
    }
    if (ingredientsHeaderIndex === -1) {
        for (let i = startIndex; i < contentItems.length; i++) {
            if (isIngredientsHeaderElement(contentItems[i], ingredientsRegex)) {
                ingredientsHeaderIndex = i;
                break;
            }
        }
    }

    // Locate the first ingredients or directions section (header or list)
    let firstRecipeSectionIndex = -1;
    if (ingredientsHeaderIndex !== -1 && directionsHeaderIndex !== -1) {
        firstRecipeSectionIndex = Math.min(ingredientsHeaderIndex, directionsHeaderIndex);
    } else if (ingredientsHeaderIndex !== -1) {
        firstRecipeSectionIndex = ingredientsHeaderIndex;
    } else if (directionsHeaderIndex !== -1) {
        firstRecipeSectionIndex = directionsHeaderIndex;
    } else {
        for (let i = startIndex; i < contentItems.length; i++) {
            const item = contentItems[i];
            if (item.nodeName === "UL" || item.nodeName === "OL") {
                firstRecipeSectionIndex = i;
                break;
            }
        }
    }

    for (let i = startIndex; i < contentItems.length; i++) {
        const item = contentItems[i];
        const nodeName = item.nodeName;

        // Check first thumbnail image if no cover defined
        if (
            !result.thumbnailPath &&
            !inDirections &&
            item.getElementsByTagName("IMG").length > 0
        ) {
            const img = item.getElementsByTagName("IMG").item(0);
            if (img) {
                result.thumbnailPath = img.getAttribute("src") || "";
                if (!item.textContent?.trim()) {
                    continue;
                }
            }
        }

        // Introductory content before any ingredients or directions section
        if (firstRecipeSectionIndex !== -1 && i < firstRecipeSectionIndex) {
            if (nodeName === "P") {
                const text = item.innerHTML.trim();
                if (text) {
                    descriptionParagraphs.push(text);
                }
                continue;
            }
            if (nodeName === "H1") {
                if (!result.title) {
                    result.title = (item.textContent || "").trim();
                }
                continue;
            }
        }

        if (directionsHeaderIndex !== -1 && i === directionsHeaderIndex) {
            inDirections = true;
            inIngredientsSection = false;
            continue; // Main directions header opens the directions area without becoming a step itself
        }

        if (inDirections) {
            directionsItems.push(item);
            continue;
        }

        // We are before directions (or no directions header exists)
        const isHeader = Boolean(nodeName.match(/^H[1-6]$/)) || isIngredientsHeaderElement(item, ingredientsRegex);
        if (isHeader) {
            seenAnyHeader = true;
            const level = nodeName.match(/^H[1-6]$/) ? parseInt(nodeName[1], 10) : 1;

            if (isIngredientsHeaderElement(item, ingredientsRegex)) {
                // Matches ingredients regex (e.g. "Zutaten", "Zutaten Sandwich", "Ingredients")
                inIngredientsSection = true;
                ingredientsSectionLevel = level;
                globalItems.push(item);
            } else if (inIngredientsSection && level > ingredientsSectionLevel) {
                // Subgroup header under ingredients (e.g. "### Sauce" under "## Zutaten Sandwich")
                globalItems.push(item);
            } else {
                // Header does NOT match ingredients regex and is not a sub-level under ingredients (e.g. "## test", "## Equipment")
                inIngredientsSection = false;
                if (directionsHeaderIndex === -1 && nodeName === "HR") {
                    inDirections = true;
                } else {
                    directionsItems.push(item);
                }
            }
        } else if (nodeName === "UL") {
            if (inIngredientsSection) {
                // Inside an ingredients section matching regex
                globalItems.push(item);
            } else if (!seenAnyHeader) {
                // Condition b: List directly at the beginning without any header before it
                globalItems.push(item);
            } else {
                // List under a non-ingredients header (e.g. under "## test")
                directionsItems.push(item);
            }
        } else if (nodeName === "HR") {
            if (directionsHeaderIndex === -1 && globalItems.length > 0) {
                inDirections = true;
            } else {
                directionsItems.push(item);
            }
        } else if (nodeName === "OL") {
            inDirections = true;
            directionsItems.push(item);
        } else {
            // Other elements (e.g. callout, paragraph)
            if (inIngredientsSection) {
                globalItems.push(item);
            } else {
                directionsItems.push(item);
            }
        }
    }

    if (descriptionParagraphs.length === 1) {
        result.description = descriptionParagraphs[0];
    } else if (descriptionParagraphs.length > 1) {
        result.description = descriptionParagraphs
            .map((p) => `<p>${p}</p>`)
            .join("");
    }

    // 2. Build Global Ingredients Components
    const globalIngredients: Array<ParsedRecipeComponent> = [];
    for (let i = 0; i < globalItems.length; i++) {
        const item = globalItems[i];
        if (item.nodeName === "UL") {
            const lis = Array.from(item.children).filter(
                (el): el is HTMLLIElement => el.nodeName === "LI"
            );
            if (requireCheckboxes) {
                const checkboxLis = lis.filter((li) => isListItemWithCheckbox(li));
                const nonCheckboxLis = lis.filter((li) => !isListItemWithCheckbox(li));

                if (checkboxLis.length > 0) {
                    const ingUl = item.cloneNode(false) as HTMLElement;
                    checkboxLis.forEach((li) => ingUl.appendChild(li));
                    sanitizeIngredientListElement(ingUl, true);
                    globalIngredients.push({
                        type: CheckableIngredientList,
                        props: {
                            list: ingUl,
                            bullets: plugin?.settings?.showBulletsTwoColumn ?? false,
                        },
                        origIndex: i,
                    });
                }

                if (nonCheckboxLis.length > 0) {
                    const normalUl = item.cloneNode(false) as HTMLElement;
                    nonCheckboxLis.forEach((li) => normalUl.appendChild(li));
                    sanitizeIngredientListElement(normalUl, false);
                    globalIngredients.push({
                        type: RecipeLeaf,
                        props: { childNodesOf: normalUl, asTag: "ul" },
                        origIndex: i,
                    });
                }
            } else {
                sanitizeIngredientListElement(item, false);
                globalIngredients.push({
                    type: CheckableIngredientList,
                    props: {
                        list: item,
                        bullets: plugin?.settings?.showBulletsTwoColumn ?? false,
                    },
                    origIndex: i,
                });
            }
        } else {
            if (item.classList.contains("callout")) {
                const calloutWrapper =
                    typeof createDiv === "function"
                        ? createDiv()
                        : document.createElement("div");
                calloutWrapper.appendChild(item);
                globalIngredients.push({
                    type: RecipeLeaf,
                    props: { childNodesOf: calloutWrapper, asTag: "div" },
                    origIndex: i,
                });
            } else {
                globalIngredients.push({
                    type: RecipeLeaf,
                    props: { childNodesOf: item, asTag: item.nodeName },
                    origIndex: i,
                });
            }
        }
    }
    result.globalIngredients = globalIngredients;

    // 3. Slice Directions Items into Step Blocks based on Headings or HRs
    const rawBlocks: Array<RawStepBlock> = [];
    let currentBlock: RawStepBlock = { headerElement: null, items: [] };

    for (const item of directionsItems) {
        if (item.nodeName === "HR") {
            if (currentBlock.headerElement || currentBlock.items.length > 0) {
                rawBlocks.push(currentBlock);
            }
            currentBlock = { headerElement: null, items: [] };
            continue;
        }

        if (item.nodeName.match(/^H[1-6]$/)) {
            if (currentBlock.headerElement || currentBlock.items.length > 0) {
                rawBlocks.push(currentBlock);
            }
            currentBlock = { headerElement: item, items: [] };
            continue;
        }

        currentBlock.items.push(item);
    }

    if (currentBlock.headerElement || currentBlock.items.length > 0) {
        rawBlocks.push(currentBlock);
    }

    // 4. Transform Step Blocks into ParsedRecipeSteps
    const steps: Array<ParsedRecipeStep> = [];
    let stepCounter = 0;

    // Check if this is a single simple block with an OL (classic 1. 2. 3. format)
    const isSingleSimpleBlock =
        rawBlocks.length === 1 &&
        !rawBlocks[0].headerElement &&
        !rawBlocks[0].items.some((it) => it.nodeName === "UL");

    if (isSingleSimpleBlock) {
        const singleItems = rawBlocks[0].items;
        for (let i = 0; i < singleItems.length; i++) {
            const item = singleItems[i];
            if (item.nodeName === "OL") {
                const olEl = item as HTMLOListElement;
                const liElements = Array.from(olEl.children) as Array<HTMLElement>;
                for (const liEl of liElements) {
                    stepCounter += 1;
                    steps.push({
                        stepNumber: stepCounter,
                        isHeadingOnly: false,
                        stepIngredients: [],
                        mainComponents: [
                            {
                                type: SelectableStepList,
                                props: {
                                    list: [liEl],
                                    kind: "p",
                                    radioName,
                                    highlightIngredients: result.highlightIngredients,
                                },
                                origIndex: i,
                            },
                        ],
                    });
                }
            } else if (item.nodeName === "P") {
                stepCounter += 1;
                steps.push({
                    stepNumber: stepCounter,
                    isHeadingOnly: false,
                    stepIngredients: [],
                    mainComponents: [
                        {
                            type: SelectableStepList,
                            props: {
                                list: [item],
                                kind: "p",
                                radioName,
                                highlightIngredients: result.highlightIngredients,
                            },
                            origIndex: i,
                        },
                    ],
                });
            } else {
                steps.push({
                    stepNumber: null,
                    isHeadingOnly: false,
                    stepIngredients: [],
                    mainComponents: [
                        {
                            type: RecipeLeaf,
                            props: { childNodesOf: item, asTag: item.nodeName },
                            origIndex: i,
                        },
                    ],
                });
            }
        }
    } else {
        // Standard multi-step segmentation (Variant A with headings, Variant B with HRs)
        for (let bIdx = 0; bIdx < rawBlocks.length; bIdx++) {
            const block = rawBlocks[bIdx];
            const stepIngredients: Array<ParsedRecipeComponent> = [];
            const instructionComponents: Array<ParsedRecipeComponent> = [];

            let inLeadingIngredients = true;
            for (let i = 0; i < block.items.length; i++) {
                const item = block.items[i];
                if (inLeadingIngredients && item.nodeName === "UL") {
                    const lis = Array.from(item.children).filter(
                        (el): el is HTMLLIElement => el.nodeName === "LI"
                    );

                    if (requireCheckboxes) {
                        const firstNonCheckboxIdx = lis.findIndex(
                            (li) => !isListItemWithCheckbox(li)
                        );

                        const checkboxLis =
                            firstNonCheckboxIdx === -1
                                ? lis
                                : lis.slice(0, firstNonCheckboxIdx);
                        const nonCheckboxLis =
                            firstNonCheckboxIdx === -1
                                ? []
                                : lis.slice(firstNonCheckboxIdx);

                        if (checkboxLis.length > 0) {
                            const ingUl = item.cloneNode(false) as HTMLElement;
                            checkboxLis.forEach((li) => ingUl.appendChild(li));
                            const trailingInstructions = extractTrailingInstructionsFromList(ingUl);
                            sanitizeIngredientListElement(ingUl, true);
                            stepIngredients.push({
                                type: CheckableIngredientList,
                                props: {
                                    list: ingUl,
                                    bullets: plugin?.settings?.showBulletsTwoColumn ?? false,
                                },
                                origIndex: i,
                            });

                            if (trailingInstructions.length > 0) {
                                inLeadingIngredients = false;
                                for (const p of trailingInstructions) {
                                    pushInstructionParagraph(
                                        instructionComponents,
                                        p,
                                        radioName,
                                        result.highlightIngredients,
                                        i
                                    );
                                }
                            }
                        }

                        if (nonCheckboxLis.length > 0) {
                            inLeadingIngredients = false;
                            const instUl = item.cloneNode(false) as HTMLElement;
                            nonCheckboxLis.forEach((li) => instUl.appendChild(li));
                            instructionComponents.push({
                                type: RecipeLeaf,
                                props: { childNodesOf: instUl, asTag: "ul" },
                                origIndex: i,
                            });
                        }
                    } else {
                        const trailingInstructions = extractTrailingInstructionsFromList(item);
                        sanitizeIngredientListElement(item, false);
                        stepIngredients.push({
                            type: CheckableIngredientList,
                            props: {
                                list: item,
                                bullets: plugin?.settings?.showBulletsTwoColumn ?? false,
                            },
                            origIndex: i,
                        });

                        if (trailingInstructions.length > 0) {
                            inLeadingIngredients = false;
                            for (const p of trailingInstructions) {
                                pushInstructionParagraph(
                                    instructionComponents,
                                    p,
                                    radioName,
                                    result.highlightIngredients,
                                    i
                                );
                            }
                        }
                    }
                } else {
                    inLeadingIngredients = false;
                    if (item.nodeName === "OL") {
                        instructionComponents.push({
                            type: SelectableStepList,
                            props: {
                                list: item,
                                kind: "ol",
                                radioName,
                                highlightIngredients: result.highlightIngredients,
                            },
                            origIndex: i,
                        });
                    } else if (item.nodeName === "P") {
                        pushInstructionParagraph(
                            instructionComponents,
                            item,
                            radioName,
                            result.highlightIngredients,
                            i
                        );
                    } else if (item.classList.contains("callout")) {
                        const calloutWrapper =
                            typeof createDiv === "function"
                                ? createDiv()
                                : document.createElement("div");
                        calloutWrapper.appendChild(item);
                        instructionComponents.push({
                            type: RecipeLeaf,
                            props: { childNodesOf: calloutWrapper, asTag: "div" },
                            origIndex: i,
                        });
                    } else {
                        instructionComponents.push({
                            type: RecipeLeaf,
                            props: { childNodesOf: item, asTag: item.nodeName },
                            origIndex: i,
                        });
                    }
                }
            }

            let stepTitle: string | undefined = undefined;
            const mainComponents: Array<ParsedRecipeComponent> = [];

            if (block.headerElement) {
                stepTitle = (block.headerElement.textContent || "").trim();
                mainComponents.push({
                    type: RecipeLeaf,
                    props: {
                        childNodesOf: block.headerElement,
                        asTag: block.headerElement.nodeName,
                    },
                    origIndex: 0,
                });
            }
            mainComponents.push(...instructionComponents);

            // An isolated heading with zero ingredients and zero instructions
            const isHeadingOnly =
                Boolean(block.headerElement) &&
                block.items.length === 0 &&
                stepIngredients.length === 0;

            if (isHeadingOnly) {
                steps.push({
                    stepNumber: null,
                    isHeadingOnly: true,
                    stepTitle,
                    stepIngredients: [],
                    mainComponents,
                });
            } else {
                stepCounter += 1;
                steps.push({
                    stepNumber: stepCounter,
                    isHeadingOnly: false,
                    stepTitle,
                    stepIngredients,
                    mainComponents,
                });
            }
        }
    }

    result.steps = steps;
    result.hasStepIngredients = steps.some((s) => s.stepIngredients.length > 0);
    result.sections = steps.map((s) => ({
        containsHeader: Boolean(s.stepTitle),
        isExplicitSideSection: false,
        sideComponents: s.stepIngredients,
        mainComponents: s.mainComponents,
    }));
}
