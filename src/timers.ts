export const TIMER_REGEX = /@timer\{\s*([^}|]+?)\s*(?:\|\s*([^}]+?)\s*)?\}/g;

export type TimerTimeFormat = "de" | "en" | "compact" | "minutes";

export interface TimerMatch {
    index: number;
    length: number;
    minutes: string;
    label: string | null;
}

export interface TimerSettings {
    timerShortcutName: string;
    timerUrlTemplate: string;
    timerTimeFormat?: TimerTimeFormat;
}

/**
 * Parse a raw timer duration string into numeric minutes.
 * Supports plain numbers (defaulting to minutes) as well as units like
 * h/hr/hrs/std, m/min/mins, and s/sec/sek (including combined forms like "1h 30m").
 */
export function parseDurationToMinutes(rawDuration: string): number {
    const cleaned = rawDuration.trim();
    if (!cleaned) {
        return 0;
    }

    // Plain numeric value (e.g. "30", "1.5", "1,5") -> minutes
    if (/^\d+(?:[.,]\d+)?$/.test(cleaned)) {
        const val = parseFloat(cleaned.replace(",", "."));
        return isFinite(val) && val > 0 ? val : 0;
    }

    // Check for explicit unit tokens (e.g. "1h 30m", "2 Std. 15 Min", "45 min", "90s")
    const unitPattern =
        /(\d+(?:[.,]\d+)?)\s*(std\.?|stunden?|hrs?|hours?|h|minuten?|mins?|min\.?|m|sekunden?|secs?|sek\.?|s)\b/gi;
    const unitMatches = Array.from(cleaned.matchAll(unitPattern));
    if (unitMatches.length > 0) {
        let total = 0;
        for (const m of unitMatches) {
            const num = parseFloat(m[1].replace(",", "."));
            if (!isFinite(num) || num <= 0) continue;
            const unit = m[2].toLowerCase();
            if (unit.startsWith("h") || unit.startsWith("std") || unit.startsWith("stunde")) {
                total += num * 60;
            } else if (unit.startsWith("s")) {
                total += num / 60;
            } else {
                total += num;
            }
        }
        return total > 0 ? Number(total.toFixed(2)) : 0;
    }

    // Fallback: extract leading number as minutes
    const fallbackMatch = cleaned.match(/(\d+(?:[.,]\d+)?)/);
    if (fallbackMatch) {
        const val = parseFloat(fallbackMatch[1].replace(",", "."));
        return isFinite(val) && val > 0 ? val : 0;
    }

    return 0;
}

/**
 * Find all @timer{minutes} or @timer{minutes|label} occurrences in a string.
 */
export function matchTimers(str: string): Array<TimerMatch> {
    return Array.from(str.matchAll(TIMER_REGEX)).map((match) => ({
        index: match.index ?? 0,
        length: match[0].length,
        minutes: match[1].trim(),
        label: match[2]?.trim() ? match[2].trim() : null,
    }));
}

/**
 * Parse a frontmatter time property (number or string) into minutes.
 */
export function parseFrontmatterTimeMinutes(raw: unknown): number {
    if (raw == null) {
        return 0;
    }
    if (typeof raw === "number") {
        return isFinite(raw) && raw > 0 ? raw : 0;
    }
    if (typeof raw === "string") {
        return parseDurationToMinutes(raw);
    }
    return 0;
}

/**
 * Sum all @timer{...} durations in a markdown/plain-text string (in minutes).
 * Strips YAML frontmatter and code blocks before matching so only active recipe timers are counted.
 */
export function calculateTotalTimerMinutes(str: string): number {
    if (!str) {
        return 0;
    }
    const withoutFrontmatter = str.replace(
        /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,
        ""
    );
    const withoutCode = withoutFrontmatter
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`[^`\r\n]+`/g, "");
    const matches = matchTimers(withoutCode);
    const sum = matches.reduce(
        (acc, m) => acc + parseDurationToMinutes(m.minutes),
        0
    );
    return Number(sum.toFixed(2));
}

/**
 * Format a numeric duration in minutes into a human-readable string.
 */
export function formatDuration(
    minutes: number,
    format: TimerTimeFormat = "de"
): string {
    if (!isFinite(minutes) || minutes <= 0) {
        return "";
    }
    const cleanNum = Number.isInteger(minutes)
        ? String(minutes)
        : String(Number(minutes.toFixed(1)));
    return formatDurationText(cleanNum, format);
}

/**
 * Build the iOS Shortcuts URL for a timer.
 * Note: Always passes the exact numeric minutes string to `text=<MINUTEN>`,
 * regardless of how the visible button label formats hours/minutes.
 * Default URL schema:
 * shortcuts://run-shortcut?name=<SHORTCUT_NAME>&input=text&text=<MINUTEN>[|<URL_ENCODED_LABEL>]
 */
export function buildTimerUrl(
    minutes: string,
    label?: string | null,
    shortcutName = "StartTimer",
    urlTemplate = ""
): string {
    const cleanShortcut = (shortcutName || "StartTimer").trim() || "StartTimer";
    const cleanMinutes = minutes.trim();
    const cleanLabel = label?.trim() || "";

    const encodedShortcut = encodeURIComponent(cleanShortcut);
    const encodedMinutes = encodeURIComponent(cleanMinutes);
    const encodedLabel = cleanLabel ? encodeURIComponent(cleanLabel) : "";
    const textParam = cleanLabel ? `${encodedMinutes}|${encodedLabel}` : encodedMinutes;

    const trimmedTemplate = urlTemplate?.trim() || "";
    if (!trimmedTemplate) {
        return `shortcuts://run-shortcut?name=${encodedShortcut}&input=text&text=${textParam}`;
    }

    return trimmedTemplate
        .replace(/\[\|(?:<LABEL>|<URL_ENCODED_LABEL>|\{label\})\]/gi, cleanLabel ? `|${encodedLabel}` : "")
        .replace(/<SHORTCUT_NAME>|<SHORTCUT>|\{shortcut\}/gi, encodedShortcut)
        .replace(/<MINUTES>|<MINUTEN>|\{minutes\}/gi, encodedMinutes)
        .replace(/<LABEL>|<URL_ENCODED_LABEL>|\{label\}/gi, encodedLabel)
        .replace(/<TEXT>|\{text\}/gi, textParam);
}

/**
 * Format a duration in minutes into a human-readable string.
 * Converts durations >= 60 minutes into hours and minutes unless format is "minutes".
 */
export function formatDurationText(
    minutes: string,
    format: TimerTimeFormat = "de"
): string {
    const cleanMinutes = minutes.trim();
    const num = parseDurationToMinutes(cleanMinutes);

    if (num <= 0 || format === "minutes") {
        return `${cleanMinutes} Min`;
    }

    const displayUnder60 = Number.isInteger(num)
        ? String(num)
        : String(Number(num.toFixed(1)));

    if (num < 60) {
        switch (format) {
            case "en":
                return `${displayUnder60} min`;
            case "compact":
                return `${displayUnder60}m`;
            case "de":
            default:
                return `${displayUnder60} Min`;
        }
    }

    const totalMinutes = Math.round(num);
    const hours = Math.floor(totalMinutes / 60);
    const remMinutes = totalMinutes % 60;

    switch (format) {
        case "en": {
            const hrUnit = hours === 1 ? "hr" : "hrs";
            return remMinutes > 0
                ? `${hours} ${hrUnit} ${remMinutes} min`
                : `${hours} ${hrUnit}`;
        }
        case "compact": {
            return remMinutes > 0
                ? `${hours}h ${remMinutes}m`
                : `${hours}h`;
        }
        case "de":
        default: {
            return remMinutes > 0
                ? `${hours} Std. ${remMinutes} Min`
                : `${hours} Std.`;
        }
    }
}

/**
 * Format the visible label of a timer button, e.g.
 * - "⏱ 30 Min (Teig ruhen)"
 * - "⏱ 1 Std. ( Gehen lassen )"
 * - "⏱ 1 Std. 30 Min (Schmoren)"
 */
export function formatTimerButtonText(
    minutes: string,
    label?: string | null,
    format: TimerTimeFormat = "de"
): string {
    const durationText = formatDurationText(minutes, format);
    const cleanLabel = label?.trim();
    if (cleanLabel) {
        return `⏱ ${durationText} (${cleanLabel})`;
    }
    return `⏱ ${durationText}`;
}

/**
 * Recursively walk a DOM subtree, replace @timer{...} syntax in text nodes
 * with styled, clickable timer links/buttons, and return the total summed minutes.
 */
export function parseForTimers(node: Node, settings: TimerSettings): number {
    if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (
            el.hasAttribute("data-timer") ||
            el.classList.contains("recipe-timer-btn")
        ) {
            const existing = parseFloat(
                el.getAttribute("data-timer-minutes") || "0"
            );
            return isFinite(existing) && existing > 0 ? existing : 0;
        }
        if (el.tagName === "CODE" || el.tagName === "PRE") {
            return 0;
        }
    }

    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        if (!text.includes("@timer{")) {
            return 0;
        }

        const matches = matchTimers(text);
        if (matches.length === 0) {
            return 0;
        }

        const parent = node.parentNode;
        if (!parent) {
            return 0;
        }

        let currentIndex = 0;
        let sumMinutes = 0;
        for (const match of matches) {
            if (match.index > currentIndex) {
                parent.insertBefore(
                    document.createTextNode(text.slice(currentIndex, match.index)),
                    node
                );
            }

            const numericMinutes = parseDurationToMinutes(match.minutes);
            sumMinutes += numericMinutes;

            const shortcutMinutesStr =
                numericMinutes > 0 && !/^\d+(?:[.,]\d+)?$/.test(match.minutes.trim())
                    ? String(numericMinutes)
                    : match.minutes;

            const url = buildTimerUrl(
                shortcutMinutesStr,
                match.label,
                settings.timerShortcutName,
                settings.timerUrlTemplate
            );
            const buttonText = formatTimerButtonText(
                match.minutes,
                match.label,
                settings.timerTimeFormat || "de"
            );

            const timerLink = document.createElement("a");
            timerLink.className = "recipe-timer-btn";
            timerLink.setAttribute("href", url);
            timerLink.setAttribute("data-timer", "true");
            timerLink.setAttribute("data-timer-minutes", String(numericMinutes));
            timerLink.setAttribute("data-qty-no-parse", "true");
            timerLink.textContent = buttonText;

            // Stop propagation so clicking inside a step <label> does not get swallowed
            // by the step radio input while still triggering the native shortcuts:// URL
            timerLink.addEventListener("click", (e) => {
                e.stopPropagation();
            });

            parent.insertBefore(timerLink, node);
            currentIndex = match.index + match.length;
        }

        if (currentIndex < text.length) {
            parent.insertBefore(
                document.createTextNode(text.slice(currentIndex)),
                node
            );
        }

        parent.removeChild(node);
        return Number(sumMinutes.toFixed(2));
    }

    let total = 0;
    if (node.hasChildNodes()) {
        Array.from(node.childNodes).forEach((child) => {
            total += parseForTimers(child, settings);
        });
    }
    return Number(total.toFixed(2));
}

export interface IngredientTagMatch {
    index: number;
    length: number;
    name: string;
}

export const INGREDIENT_MARKER_REGEX =
    /(?<![a-zA-ZäöüÄÖÜß0-9_.-])@(?:\{([^}\r\n]+)\}|([a-zA-ZäöüÄÖÜß0-9_-]+)(?![a-zA-ZäöüÄÖÜß0-9_{}-]))/g;

/**
 * Find all marked ingredient terms (`@Butter` or `@{brauner Zucker}`) in an ingredient line,
 * explicitly excluding `@timer` directives.
 */
export function matchIngredientTags(str: string): Array<IngredientTagMatch> {
    const results: Array<IngredientTagMatch> = [];
    for (const match of str.matchAll(INGREDIENT_MARKER_REGEX)) {
        const bracketedName = match[1]?.trim();
        const singleWordName = match[2]?.trim();
        if (singleWordName && singleWordName.toLowerCase() === "timer") {
            continue;
        }
        const name = bracketedName || singleWordName;
        if (!name) {
            continue;
        }
        results.push({
            index: match.index ?? 0,
            length: match[0].length,
            name,
        });
    }
    return results;
}

/**
 * Extract `@Word` and `@{Multi Word}` markers from an ingredient text string
 * and return both the cleaned display text (without `@` or `{}`) and the extracted terms.
 */
export function extractMarkedIngredientsFromText(str: string): {
    cleanedText: string;
    extracted: Array<string>;
} {
    if (!str || !str.includes("@")) {
        return { cleanedText: str, extracted: [] };
    }

    const matches = matchIngredientTags(str);
    if (matches.length === 0) {
        return { cleanedText: str, extracted: [] };
    }

    const extracted: Array<string> = [];
    let cleanedText = "";
    let currentIndex = 0;

    for (const match of matches) {
        if (match.index > currentIndex) {
            cleanedText += str.slice(currentIndex, match.index);
        }
        cleanedText += match.name;
        extracted.push(match.name);
        currentIndex = match.index + match.length;
    }

    if (currentIndex < str.length) {
        cleanedText += str.slice(currentIndex);
    }

    return { cleanedText, extracted };
}

/**
 * Recursively walk an ingredient DOM subtree, strip `@` and `{}` from marked
 * ingredient terms in text nodes, and return all extracted ingredient keywords.
 */
export function extractAndCleanIngredientListDom(node: Node): Array<string> {
    if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (
            el.hasAttribute("data-timer") ||
            el.classList.contains("recipe-timer-btn") ||
            el.tagName === "CODE" ||
            el.tagName === "PRE"
        ) {
            return [];
        }
    }

    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        if (!text.includes("@")) {
            return [];
        }
        const { cleanedText, extracted } = extractMarkedIngredientsFromText(text);
        if (extracted.length > 0) {
            node.textContent = cleanedText;
        }
        return extracted;
    }

    const collected: Array<string> = [];
    if (node.hasChildNodes()) {
        Array.from(node.childNodes).forEach((child) => {
            collected.push(...extractAndCleanIngredientListDom(child));
        });
    }
    return collected;
}

/**
 * Deduplicate (case-insensitively) and sort extracted ingredient keywords
 * descending by character length so longer multi-word terms match first.
 */
export function sortHighlightIngredients(terms: Array<string>): Array<string> {
    const seen = new Set<string>();
    const unique: Array<string> = [];
    for (const raw of terms) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(trimmed);
        }
    }
    return unique.sort((a, b) => b.length - a.length);
}

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a case-insensitive RegExp that matches marked ingredient terms (`@Word` or `@{Multi Word}`)
 * as well as any keywords from `highlightIngredients` at word boundaries.
 */
export function buildHighlightIngredientsRegex(
    highlightIngredients: Array<string> = []
): RegExp {
    const sorted = sortHighlightIngredients(highlightIngredients);
    const keywordPattern =
        sorted.length > 0 ? sorted.map(escapeRegExp).join("|") : null;

    if (keywordPattern) {
        return new RegExp(
            `(?<![a-zA-ZäöüÄÖÜß0-9_.-])(?:@\\{([^}\\r\\n]+)\\}|@([a-zA-ZäöüÄÖÜß0-9_-]+)(?![a-zA-ZäöüÄÖÜß0-9_{}-])|(${keywordPattern})(?![a-zA-ZäöüÄÖÜß0-9_-]))`,
            "gi"
        );
    } else {
        return new RegExp(
            `(?<![a-zA-ZäöüÄÖÜß0-9_.-])(?:@\\{([^}\\r\\n]+)\\}|@([a-zA-ZäöüÄÖÜß0-9_-]+)(?![a-zA-ZäöüÄÖÜß0-9_{}-]))`,
            "gi"
        );
    }
}

/**
 * Find all occurrences of `highlightIngredients` in a step text string.
 */
export function matchHighlightedIngredientsInStep(
    stepText: string,
    highlightIngredients: Array<string> = []
): Array<IngredientTagMatch> {
    if (!stepText) {
        return [];
    }
    const regex = buildHighlightIngredientsRegex(highlightIngredients);
    const results: Array<IngredientTagMatch> = [];
    for (const match of stepText.matchAll(regex)) {
        const bracketedName = match[1]?.trim();
        const singleWordName = match[2]?.trim();
        const keywordName = match[3]?.trim();
        if (singleWordName && singleWordName.toLowerCase() === "timer") {
            continue;
        }
        const name = bracketedName || singleWordName || keywordName || match[0];
        if (!name) {
            continue;
        }
        results.push({
            index: match.index ?? 0,
            length: match[0].length,
            name,
        });
    }
    return results;
}

/**
 * Recursively walk a step DOM subtree and wrap occurrences of `highlightIngredients`
 * in text nodes with `<span class="recipe-ingredient-tag">Treffer</span>`.
 * Skips timers, existing ingredient tags, scaled quantities, links, and code elements.
 */
export function highlightIngredientsInDom(
    node: Node,
    highlightIngredients: Array<string> = []
): void {
    const regex = buildHighlightIngredientsRegex(highlightIngredients);
    highlightIngredientsWithRegex(node, regex);
}

function highlightIngredientsWithRegex(node: Node, regex: RegExp): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (
            el.hasAttribute("data-timer") ||
            el.hasAttribute("data-ingredient-tag") ||
            el.hasAttribute("data-qty") ||
            el.hasAttribute("data-qty-no-parse") ||
            el.classList.contains("recipe-timer-btn") ||
            el.classList.contains("recipe-ingredient-tag") ||
            el.tagName === "CODE" ||
            el.tagName === "PRE" ||
            el.tagName === "A"
        ) {
            return;
        }
    }

    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        if (!text.trim()) {
            return;
        }

        regex.lastIndex = 0;
        const matches = Array.from(text.matchAll(regex));
        if (matches.length === 0) {
            return;
        }

        const parent = node.parentNode;
        if (!parent) {
            return;
        }

        let currentIndex = 0;
        for (const match of matches) {
            const bracketedName = match[1]?.trim();
            const singleWordName = match[2]?.trim();
            const keywordName = match[3]?.trim();
            if (singleWordName && singleWordName.toLowerCase() === "timer") {
                continue;
            }
            const matchedName = bracketedName || singleWordName || keywordName || match[0];
            if (!matchedName) {
                continue;
            }

            const matchIndex = match.index ?? 0;
            if (matchIndex > currentIndex) {
                parent.insertBefore(
                    document.createTextNode(text.slice(currentIndex, matchIndex)),
                    node
                );
            }

            const tagSpan = document.createElement("span");
            tagSpan.className = "recipe-ingredient-tag";
            tagSpan.setAttribute("data-ingredient-tag", "true");
            tagSpan.setAttribute("data-qty-no-parse", "true");
            tagSpan.textContent = matchedName;

            parent.insertBefore(tagSpan, node);
            currentIndex = matchIndex + match[0].length;
        }

        if (currentIndex < text.length) {
            parent.insertBefore(
                document.createTextNode(text.slice(currentIndex)),
                node
            );
        }

        parent.removeChild(node);
        return;
    }

    if (node.hasChildNodes()) {
        Array.from(node.childNodes).forEach((child) => {
            highlightIngredientsWithRegex(child, regex);
        });
    }
}

