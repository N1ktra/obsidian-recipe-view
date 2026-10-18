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
        .replace(/\[\|(?:<URL_ENCODED_LABEL>|\{label\})\]/gi, cleanLabel ? `|${encodedLabel}` : "")
        .replace(/<SHORTCUT_NAME>|\{shortcut\}/gi, encodedShortcut)
        .replace(/<MINUTEN>|\{minutes\}/gi, encodedMinutes)
        .replace(/<URL_ENCODED_LABEL>|\{label\}/gi, encodedLabel)
        .replace(/\{text\}/gi, textParam);
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
    const num = parseFloat(cleanMinutes.replace(",", "."));

    if (isNaN(num) || num < 0 || format === "minutes") {
        return `${cleanMinutes} Min`;
    }

    if (num < 60) {
        switch (format) {
            case "en":
                return `${cleanMinutes} min`;
            case "compact":
                return `${cleanMinutes}m`;
            case "de":
            default:
                return `${cleanMinutes} Min`;
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
 * Recursively walk a DOM subtree and replace @timer{...} syntax in text nodes
 * with styled, clickable timer links/buttons.
 */
export function parseForTimers(node: Node, settings: TimerSettings): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (
            el.hasAttribute("data-timer") ||
            el.classList.contains("recipe-timer-btn") ||
            el.tagName === "CODE" ||
            el.tagName === "PRE"
        ) {
            return;
        }
    }

    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        if (!text.includes("@timer{")) {
            return;
        }

        const matches = matchTimers(text);
        if (matches.length === 0) {
            return;
        }

        const parent = node.parentNode;
        if (!parent) {
            return;
        }

        let currentIndex = 0;
        for (const match of matches) {
            if (match.index > currentIndex) {
                parent.insertBefore(
                    document.createTextNode(text.slice(currentIndex, match.index)),
                    node
                );
            }

            const url = buildTimerUrl(
                match.minutes,
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
        return;
    }

    if (node.hasChildNodes()) {
        Array.from(node.childNodes).forEach((child) => parseForTimers(child, settings));
    }
}
