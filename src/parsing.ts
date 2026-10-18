import RecipeViewPlugin from "./main";
import RecipeLeaf from "./RecipeLeaf.svelte";
import CheckableIngredientList from "./CheckableIngredientList.svelte";
import SelectableStepList from "./SelectableStepList.svelte";
import { CachedMetadata, Component, MarkdownRenderer, TFile } from "obsidian";
import store from "./store";
import { Writable, get, writable } from "svelte/store";
import Fraction from "fraction.js";
import { matchQuantities } from "./quantities";
import ScaledQuantity from "./ScaledQuantity.svelte";
import { ComponentType } from "svelte";
import { parseForTimers } from "./timers";

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
    renderedMarkdownParent: HTMLElement;
    qtyScaleStore: Writable<Fraction>;
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
        if (
            (n as HTMLElement).hasAttribute("data-qty") ||
            (n as HTMLElement).hasAttribute("data-qty-no-parse")
        ) {
            return;
        }
    }

    if (n.nodeType == Node.TEXT_NODE) {
        const parent = n.parentNode!;
        let currentIndex = 0;
        n.textContent = n.textContent!.normalize("NFKD").replaceAll("\u2044", "/");
        for (const match of matchQuantities(n.textContent!)) {
            parent.insertBefore(
                document.createTextNode(
                    n.textContent!.slice(currentIndex, match.index)
                ),
                n
            );
            const qtyTarget = createEl("span");
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
            currentIndex = (match.index || currentIndex) + match.length;
        }
        parent.insertBefore(
            document.createTextNode(n.textContent!.slice(currentIndex)),
            n
        );
        parent.removeChild(n);
    }

    if (n.hasChildNodes()) {
        Array.from(n.childNodes).forEach((c) =>
            parseForQty(c, qtyScaleStore)
        );
    }
}

function injectQuantities(parsedRecipe: ParsedRecipe) {
    parsedRecipe.sections.flatMap((s) => s.sideComponents.concat(s.mainComponents)).map((c) => {
        switch (c.type) {
            case RecipeLeaf:
                Array.from((c.props.childNodesOf as HTMLElement).querySelectorAll("[data-qty-parse]"))
                    .forEach((n) => parseForQty(n, parsedRecipe.qtyScaleStore));
                break;

            case SelectableStepList:
                if (c.props.kind == "ol") {
                    Array.from((c.props.list as HTMLElement).querySelectorAll("[data-qty-parse]"))
                        .forEach((n) => parseForQty(n, parsedRecipe.qtyScaleStore));
                } else {
                    (c.props.list as Array<HTMLElement>).forEach((p) => {
                        Array.from(p.querySelectorAll("[data-qty-parse]"))
                            .forEach((n) => parseForQty(n, parsedRecipe.qtyScaleStore));
                    });
                }
                break;

            case CheckableIngredientList:
                parseForQty((c.props.list as HTMLElement), parsedRecipe.qtyScaleStore);
                break;

            default:
                break;
        }
    });
}

function isHeadingComponent(c: ParsedRecipeComponent): boolean {
    return (
        c.type === RecipeLeaf &&
        typeof c.props?.asTag === "string" &&
        /^H[1-6]$/i.test(c.props.asTag as string)
    );
}

function buildUnifiedRecipeStructure(
    result: ParsedRecipe,
    radioName: string
): void {
    const nonEmptySections = result.sections.filter(
        (s) => s.sideComponents.length > 0 || s.mainComponents.length > 0
    );

    const globalIngredients: Array<ParsedRecipeComponent> = [];
    const stepSections: Array<{
        stepIngredients: Array<ParsedRecipeComponent>;
        mainComponents: Array<ParsedRecipeComponent>;
    }> = [];

    // Count how many non-explicit sections have sideComponents
    const nonExplicitSideSections = nonEmptySections.filter(
        (s) => !s.isExplicitSideSection && s.sideComponents.length > 0
    );

    for (let idx = 0; idx < nonEmptySections.length; idx++) {
        const s = nonEmptySections[idx];

        if (s.isExplicitSideSection) {
            globalIngredients.push(...s.sideComponents);
            if (s.mainComponents.length > 0) {
                stepSections.push({
                    stepIngredients: [],
                    mainComponents: s.mainComponents,
                });
            }
            continue;
        }

        // Section with only ingredients and no steps -> global ingredients
        if (s.sideComponents.length > 0 && s.mainComponents.length === 0) {
            globalIngredients.push(...s.sideComponents);
            continue;
        }

        // Headerless initial ingredient list before a Directions heading or in a single-section recipe with multiple steps
        const startsWithMainHeading =
            s.mainComponents.length > 0 && isHeadingComponent(s.mainComponents[0]);
        const hasMultipleOlItems = s.mainComponents.some(
            (c) =>
                c.type === SelectableStepList &&
                c.props.kind === "ol" &&
                ((c.props.list as HTMLOListElement)?.children?.length ?? 0) > 1
        );

        if (
            idx === 0 &&
            globalIngredients.length === 0 &&
            nonExplicitSideSections.length === 1 &&
            s.sideComponents.length > 0 &&
            (startsWithMainHeading ||
                (nonEmptySections.length === 1 && hasMultipleOlItems))
        ) {
            globalIngredients.push(...s.sideComponents);
            stepSections.push({
                stepIngredients: [],
                mainComponents: s.mainComponents,
            });
            continue;
        }

        stepSections.push({
            stepIngredients: [...s.sideComponents],
            mainComponents: s.mainComponents,
        });
    }

    const steps: Array<ParsedRecipeStep> = [];
    let stepCounter = 0;
    const isSingleStepSection = stepSections.length === 1;

    for (const sec of stepSections) {
        let pendingIngs = [...sec.stepIngredients];
        let currentStepMain: Array<ParsedRecipeComponent> = [];

        const flushCurrentStep = () => {
            if (currentStepMain.length === 0) return;
            stepCounter += 1;
            steps.push({
                stepNumber: stepCounter,
                isHeadingOnly: false,
                stepIngredients: pendingIngs,
                mainComponents: currentStepMain,
            });
            pendingIngs = [];
            currentStepMain = [];
        };

        for (const comp of sec.mainComponents) {
            if (isHeadingComponent(comp) && currentStepMain.length === 0) {
                steps.push({
                    stepNumber: null,
                    isHeadingOnly: true,
                    stepIngredients: [],
                    mainComponents: [comp],
                });
                continue;
            }

            if (comp.type === SelectableStepList && comp.props.kind === "ol") {
                flushCurrentStep();
                const olEl = comp.props.list as HTMLOListElement;
                const liElements = Array.from(olEl.children) as Array<HTMLElement>;
                for (const liEl of liElements) {
                    stepCounter += 1;
                    steps.push({
                        stepNumber: stepCounter,
                        isHeadingOnly: false,
                        stepIngredients: pendingIngs,
                        mainComponents: [
                            {
                                type: SelectableStepList,
                                props: {
                                    list: [liEl],
                                    kind: "p",
                                    radioName,
                                },
                                origIndex: comp.origIndex,
                            },
                        ],
                    });
                    pendingIngs = [];
                }
                continue;
            }

            if (
                isSingleStepSection &&
                comp.type === SelectableStepList &&
                comp.props.kind === "p"
            ) {
                flushCurrentStep();
                const pElements = comp.props.list as Array<HTMLElement>;
                for (const pEl of pElements) {
                    stepCounter += 1;
                    steps.push({
                        stepNumber: stepCounter,
                        isHeadingOnly: false,
                        stepIngredients: pendingIngs,
                        mainComponents: [
                            {
                                type: SelectableStepList,
                                props: {
                                    list: [pEl],
                                    kind: "p",
                                    radioName,
                                },
                                origIndex: comp.origIndex,
                            },
                        ],
                    });
                    pendingIngs = [];
                }
                continue;
            }

            currentStepMain.push(comp);
        }

        flushCurrentStep();

        // If a section had pending ingredients and only a heading, attach them to globalIngredients
        if (pendingIngs.length > 0) {
            globalIngredients.push(...pendingIngs);
        }
    }

    result.globalIngredients = globalIngredients;
    result.steps = steps;
    result.hasStepIngredients = steps.some(
        (s) => s.stepIngredients.length > 0
    );
}

export function parseRecipeMarkdown(
    plugin: RecipeViewPlugin,
    text: string,
    path: string,
    component: Component,
    metadata?: CachedMetadata | null
) {
    // Create our object to store the result.
    // - When we want to render HTML elements created from rendering the markdown, we need
    // to reparent them rather than clone them (or e.g. callout icons, transclusions,
    // etc. get lost.) As such, every element being rendered directly from the rendered
    // markdown needs to be wrapped in a RecipeLeaf, which ensures it doesn't get
    // destroyed if the components get rebuilt e.g. because the layout changes.
    const frontmatterCover = resolveCoverImage(plugin, metadata?.frontmatter, path);

    const result: ParsedRecipe = {
        title: "",
        thumbnailPath: frontmatterCover,
        sections: [
            {
                containsHeader: false,
                isExplicitSideSection: false,
                sideComponents: [],
                mainComponents: [],
            },
        ],
        globalIngredients: [],
        steps: [],
        hasStepIngredients: false,
        renderedMarkdownParent: createDiv(),
        qtyScaleStore: writable(new Fraction(1)),
    };

    MarkdownRenderer.render(plugin.app, text, result.renderedMarkdownParent, path, component);

    // Transform inline @timer{...} syntax into clickable iOS Shortcut timer buttons
    parseForTimers(result.renderedMarkdownParent, plugin.settings);

    const radioName = `selectable-steps-${get(store.counter)}`;
    store.counter.update((n) => n + 1);

    const sideColumnRegex = RegExp(plugin.settings.sideColumnRegex, "i");

    let currentSection = 0;
    let currentColumn: "sideComponents" | "mainComponents" = "mainComponents";

    let sendToSideUntilLevel = 7;
    for (let i = 0; i < result.renderedMarkdownParent.children.length; i++) {
        const item = result.renderedMarkdownParent.children.item(i)!;

        // Horizontal rules will create a new section
        if (item.nodeName == "HR") {
            result.sections.push({
                containsHeader: false,
                isExplicitSideSection: false,
                sideComponents: [],
                mainComponents: [],
            });
            currentSection++;
            currentColumn = "mainComponents";
            sendToSideUntilLevel = 7;
            continue; // Don't include the HR to be rendered
        }

        // Headers can change which column to send items to
        if (item.nodeName.match(/H[1-6]/)) {
            const headerLevel = parseInt(item.nodeName.at(1)!);
            if (
                plugin.settings.treatH1AsFilename &&
                headerLevel == 1 &&
                result.sections[currentSection].containsHeader == false &&
                currentSection == 0
            ) {
                result.title = item?.textContent || "";
                continue;
            } else {
                result.sections[currentSection].containsHeader = true;
            }
            if (item.textContent?.match(sideColumnRegex)) {
                // If current section already has main step components, start a new section for this side block
                if (result.sections[currentSection].mainComponents.length > 0) {
                    result.sections.push({
                        containsHeader: true,
                        isExplicitSideSection: true,
                        sideComponents: [],
                        mainComponents: [],
                    });
                    currentSection++;
                } else {
                    result.sections[currentSection].isExplicitSideSection = true;
                }
                currentColumn = "sideComponents";
                sendToSideUntilLevel = headerLevel;
            } else if (
                currentColumn == "sideComponents" &&
                headerLevel <= sendToSideUntilLevel
            ) {
                // Exiting an explicit side section (e.g. moving from ## Ingredients to ## Directions)
                if (result.sections[currentSection].sideComponents.length > 0) {
                    result.sections.push({
                        containsHeader: true,
                        isExplicitSideSection: false,
                        sideComponents: [],
                        mainComponents: [],
                    });
                    currentSection++;
                }
                currentColumn = "mainComponents";
                sendToSideUntilLevel = 7;
            }
        }

        // To stop margins from not collapsing below the title block,
        // get rid of the display: none frontmatter
        if (item.matches("pre.frontmatter")) {
            continue;
        }

        // Extract the first image as a thumbnail if no cover image was defined in frontmatter
        if (
            item.getElementsByTagName("IMG").length > 0 &&
            currentSection == 0 &&
            !result.thumbnailPath &&
            !result.sections[0].containsHeader
        ) {
            result.thumbnailPath =
                item.getElementsByTagName("IMG").item(0)?.getAttribute("src") || "";
            continue; // Don't send to either column
        }

        // Unordered lists (UL) are always treated as checkable ingredient lists:
        // - In explicit sideColumn sections -> globalIngredients
        // - In step sections (or directly before a step) -> stepIngredients of that step
        if (item.nodeName == "UL") {
            if (
                currentColumn == "mainComponents" &&
                result.sections[currentSection].mainComponents.some(
                    (c) => !isHeadingComponent(c)
                )
            ) {
                // Start a new step section so this UL attaches to the following step
                result.sections.push({
                    containsHeader: false,
                    isExplicitSideSection: false,
                    sideComponents: [],
                    mainComponents: [],
                });
                currentSection++;
            }

            result.sections[currentSection].sideComponents.push({
                type: CheckableIngredientList,
                props: {
                    list: item,
                    bullets: plugin.settings.showBulletsTwoColumn,
                },
                origIndex: i,
            });
            continue;
        }

        // If we're sending an ordered list to the main column, then make it selectable
        if (item.nodeName == "OL" && currentColumn == "mainComponents") {
            result.sections[currentSection][currentColumn].push({
                type: SelectableStepList,
                props: {
                    list: item,
                    kind: "ol",
                    radioName: radioName,
                },
                origIndex: i,
            });
            continue;
        }

        // If we're sending a paragraph to the main column, then make it selectable
        if (item.nodeName == "P" && currentColumn == "mainComponents") {
            const prev =
                result.sections[currentSection][currentColumn][
                    result.sections[currentSection][currentColumn].length - 1
                ];
            if (
                prev &&
                prev.type == SelectableStepList &&
                prev.props.kind == "p"
            ) {
                (prev.props.list as Array<HTMLElement>).push(item as HTMLElement);
            } else {
                result.sections[currentSection][currentColumn].push({
                    type: SelectableStepList,
                    props: {
                        list: [item],
                        kind: "p",
                        radioName: radioName,
                    },
                    origIndex: i,
                });
            }
            continue;
        }

        // If it's a callout, that's a top-level div so we need to wrap it or we'll
        // steal its children without the actual <div class='callout'> around them
        if (item.hasClass("callout")) {
            const calloutWrapper = createDiv();
            calloutWrapper.appendChild(item);
            result.sections[currentSection][currentColumn].push({
                type: RecipeLeaf,
                props: { childNodesOf: calloutWrapper, asTag: "div" },
                origIndex: i,
            });
            // because we reparented the callout, if we don't fix the index it'll skip
            // the next block
            i -= 1;
            continue;
        }

        // Add current item to current column
        result.sections[currentSection][currentColumn].push({
            type: RecipeLeaf,
            props: { childNodesOf: item, asTag: item.nodeName },
            origIndex: i,
        });
    }

    injectQuantities(result);
    buildUnifiedRecipeStructure(result, radioName);

    return result;
}