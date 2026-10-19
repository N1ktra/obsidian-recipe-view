import { Writable } from "svelte/store";
import Fraction from "fraction.js";
import { matchQuantities } from "./quantities";
import ScaledQuantity from "./components/ScaledQuantity.svelte";
import RecipeLeaf from "./components/RecipeLeaf.svelte";
import SelectableStepList from "./components/SelectableStepList.svelte";
import { highlightIngredientsInDom } from "./timers";
import { ParsedRecipe, ParsedRecipeComponent } from "./types";

export function parseForQty(n: Node, qtyScaleStore: Writable<Fraction>) {
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

export function parseComponentQuantities(
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

export function injectQuantities(parsedRecipe: ParsedRecipe) {
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

export function injectHighlightedIngredients(parsedRecipe: ParsedRecipe) {
    parsedRecipe.steps.forEach((step) => {
        step.mainComponents.forEach((c) =>
            highlightInComponent(c, parsedRecipe.highlightIngredients || [])
        );
    });
}
