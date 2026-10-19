import RecipeViewPlugin from "./main";
import {
    DEFAULT_DIRECTIONS_HEADER_REGEX,
    DEFAULT_INGREDIENTS_HEADER_REGEX,
} from "./settings";
import RecipeLeaf from "./RecipeLeaf.svelte";
import CheckableIngredientList from "./CheckableIngredientList.svelte";
import SelectableStepList from "./SelectableStepList.svelte";
import { CachedMetadata, Component, MarkdownRenderer, TFile } from "obsidian";
import store from "./store";
import { Writable, get, writable } from "svelte/store";
import Fraction from "fraction.js";
import {
    matchQuantities,
    LEADING_CHECKBOX_REGEX,
    ParsedCheckboxText,
    stripLeadingCheckboxSyntax,
} from "./quantities";
import ScaledQuantity from "./ScaledQuantity.svelte";
import { ComponentType } from "svelte";
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
};
export type { ParsedCheckboxText };

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

/**
 * Returns true if an <li> element contains a checkbox (native checkbox input, task-list-item class,
 * data-task attribute, data-has-checkbox marker, or leading markdown checkbox syntax like "- [ ]", "[ ]", "[x]").
 */
export function isListItemWithCheckbox(li: HTMLLIElement): boolean {
    if (
        li.getAttribute("data-has-checkbox") === "true" ||
        li.classList.contains("task-list-item") ||
        li.classList.contains("is-checked") ||
        li.hasAttribute("data-task") ||
        li.hasAttribute("data-checked")
    ) {
        return true;
    }

    if (
        li.querySelector(
            'input[type="checkbox"]:not(.recipe-ingredient-checkbox), .task-list-item-checkbox:not(.recipe-ingredient-checkbox)'
        ) != null
    ) {
        return true;
    }

    const text = (li.textContent || "").trim();
    if (
        /^\s*(?:[-*+]\s+)?\[([ xX])?\]/.test(text) ||
        LEADING_CHECKBOX_REGEX.test(text)
    ) {
        return true;
    }

    return false;
}

/**
 * Clean a rendered <ul> ingredient list so native Obsidian task-list checkboxes
 * or raw "[ ]"/"[x]" prefixes are removed and converted into `data-checked` on each <li>.
 * Also extracts `@Zutat` and `@{Mehrwort Zutat}` markers, strips `@` and `{}` from the
 * visible ingredient text, and returns all extracted ingredient keywords.
 */
export function sanitizeIngredientListElement(
    ulEl: HTMLElement,
    requireCheckboxes = false
): Array<string> {
    ulEl.classList.remove("contains-task-list");

    const extractedIngredients: Array<string> = [];
    const items = Array.from(ulEl.children).filter(
        (el): el is HTMLLIElement => el.nodeName === "LI"
    );

    for (const li of items) {
        let isChecked = li.getAttribute("data-checked") === "true";
        let hasCheckbox = isListItemWithCheckbox(li);

        const dataTask = li.getAttribute("data-task");
        if (
            li.classList.contains("is-checked") ||
            (dataTask != null && dataTask.trim().toLowerCase() === "x")
        ) {
            isChecked = true;
            hasCheckbox = true;
        }
        if (li.classList.contains("task-list-item") || dataTask != null) {
            hasCheckbox = true;
        }
        li.classList.remove("task-list-item", "is-checked");
        li.removeAttribute("data-task");

        const nativeCheckboxes = Array.from(
            li.querySelectorAll(
                'input[type="checkbox"]:not(.recipe-ingredient-checkbox), .task-list-item-checkbox:not(.recipe-ingredient-checkbox)'
            )
        ) as Array<HTMLInputElement>;

        if (nativeCheckboxes.length > 0) {
            hasCheckbox = true;
            if (
                nativeCheckboxes.some(
                    (cb) => cb.checked || cb.hasAttribute("checked")
                )
            ) {
                isChecked = true;
            }
            nativeCheckboxes.forEach((cb) => cb.remove());
        }

        const walker = document.createTreeWalker(
            li,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    const el = node.parentElement;
                    if (el?.closest("[data-qty]") || el?.closest(".recipe-timer-btn")) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                },
            }
        );
        let firstTextNode: Text | null = null;
        while (walker.nextNode()) {
            const current = walker.currentNode as Text;
            if ((current.textContent || "").trim().length > 0) {
                firstTextNode = current;
                break;
            } else if (current.textContent) {
                current.textContent = "";
            }
        }

        if (firstTextNode && firstTextNode.textContent) {
            const parsed = stripLeadingCheckboxSyntax(
                firstTextNode.textContent
            );
            if (parsed.hasCheckbox) {
                hasCheckbox = true;
                if (parsed.checked) {
                    isChecked = true;
                }
                firstTextNode.textContent = parsed.text;
            } else {
                firstTextNode.textContent = firstTextNode.textContent.replace(
                    /^\s+/,
                    ""
                );
            }
        }

        if (hasCheckbox) {
            li.setAttribute("data-has-checkbox", "true");
            li.setAttribute("data-checked", isChecked ? "true" : "false");
        } else {
            li.removeAttribute("data-has-checkbox");
            if (requireCheckboxes) {
                li.removeAttribute("data-checked");
            } else {
                li.setAttribute("data-checked", isChecked ? "true" : "false");
            }
        }

        if (!requireCheckboxes || hasCheckbox) {
            extractedIngredients.push(...extractAndCleanIngredientListDom(li));
        }
    }

    return extractedIngredients;
}

/**
 * Extract and resolve a cover image URL/resource path from frontmatter metadata.
 */
export function resolveCoverImage(
    plugin: RecipeViewPlugin,
    frontmatter: Record<string, unknown> | undefined,
    sourcePath: string
): string {
    if (!frontmatter) {
        return "";
    }

    const coverKey = (plugin.settings.coverProperty || "cover").trim() || "cover";
    const rawValue = frontmatter[coverKey];
    if (rawValue == null) {
        return "";
    }

    let rawStr = "";
    if (typeof rawValue === "string") {
        rawStr = rawValue.trim();
    } else if (Array.isArray(rawValue)) {
        const flat = (rawValue as Array<unknown>).flat(Infinity);
        const firstStr = flat.find((v): v is string => typeof v === "string" && v.trim().length > 0);
        if (firstStr) {
            rawStr = firstStr.trim();
        }
    }

    if (!rawStr) {
        return "";
    }

    // Strip surrounding quotes if present
    if (
        (rawStr.startsWith('"') && rawStr.endsWith('"')) ||
        (rawStr.startsWith("'") && rawStr.endsWith("'"))
    ) {
        rawStr = rawStr.slice(1, -1).trim();
    }

    // Strip wikilink syntax: ![[image.png|alias]] or [[image.png]]
    const wikiMatch = rawStr.match(/^!?\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/);
    if (wikiMatch) {
        rawStr = wikiMatch[1].trim();
    }

    // Strip markdown link/image syntax: ![alt](url) or [text](url)
    const mdMatch = rawStr.match(/^!?\[[^\]]*\]\(([^)]+)\)$/);
    if (mdMatch) {
        rawStr = mdMatch[1].trim();
    }

    if (!rawStr) {
        return "";
    }

    // External URL or direct protocol URI
    if (/^(?:https?|app|data|blob|capacitor):/i.test(rawStr)) {
        return rawStr;
    }

    // Resolve internal vault file
    const fileDest =
        plugin.app.metadataCache.getFirstLinkpathDest(rawStr, sourcePath) ||
        plugin.app.metadataCache.getFirstLinkpathDest(decodeURIComponent(rawStr), sourcePath) ||
        plugin.app.vault.getAbstractFileByPath(rawStr) ||
        plugin.app.vault.getAbstractFileByPath(decodeURIComponent(rawStr));

    if (fileDest instanceof TFile) {
        return plugin.app.vault.getResourcePath(fileDest);
    }

    return "";
}

function parseForQty(n: Node, qtyScaleStore: Writable<Fraction>) {
    if (n.nodeType == Node.ELEMENT_NODE) {
        const el = n as HTMLElement;
        if (
            el.hasAttribute("data-qty") ||
            el.hasAttribute("data-qty-no-parse") ||
            el.classList.contains("scale-selector")
        ) {
            return;
        }
    }

    if (n.nodeType == Node.TEXT_NODE) {
        const parent = n.parentNode!;
        let currentIndex = 0;
        n.textContent = n.textContent!.normalize("NFKD").replaceAll("\u2044", "/");
        const quantities = matchQuantities(n.textContent!);
        if (quantities.length > 0) {
            for (const match of quantities) {
                const matchIndex = match.index ?? currentIndex;
                if (matchIndex > currentIndex) {
                    parent.insertBefore(
                        document.createTextNode(
                            n.textContent!.slice(currentIndex, matchIndex)
                        ),
                        n
                    );
                }
                const qtyTarget =
                    typeof createEl === "function"
                        ? createEl("span")
                        : document.createElement("span");
                qtyTarget.setAttribute("data-qty", "true");
                parent.insertBefore(qtyTarget, n);
                new ScaledQuantity({
                    target: qtyTarget,
                    props: {
                        value: match.value.value,
                        format: match.value.format,
                        unit: match.unit,
                        qtyScaleStore: qtyScaleStore,
                    },
                });
                currentIndex = matchIndex + match.length;
            }
            if (currentIndex < n.textContent!.length) {
                parent.insertBefore(
                    document.createTextNode(n.textContent!.slice(currentIndex)),
                    n
                );
            }
            parent.removeChild(n);
            return;
        }
    }

    if (n.hasChildNodes()) {
        Array.from(n.childNodes).forEach((c) =>
            parseForQty(c, qtyScaleStore)
        );
    }
}

function parseComponentQuantities(
    c: ParsedRecipeComponent,
    qtyScaleStore: Writable<Fraction>,
    isIngredient = false
) {
    if (c.props.list) {
        if (c.props.kind === "ol") {
            Array.from(
                (c.props.list as HTMLElement).querySelectorAll("[data-qty-parse]")
            ).forEach((n) => parseForQty(n, qtyScaleStore));
        } else if (Array.isArray(c.props.list)) {
            (c.props.list as Array<HTMLElement>).forEach((p) => {
                Array.from(p.querySelectorAll("[data-qty-parse]")).forEach((n) =>
                    parseForQty(n, qtyScaleStore)
                );
            });
        } else {
            parseForQty(c.props.list as HTMLElement, qtyScaleStore);
        }
        return;
    }

    if (c.props.childNodesOf) {
        const childEl = c.props.childNodesOf as HTMLElement;
        const isListElement =
            Boolean(childEl) &&
            (childEl.nodeName === "UL" ||
                childEl.nodeName === "OL" ||
                childEl.querySelector("li") != null);
        if (isIngredient || isListElement) {
            parseForQty(childEl, qtyScaleStore);
        } else {
            Array.from(
                childEl.querySelectorAll("[data-qty-parse]")
            ).forEach((n) => parseForQty(n, qtyScaleStore));
        }
        return;
    }
}

function injectQuantities(parsedRecipe: ParsedRecipe) {
    parsedRecipe.globalIngredients.forEach((c) =>
        parseComponentQuantities(c, parsedRecipe.qtyScaleStore, true)
    );
    parsedRecipe.steps.forEach((step) => {
        step.stepIngredients.forEach((c) =>
            parseComponentQuantities(c, parsedRecipe.qtyScaleStore, true)
        );
        step.mainComponents.forEach((c) =>
            parseComponentQuantities(c, parsedRecipe.qtyScaleStore, false)
        );
    });
}

function isHeadingComponent(c: ParsedRecipeComponent): boolean {
    return (
        c.type === RecipeLeaf &&
        typeof c.props?.asTag === "string" &&
        /^H[1-6]$/i.test(c.props.asTag as string)
    );
}

function highlightInComponent(
    c: ParsedRecipeComponent,
    highlightIngredients: Array<string>
) {
    if (isHeadingComponent(c)) {
        return;
    }
    switch (c.type) {
        case RecipeLeaf:
            highlightIngredientsInDom(
                c.props.childNodesOf as HTMLElement,
                highlightIngredients
            );
            break;

        case SelectableStepList:
            c.props.highlightIngredients = highlightIngredients;
            if (c.props.kind == "ol") {
                highlightIngredientsInDom(
                    c.props.list as HTMLElement,
                    highlightIngredients
                );
            } else {
                (c.props.list as Array<HTMLElement>).forEach((p) => {
                    highlightIngredientsInDom(p, highlightIngredients);
                });
            }
            break;

        default:
            break;
    }
}

function injectHighlightedIngredients(parsedRecipe: ParsedRecipe) {
    if (!parsedRecipe.highlightIngredients || parsedRecipe.highlightIngredients.length === 0) {
        return;
    }
    parsedRecipe.steps.forEach((step) => {
        step.mainComponents.forEach((c) =>
            highlightInComponent(c, parsedRecipe.highlightIngredients)
        );
    });
}

export function getDirectionsRegex(plugin?: RecipeViewPlugin): RegExp {
    const rawSetting =
        plugin?.settings?.directionsHeaderRegex ||
        DEFAULT_DIRECTIONS_HEADER_REGEX;

    if ((rawSetting as unknown) instanceof RegExp) {
        return new RegExp((rawSetting as unknown as RegExp).source, "i");
    }

    try {
        return new RegExp(rawSetting, "i");
    } catch {
        return new RegExp(DEFAULT_DIRECTIONS_HEADER_REGEX, "i");
    }
}

export function getIngredientsRegex(plugin?: RecipeViewPlugin): RegExp {
    const rawSetting =
        plugin?.settings?.ingredientsHeaderRegex ||
        plugin?.settings?.sideColumnRegex ||
        DEFAULT_INGREDIENTS_HEADER_REGEX;

    if ((rawSetting as unknown) instanceof RegExp) {
        return new RegExp((rawSetting as unknown as RegExp).source, "i");
    }

    try {
        return new RegExp(rawSetting, "i");
    } catch {
        return new RegExp(DEFAULT_INGREDIENTS_HEADER_REGEX, "i");
    }
}

export function isDirectionsHeaderElement(
    item: HTMLElement,
    directionsRegex?: RegExp
): boolean {
    const regex = directionsRegex || getDirectionsRegex();
    const text = (item.textContent || "").trim();
    if (!text) return false;
    if (item.nodeName.match(/^H[1-6]$/)) {
        return regex.test(text);
    }
    // Also support standalone paragraph as directions header, e.g. "<p>Zubereitung</p>"
    if (item.nodeName === "P" && item.children.length <= 1) {
        return regex.test(text);
    }
    return false;
}

export function isIngredientsHeaderElement(
    item: HTMLElement,
    ingredientsRegex?: RegExp
): boolean {
    const regex = ingredientsRegex || getIngredientsRegex();
    const text = (item.textContent || "").trim();
    if (!text) return false;
    if (item.nodeName.match(/^H[1-6]$/)) {
        return regex.test(text);
    }
    if (item.nodeName === "P" && item.children.length <= 1) {
        return regex.test(text);
    }
    return false;
}

/**
 * Normalizes Markdown text so that any non-list text line directly following an unordered list
 * item line is separated by a blank line. This avoids CommonMark lazy-continuation swallowing
 * instructions into the preceding list item <li>.
 */
export function normalizeMarkdownStepListSpacing(markdown: string): string {
    const lines = markdown.split(/\r?\n/);
    const resultLines: Array<string> = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        resultLines.push(line);

        const isListItem = /^\s*[-*+]\s+/.test(line);
        if (isListItem && i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            const isNextNonListText =
                nextLine.trim().length > 0 &&
                !/^\s*[-*+]\s+/.test(nextLine) &&
                !/^\s*\d+\.\s+/.test(nextLine) &&
                !/^\s*#{1,6}\s+/.test(nextLine) &&
                !/^\s*(?:---|\*\*\*|___)\s*$/.test(nextLine) &&
                !/^\s*>/.test(nextLine);

            if (isNextNonListText) {
                resultLines.push("");
            }
        }
    }

    return resultLines.join("\n");
}

/**
 * Extracts trailing instruction paragraphs or lines from a step <ul> element,
 * in case lazy continuation nested them inside the last <li> without a preceding blank line.
 */
export function extractTrailingInstructionsFromList(ul: HTMLElement): Array<HTMLElement> {
    const extractedParagraphs: Array<HTMLElement> = [];
    const lis = Array.from(ul.children).filter(
        (el): el is HTMLLIElement => el.nodeName === "LI"
    );

    for (const li of lis) {
        // 1. Any child <p> elements inside <li> from lazy continuation
        const childParagraphs = Array.from(li.querySelectorAll("p"));
        if (childParagraphs.length > 0) {
            // Check if there is non-whitespace text before the first <p>
            let hasPrecedingText = false;
            for (let i = 0; i < li.childNodes.length; i++) {
                const node = li.childNodes[i];
                if (node === childParagraphs[0]) {
                    break;
                }
                if (
                    node.nodeType === Node.TEXT_NODE &&
                    (node.textContent || "").trim().length > 0
                ) {
                    hasPrecedingText = true;
                    break;
                }
            }

            // In loose lists (<li><p>Text</p></li>), childParagraphs[0] is the list item's own text.
            // Only extract trailing paragraphs: if hasPrecedingText, all childParagraphs are trailing;
            // otherwise, the first <p> is the item's text, and childParagraphs.slice(1) are trailing.
            const trailingParas = hasPrecedingText
                ? childParagraphs
                : childParagraphs.slice(1);

            for (const p of trailingParas) {
                p.remove();
                if ((p.textContent || "").trim().length > 0) {
                    extractedParagraphs.push(p);
                }
            }
        }

        // 2. Any trailing text lines after the first line (newline-separated)
        const rawText = li.textContent || "";
        if (rawText.includes("\n")) {
            const lines = rawText
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter((l) => l.length > 0);
            if (lines.length > 1) {
                li.textContent = lines[0];
                for (let k = 1; k < lines.length; k++) {
                    const p = document.createElement("p");
                    p.textContent = lines[k];
                    extractedParagraphs.push(p);
                }
            }
        }
    }

    return extractedParagraphs;
}

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
        if (isDirectionsHeaderElement(contentItems[i], directionsRegex)) {
            directionsHeaderIndex = i;
            break;
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

export function parseRecipeMarkdown(
    plugin: RecipeViewPlugin,
    text: string,
    path: string,
    component: Component,
    metadata?: CachedMetadata | null
) {
    const frontmatterCover = resolveCoverImage(plugin, metadata?.frontmatter, path);
    const textTimerMinutes = calculateTotalTimerMinutes(text);

    const result: ParsedRecipe = {
        title: "",
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