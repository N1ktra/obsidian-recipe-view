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

function elementHasMedia(element: HTMLElement): boolean {
    const tag = element.nodeName.toUpperCase();
    if (tag === "IMG" || tag === "VIDEO" || tag === "IFRAME") {
        return true;
    }
    return (
        element.getElementsByTagName("IMG").length > 0 ||
        element.getElementsByTagName("VIDEO").length > 0 ||
        element.getElementsByTagName("IFRAME").length > 0 ||
        element.querySelectorAll(
            ".internal-embed, .media-embed, .video-embed, .recipe-video-wrapper"
        ).length > 0
    );
}

function removeThumbnailFromElement(
    element: HTMLElement,
    thumbnailPath: string
): boolean {
    let removedAny = false;
    const mediaEls: Array<HTMLElement> = [];
    const tag = element.nodeName.toUpperCase();
    if (
        tag === "IMG" ||
        tag === "VIDEO" ||
        tag === "IFRAME" ||
        (element.matches && element.matches(".internal-embed[src], .media-embed[src], .recipe-video-wrapper"))
    ) {
        mediaEls.push(element);
    }
    mediaEls.push(
        ...Array.from(
            element.querySelectorAll<HTMLElement>(
                "img, video, iframe, .internal-embed[src], .media-embed[src], .recipe-video-wrapper"
            )
        )
    );
    for (const el of mediaEls) {
        const src =
            el.getAttribute("src") ||
            el.querySelector("iframe, video")?.getAttribute("src") ||
            "";
        const matchesThumbnail =
            !thumbnailPath ||
            src === thumbnailPath ||
            thumbnailPath.endsWith(src) ||
            src.endsWith(thumbnailPath) ||
            (thumbnailPath && src && (thumbnailPath.includes(src) || src.includes(thumbnailPath)));
        if (matchesThumbnail) {
            const embedWrapper = el.closest(
                ".image-embed, .media-embed, .internal-embed, .recipe-video-wrapper"
            );
            const toRemove = (embedWrapper as HTMLElement) || el;
            const parent = toRemove.parentElement;
            toRemove.remove();
            removedAny = true;
            if (
                parent &&
                (parent.nodeName === "P" ||
                    parent.nodeName === "DIV" ||
                    parent.nodeName === "SPAN")
            ) {
                if (
                    !parent.textContent?.trim() &&
                    !elementHasMedia(parent)
                ) {
                    parent.remove();
                }
            }
        }
    }
    return removedAny;
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

    // The description spans everything up to the first Heading, "---" (HR), or list (UL/OL)
    let firstDescriptionBoundaryIndex = -1;
    for (let i = startIndex; i < contentItems.length; i++) {
        const item = contentItems[i];
        const nodeName = item.nodeName;

        // Skip leading H1 if used as note title
        if (nodeName === "H1" && !result.title) {
            result.title = (item.textContent || "").trim();
            continue;
        }

        // Boundary: first Heading, section header (ingredients/directions regex), --- (HR), or list
        if (
            Boolean(nodeName.match(/^H[1-6]$/)) ||
            isIngredientsHeaderElement(item, ingredientsRegex) ||
            isDirectionsHeaderElement(item, directionsRegex) ||
            nodeName === "HR" ||
            nodeName === "UL" ||
            nodeName === "OL"
        ) {
            firstDescriptionBoundaryIndex = i;
            break;
        }
    }

    for (let i = startIndex; i < contentItems.length; i++) {
        const item = contentItems[i];
        const nodeName = item.nodeName;

        // Check first thumbnail media (image, video, iframe, or internal embed) if no cover defined
        if (!result.thumbnailPath && !inDirections && elementHasMedia(item)) {
            const firstImg = item.nodeName === "IMG" ? (item as HTMLImageElement) : item.getElementsByTagName("IMG").item(0);
            const firstVideo = item.nodeName === "VIDEO" ? (item as HTMLVideoElement) : item.getElementsByTagName("VIDEO").item(0);
            const firstIframe = item.nodeName === "IFRAME" ? (item as HTMLIFrameElement) : item.getElementsByTagName("IFRAME").item(0);
            const firstEmbed = (item.matches && item.matches(".internal-embed[src], .media-embed[src]"))
                ? item
                : item.querySelector(".internal-embed[src], .media-embed[src]");
            if (firstImg) {
                result.thumbnailPath = firstImg.getAttribute("src") || "";
            } else if (firstVideo) {
                result.thumbnailPath = firstVideo.getAttribute("src") || "";
            } else if (firstIframe) {
                result.thumbnailPath = firstIframe.getAttribute("src") || "";
            } else if (firstEmbed) {
                result.thumbnailPath = firstEmbed.getAttribute("src") || "";
            }
        }

        // Introductory content before the first heading, "---", or list
        if (firstDescriptionBoundaryIndex !== -1 && i < firstDescriptionBoundaryIndex) {
            if (nodeName === "H1") {
                if (!result.title) {
                    result.title = (item.textContent || "").trim();
                }
                continue;
            }

            // Remove thumbnail media from preamble elements to prevent duplicate full-width rendering
            if (result.thumbnailPath && elementHasMedia(item)) {
                removeThumbnailFromElement(item, result.thumbnailPath);
            }

            if (!item.parentElement) {
                continue; // The item itself was removed as the thumbnail
            }

            const hasText = Boolean(item.textContent?.trim());
            const hasMedia = elementHasMedia(item);

            if (!hasText && !hasMedia) {
                continue; // Standalone media or empty element removed
            }

            const isCallout =
                item.classList.contains("callout") ||
                Boolean(item.querySelector(".callout")) ||
                nodeName === "BLOCKQUOTE";

            if (isCallout) {
                const calloutEl = (item.classList.contains("callout")
                    ? item
                    : item.querySelector(".callout")) as HTMLElement || item;
                const contentEl = calloutEl.querySelector(".callout-content") as HTMLElement | null;

                const hasContentText = Boolean(
                    contentEl ? contentEl.textContent?.trim() : item.textContent?.trim()
                );
                const hasContentMedia = elementHasMedia(item);

                if (!hasContentText && !hasContentMedia) {
                    const titleInner = (
                        calloutEl.querySelector(".callout-title-inner")?.textContent || ""
                    ).trim().toLowerCase();
                    const calloutType = (
                        calloutEl.getAttribute("data-callout") || ""
                    ).trim().toLowerCase();
                    if (!titleInner || titleInner === calloutType) {
                        continue; // Pure cover wrapper callout without custom title or text
                    }
                }

                const html = item.outerHTML.trim();
                if (html) {
                    descriptionParagraphs.push(html);
                }
                continue;
            }

            if (nodeName === "P") {
                const text = item.innerHTML.trim();
                if (text) {
                    descriptionParagraphs.push(text);
                }
                continue;
            }

            // Any other preamble element with content
            const html = item.outerHTML.trim();
            if (html) {
                descriptionParagraphs.push(html);
            }
            continue;
        }

        // Fallback thumbnail removal outside preamble if item was a standalone media container
        if (
            result.thumbnailPath &&
            !inDirections &&
            elementHasMedia(item) &&
            !item.textContent?.trim()
        ) {
            removeThumbnailFromElement(item, result.thumbnailPath);
            if (!item.parentElement || (!item.textContent?.trim() && !elementHasMedia(item))) {
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
            .map((p) => {
                const trimmed = p.trim();
                if (
                    trimmed.startsWith("<div") ||
                    trimmed.startsWith("<blockquote") ||
                    trimmed.startsWith("<p")
                ) {
                    return trimmed;
                }
                return `<p>${trimmed}</p>`;
            })
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
                            bullets: false,
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
                        bullets: false,
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
                                    bullets: false,
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
                                bullets: false,
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
