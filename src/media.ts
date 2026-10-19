import RecipeViewPlugin from "./main";
import { TFile } from "obsidian";

const VIDEO_EXT_REGEX = /\.(mp4|webm|mov|m4v|mkv|ogv|ogg)(?:[?#]|$)/i;

/**
 * Checks whether a given URL or filename points to a video file format.
 */
export function isVideoFileUrl(url: string): boolean {
    if (!url) return false;
    return VIDEO_EXT_REGEX.test(url.trim());
}

/**
 * Extracts YouTube video ID and returns a privacy-enhanced embed URL, or null if not YouTube.
 */
export function getYouTubeEmbedUrl(url: string): string | null {
    if (!url) return null;
    const trimmed = url.trim();

    // youtu.be/<id>
    const shortMatch = trimmed.match(
        /^https?:\/\/(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)(?:\?.*)?$/i
    );
    if (shortMatch) {
        return `https://www.youtube-nocookie.com/embed/${shortMatch[1]}`;
    }

    // youtube.com/watch?v=<id> or youtube.com/shorts/<id> or youtube.com/embed/<id>
    const longMatch = trimmed.match(
        /^https?:\/\/(?:[a-zA-Z0-9-]+\.)?youtube(?:-nocookie)?\.com\/(?:watch\?.*v=|embed\/|shorts\/)([a-zA-Z0-9_-]+)/i
    );
    if (longMatch) {
        return `https://www.youtube-nocookie.com/embed/${longMatch[1]}`;
    }

    return null;
}

/**
 * Extracts Vimeo video ID and returns an embed URL, or null if not Vimeo.
 */
export function getVimeoEmbedUrl(url: string): string | null {
    if (!url) return null;
    const trimmed = url.trim();
    const match = trimmed.match(
        /^https?:\/\/(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/)?([0-9]+)/i
    );
    if (match) {
        return `https://player.vimeo.com/video/${match[1]}`;
    }
    return null;
}

/**
 * Returns a standardized iframe embed URL if the URL is an external video service (YouTube / Vimeo).
 */
export function getVideoEmbedUrl(url: string): string | null {
    return getYouTubeEmbedUrl(url) || getVimeoEmbedUrl(url);
}

/**
 * Checks whether a media path/URL is either a direct video file or video service link.
 */
export function isVideoMedia(url: string): boolean {
    if (!url) return false;
    return isVideoFileUrl(url) || Boolean(getVideoEmbedUrl(url));
}

/**
 * Resolves a vault file path, wikilink, or external URL into an Obsidian resource path.
 */
export function resolveMediaResourcePath(
    plugin: RecipeViewPlugin | undefined,
    linkpath: string,
    sourcePath: string
): string {
    if (!linkpath) return "";
    let cleanPath = linkpath.trim();

    // Strip surrounding quotes if present
    if (
        (cleanPath.startsWith('"') && cleanPath.endsWith('"')) ||
        (cleanPath.startsWith("'") && cleanPath.endsWith("'"))
    ) {
        cleanPath = cleanPath.slice(1, -1).trim();
    }

    // Strip wikilink syntax: ![[image.png|alias]] or [[image.png]]
    const wikiMatch = cleanPath.match(/^!?\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/);
    if (wikiMatch) {
        cleanPath = wikiMatch[1].trim();
    }

    // Strip markdown link/image syntax: ![alt](url) or [text](url)
    const mdMatch = cleanPath.match(/^!?\[[^\]]*\]\(([^)]+)\)$/);
    if (mdMatch) {
        cleanPath = mdMatch[1].trim();
    }

    if (!cleanPath) return "";

    // External URL or direct protocol URI
    if (/^(?:https?|app|data|blob|capacitor):/i.test(cleanPath)) {
        return cleanPath;
    }

    // Resolve internal vault file
    try {
        if (plugin?.app?.metadataCache && plugin?.app?.vault) {
            const fileDest =
                plugin.app.metadataCache.getFirstLinkpathDest(cleanPath, sourcePath) ||
                plugin.app.metadataCache.getFirstLinkpathDest(decodeURIComponent(cleanPath), sourcePath) ||
                plugin.app.vault.getAbstractFileByPath(cleanPath) ||
                plugin.app.vault.getAbstractFileByPath(decodeURIComponent(cleanPath));

            if (fileDest instanceof TFile) {
                return plugin.app.vault.getResourcePath(fileDest);
            }
        }
    } catch (_e) {
        /* ignore in test/mock environment */
    }

    return cleanPath;
}

/**
 * Extract and resolve a cover image or video URL/resource path from frontmatter metadata.
 */
export function resolveCoverImage(
    plugin: RecipeViewPlugin,
    frontmatter: Record<string, unknown> | undefined,
    sourcePath: string
): string {
    if (!frontmatter) {
        return "";
    }

    const coverKey = (plugin.settings?.coverProperty || "cover").trim() || "cover";
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

    return resolveMediaResourcePath(plugin, rawStr, sourcePath);
}

/**
 * Extracts width and height dimensions from media attributes or Obsidian markdown syntax
 * (e.g. alt="400", alt="400x300", alt="filename|400", width="400").
 */
export function extractMediaDimensions(
    el: HTMLElement
): { width?: string; height?: string } {
    let width = el.getAttribute("width") || el.style.width || "";
    let height = el.getAttribute("height") || el.style.height || "";

    if (!width) {
        const alt = (el.getAttribute("alt") || "").trim();
        const match = alt.match(/(?:^|\|)(\d+)(?:x(\d+))?$/);
        if (match) {
            width = match[1];
            if (match[2]) {
                height = match[2];
            }
        }
    }

    if (!width) {
        const src = (el.getAttribute("src") || "").trim();
        const match = src.match(/\|(\d+)(?:x(\d+))?$/);
        if (match) {
            width = match[1];
            if (match[2]) {
                height = match[2];
            }
        }
    }

    const res: { width?: string; height?: string } = {};
    if (width) {
        res.width = width.endsWith("px") || width.endsWith("%") ? width : `${width}px`;
    }
    if (height) {
        res.height = height.endsWith("px") || height.endsWith("%") ? height : `${height}px`;
    }
    return res;
}

/**
 * Process all embedded videos, markdown video images, YouTube/Vimeo links,
 * and native video/iframe tags inside rendered recipe HTML.
 */
export function processEmbeddedMedia(
    container: HTMLElement,
    plugin: RecipeViewPlugin,
    sourcePath: string
): void {
    if (!container) return;

    // 1. Process Obsidian internal embeds (e.g. ![[video.mp4]] or ![[video.webm]])
    const embeds = Array.from(
        container.querySelectorAll(".internal-embed, .media-embed, .video-embed")
    ) as Array<HTMLElement>;

    for (const embed of embeds) {
        const src = (embed.getAttribute("src") || "").trim();
        const existingVideo = embed.querySelector("video");
        const existingIframe = embed.querySelector("iframe");
        const dims = extractMediaDimensions(embed);

        if (existingVideo) {
            existingVideo.classList.add("recipe-embedded-video");
            existingVideo.controls = true;
            existingVideo.playsInline = true;
            existingVideo.preload = "metadata";
            if (dims.width) {
                existingVideo.style.width = dims.width;
                existingVideo.style.maxWidth = "100%";
            }
            if (dims.height) {
                existingVideo.style.height = dims.height;
                existingVideo.style.maxHeight = dims.height;
            }
            const currentSrc = existingVideo.getAttribute("src") || src;
            if (currentSrc && !/^(?:https?|app|data|blob|capacitor):/i.test(currentSrc)) {
                existingVideo.src = resolveMediaResourcePath(plugin, currentSrc, sourcePath);
            }
            continue;
        }

        if (existingIframe) {
            existingIframe.classList.add("recipe-embedded-iframe");
            if (dims.width) {
                const parent = existingIframe.parentElement;
                if (parent) parent.style.maxWidth = dims.width;
            }
            continue;
        }

        const embedVideoUrl = getVideoEmbedUrl(src);
        if (embedVideoUrl) {
            const isShorts = /\/shorts\//i.test(src);
            const wrapper = document.createElement("div");
            wrapper.className = isShorts
                ? "recipe-video-wrapper recipe-video-shorts"
                : "recipe-video-wrapper";
            if (dims.width) {
                wrapper.style.maxWidth = dims.width;
            }
            if (dims.width && dims.height) {
                wrapper.style.aspectRatio = `${dims.width.replace("px", "")} / ${dims.height.replace("px", "")}`;
            }
            const iframe = document.createElement("iframe");
            iframe.className = "recipe-embedded-iframe";
            iframe.src = embedVideoUrl;
            iframe.setAttribute("frameborder", "0");
            iframe.setAttribute(
                "allow",
                "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            );
            iframe.setAttribute("allowfullscreen", "true");
            wrapper.appendChild(iframe);
            embed.replaceWith(wrapper);
            continue;
        }

        if (isVideoFileUrl(src) || embed.classList.contains("video-embed")) {
            const resSrc = resolveMediaResourcePath(plugin, src, sourcePath);
            const videoEl = document.createElement("video");
            videoEl.className = "recipe-embedded-video";
            videoEl.src = resSrc;
            videoEl.controls = true;
            videoEl.playsInline = true;
            videoEl.preload = "metadata";
            if (dims.width) {
                videoEl.style.width = dims.width;
                videoEl.style.maxWidth = "100%";
                embed.style.width = dims.width;
            }
            if (dims.height) {
                videoEl.style.height = dims.height;
                videoEl.style.maxHeight = dims.height;
            }
            embed.innerHTML = "";
            embed.appendChild(videoEl);
        }
    }

    // 2. Process <img> elements pointing to video files or YouTube/Vimeo URLs
    const imgs = Array.from(container.querySelectorAll("img"));
    for (const img of imgs) {
        const src = (img.getAttribute("src") || "").trim();
        const dims = extractMediaDimensions(img);
        if (isVideoFileUrl(src)) {
            const resSrc = resolveMediaResourcePath(plugin, src, sourcePath);
            const videoEl = document.createElement("video");
            videoEl.className = "recipe-embedded-video";
            videoEl.src = resSrc;
            videoEl.controls = true;
            videoEl.playsInline = true;
            videoEl.preload = "metadata";
            if (dims.width) {
                videoEl.style.width = dims.width;
                videoEl.style.maxWidth = "100%";
            }
            if (dims.height) {
                videoEl.style.height = dims.height;
                videoEl.style.maxHeight = dims.height;
            }
            const parentEmbed = img.closest(".image-embed, .media-embed, .internal-embed");
            if (parentEmbed) {
                parentEmbed.replaceWith(videoEl);
            } else {
                img.replaceWith(videoEl);
            }
        } else {
            const embedVideoUrl = getVideoEmbedUrl(src);
            if (embedVideoUrl) {
                const isShorts = /\/shorts\//i.test(src);
                const wrapper = document.createElement("div");
                wrapper.className = isShorts
                    ? "recipe-video-wrapper recipe-video-shorts"
                    : "recipe-video-wrapper";
                if (dims.width) {
                    wrapper.style.maxWidth = dims.width;
                }
                if (dims.width && dims.height) {
                    wrapper.style.aspectRatio = `${dims.width.replace("px", "")} / ${dims.height.replace("px", "")}`;
                }
                const iframe = document.createElement("iframe");
                iframe.className = "recipe-embedded-iframe";
                iframe.src = embedVideoUrl;
                iframe.setAttribute("frameborder", "0");
                iframe.setAttribute(
                    "allow",
                    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                );
                iframe.setAttribute("allowfullscreen", "true");
                wrapper.appendChild(iframe);
                const parentEmbed = img.closest(".image-embed, .media-embed, .internal-embed");
                if (parentEmbed) {
                    parentEmbed.replaceWith(wrapper);
                } else {
                    img.replaceWith(wrapper);
                }
            }
        }
    }

    // 3. Process standalone links in paragraphs (<p><a href="video.mp4">...</a></p> or YouTube)
    const links = Array.from(container.querySelectorAll("a"));
    for (const a of links) {
        const href = (a.getAttribute("href") || "").trim();
        const embedUrl = getVideoEmbedUrl(href);
        const isVideoFile = isVideoFileUrl(href);
        if (!embedUrl && !isVideoFile) continue;

        const parentP = a.parentElement;
        if (parentP && (parentP.nodeName === "P" || parentP.nodeName === "DIV")) {
            const text = (parentP.textContent || "").trim();
            const aText = (a.textContent || "").trim();
            const isAlone = text === aText && parentP.children.length === 1;
            if (isAlone) {
                if (embedUrl) {
                    const isShorts = /\/shorts\//i.test(href);
                    const wrapper = document.createElement("div");
                    wrapper.className = isShorts
                        ? "recipe-video-wrapper recipe-video-shorts"
                        : "recipe-video-wrapper";
                    const iframe = document.createElement("iframe");
                    iframe.className = "recipe-embedded-iframe";
                    iframe.src = embedUrl;
                    iframe.setAttribute("frameborder", "0");
                    iframe.setAttribute(
                        "allow",
                        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    );
                    iframe.setAttribute("allowfullscreen", "true");
                    wrapper.appendChild(iframe);
                    parentP.replaceWith(wrapper);
                } else if (isVideoFile) {
                    const resSrc = resolveMediaResourcePath(plugin, href, sourcePath);
                    const videoEl = document.createElement("video");
                    videoEl.className = "recipe-embedded-video";
                    videoEl.src = resSrc;
                    videoEl.controls = true;
                    videoEl.playsInline = true;
                    videoEl.preload = "metadata";
                    parentP.replaceWith(videoEl);
                }
            }
        }
    }

    // 4. Ensure native <video> elements are properly configured
    const videos = Array.from(container.querySelectorAll("video"));
    for (const v of videos) {
        v.classList.add("recipe-embedded-video");
        v.controls = true;
        v.playsInline = true;
        v.preload = "metadata";
        const dims = extractMediaDimensions(v);
        if (dims.width) {
            v.style.width = dims.width;
            v.style.maxWidth = "100%";
        }
        if (dims.height) {
            v.style.height = dims.height;
            v.style.maxHeight = dims.height;
        }
        const currentSrc = v.getAttribute("src") || "";
        if (currentSrc && !/^(?:https?|app|data|blob|capacitor):/i.test(currentSrc)) {
            v.src = resolveMediaResourcePath(plugin, currentSrc, sourcePath);
        }
    }

    // 5. Ensure native <iframe> elements are responsive
    const iframes = Array.from(container.querySelectorAll("iframe"));
    for (const iframe of iframes) {
        iframe.classList.add("recipe-embedded-iframe");
        const dims = extractMediaDimensions(iframe);
        const parent = iframe.parentElement;
        if (!parent || !parent.classList.contains("recipe-video-wrapper")) {
            const wrapper = document.createElement("div");
            wrapper.className = "recipe-video-wrapper";
            if (dims.width) {
                wrapper.style.maxWidth = dims.width;
            }
            iframe.replaceWith(wrapper);
            wrapper.appendChild(iframe);
        } else if (dims.width) {
            parent.style.maxWidth = dims.width;
        }
    }
}
