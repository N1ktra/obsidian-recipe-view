import RecipeViewPlugin from "./main";
import { TFile } from "obsidian";

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
