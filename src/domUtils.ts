import {
    DEFAULT_DIRECTIONS_HEADER_REGEX,
    DEFAULT_INGREDIENTS_HEADER_REGEX,
} from "./settings";
import RecipeViewPlugin from "./main";
import {
    LEADING_CHECKBOX_REGEX,
    stripLeadingCheckboxSyntax,
} from "./quantities";
import { extractAndCleanIngredientListDom } from "./timers";

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

        // If quantities were already injected into this LI, skip re-sanitizing
        // to prevent stripping leading whitespace between quantity spans and text
        if (li.querySelector("[data-qty]")) {
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
            continue;
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
            } else if (nativeCheckboxes.length > 0 || dataTask != null) {
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
    // Also support standalone short paragraph as directions header, e.g. "<p>Zubereitung</p>"
    if (item.nodeName === "P" && item.children.length <= 1) {
        if (text.endsWith(".") || text.endsWith("!") || text.length > 50) {
            return false;
        }
        return new RegExp(`(?:^|\\b)(?:${regex.source})(?:\\b|$)`, "i").test(text);
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
        if (text.endsWith(".") || text.endsWith("!") || text.length > 50) {
            return false;
        }
        return new RegExp(`(?:^|\\b)(?:${regex.source})(?:\\b|$)`, "i").test(text);
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
