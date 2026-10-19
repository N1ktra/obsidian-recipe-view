import { describe, expect, test } from '@jest/globals';
import {
    buildUnifiedRecipeStructure,
    normalizeMarkdownStepListSpacing,
    getDirectionsRegex,
    getIngredientsRegex,
    isDirectionsHeaderElement,
    isIngredientsHeaderElement,
    isListItemWithCheckbox,
    parseForQty,
    injectQuantities,
    ParsedRecipe,
} from './parsing';
import { DEFAULT_SETTINGS } from './settings';
import { writable } from 'svelte/store';
import Fraction from 'fraction.js';

describe('step segmentation in buildUnifiedRecipeStructure', () => {
    const mockPlugin = {
        settings: {
            ...DEFAULT_SETTINGS,
            requireCheckboxesForIngredients: false,
        },
    } as any;

    test('Variante A: step separation by headings including a step without text (e.g. Mayo)', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Zutaten</h2>
            <ul>
                <li>100 g Salz</li>
            </ul>
            <h2>Zubereitung</h2>
            <h2>Confit Garlic</h2>
            <ul>
                <li>1 Knolle Knoblauch</li>
                <li>100 ml Olivenöl</li>
            </ul>
            <p>Den Knoblauch schälen und im Öl garen.</p>
            <h2>Mayo</h2>
            <ul>
                <li>1 Eigelb</li>
                <li>1 TL Senf</li>
            </ul>
            <h2>Fries</h2>
            <ul>
                <li>4 Kartoffeln</li>
            </ul>
            <p>Kartoffeln schneiden und frittieren.</p>
        `;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-test', mockPlugin);

        // 1. Global ingredients must only contain the Zutaten header and Salz list, NOT Mayo!
        expect(result.globalIngredients.length).toBe(2);
        const globalUl = result.globalIngredients[1].props.list as HTMLElement;
        expect(globalUl.textContent).toContain('100 g Salz');
        expect(globalUl.textContent).not.toContain('Eigelb');

        // 2. Exactly 3 steps must be created
        expect(result.steps.length).toBe(3);
        expect(result.hasStepIngredients).toBe(true);

        // Step 1: Confit Garlic
        const step1 = result.steps[0];
        expect(step1.stepNumber).toBe(1);
        expect(step1.stepTitle).toBe('Confit Garlic');
        expect(step1.isHeadingOnly).toBe(false);
        expect(step1.stepIngredients.length).toBe(1);
        const s1Ing = step1.stepIngredients[0].props.list as HTMLElement;
        expect(s1Ing.textContent).toContain('1 Knolle Knoblauch');
        expect(step1.mainComponents.length).toBeGreaterThanOrEqual(1);

        // Step 2: Mayo (pure ingredients, NO instruction text)
        const step2 = result.steps[1];
        expect(step2.stepNumber).toBe(2);
        expect(step2.stepTitle).toBe('Mayo');
        expect(step2.isHeadingOnly).toBe(false); // Must remain a valid StepRow!
        expect(step2.stepIngredients.length).toBe(1);
        const s2Ing = step2.stepIngredients[0].props.list as HTMLElement;
        expect(s2Ing.textContent).toContain('1 Eigelb');
        expect(s2Ing.textContent).toContain('1 TL Senf');
        // Right side contains the heading component
        expect(step2.mainComponents.length).toBe(1);

        // Step 3: Fries
        const step3 = result.steps[2];
        expect(step3.stepNumber).toBe(3);
        expect(step3.stepTitle).toBe('Fries');
        expect(step3.isHeadingOnly).toBe(false);
        expect(step3.stepIngredients.length).toBe(1);
        const s3Ing = step3.stepIngredients[0].props.list as HTMLElement;
        expect(s3Ing.textContent).toContain('4 Kartoffeln');
    });

    test('Variante B: step separation by horizontal rules (---) with ingredients followed by paragraphs', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Ingredients</h2>
            <ul>
                <li>200 g Flour</li>
                <li>100 g Sugar</li>
            </ul>
            <hr>
            <ul>
                <li>100 g Butter</li>
            </ul>
            <p>Melt the butter and stir with sugar.</p>
            <hr>
            <ul>
                <li>100 g Chocolate</li>
            </ul>
            <p>Fold in chocolate and bake for 15 minutes.</p>
        `;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-test', mockPlugin);

        // Global ingredients: Ingredients header + Flour and Sugar list
        expect(result.globalIngredients.length).toBe(2);
        const globalUl = result.globalIngredients[1].props.list as HTMLElement;
        expect(globalUl.textContent).toContain('200 g Flour');
        expect(globalUl.textContent).not.toContain('Butter');

        // Steps separated by HR:
        expect(result.steps.length).toBe(2);
        expect(result.hasStepIngredients).toBe(true);

        // Step 1: Butter + Melt paragraph
        const step1 = result.steps[0];
        expect(step1.stepNumber).toBe(1);
        expect(step1.isHeadingOnly).toBe(false);
        expect(step1.stepIngredients.length).toBe(1);
        const s1Ing = step1.stepIngredients[0].props.list as HTMLElement;
        expect(s1Ing.textContent).toContain('100 g Butter');
        expect(step1.mainComponents.length).toBe(1);

        // Step 2: Chocolate + Fold paragraph
        const step2 = result.steps[1];
        expect(step2.stepNumber).toBe(2);
        expect(step2.isHeadingOnly).toBe(false);
        expect(step2.stepIngredients.length).toBe(1);
        const s2Ing = step2.stepIngredients[0].props.list as HTMLElement;
        expect(s2Ing.textContent).toContain('100 g Chocolate');
        expect(step2.mainComponents.length).toBe(1);
    });

    test('classic recipe with a single OL list decomposes into individual steps', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Zutaten</h2>
            <ul>
                <li>200 g Mehl</li>
            </ul>
            <h2>Zubereitung</h2>
            <ol>
                <li>Den Ofen auf 180 Grad vorheizen.</li>
                <li>Den Teig anrühren und in die Form geben.</li>
                <li>Fuer 30 Minuten backen.</li>
            </ol>
        `;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-test', mockPlugin);

        expect(result.globalIngredients.length).toBe(2);
        const globalUl = result.globalIngredients[1].props.list as HTMLElement;
        expect(globalUl.textContent).toContain('200 g Mehl');
        expect(result.steps.length).toBe(3);
        expect(result.steps[0].stepNumber).toBe(1);
        expect(result.steps[1].stepNumber).toBe(2);
        expect(result.steps[2].stepNumber).toBe(3);
        expect(result.hasStepIngredients).toBe(false);
    });

    test('Zutaten Sandwich is recognized as global ingredients via regex and does not leak into steps', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Zutaten Sandwich</h2>
            <ul>
                <li>Salat</li>
                <li>Bacon</li>
            </ul>
            <h2>Zubereitung</h2>
            <h2>Confit Garlic</h2>
            <ul>
                <li>Knoblauch</li>
            </ul>
            <p>Cover garlic...</p>
        `;

        const customPlugin = {
            settings: {
                ...mockPlugin.settings,
                ingredientsHeaderRegex: 'ingredients|zutaten',
                treatH1AsFilename: false,
                showBulletsTwoColumn: false,
            },
        } as any;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-test', customPlugin);

        // 1. result.globalIngredients contains "Salat" and "Bacon"
        expect(result.globalIngredients.length).toBe(2);
        const headerComp = result.globalIngredients[0].props.childNodesOf as HTMLElement;
        expect(headerComp.textContent).toBe('Zutaten Sandwich');
        const listComp = result.globalIngredients[1].props.list as HTMLElement;
        expect(listComp.textContent).toContain('Salat');
        expect(listComp.textContent).toContain('Bacon');
        expect(listComp.textContent).not.toContain('Knoblauch');

        // 2. result.steps contains EXCLUSIVELY the direction steps starting from Confit Garlic
        expect(result.steps.length).toBe(1);
        const step1 = result.steps[0];
        expect(step1.stepTitle).toBe('Confit Garlic');
        expect(step1.stepNumber).toBe(1);
        expect(step1.isHeadingOnly).toBe(false);
        expect(step1.stepIngredients.length).toBe(1);
        const stepIng = step1.stepIngredients[0].props.list as HTMLElement;
        expect(stepIng.textContent).toContain('Knoblauch');
        expect(stepIng.textContent).not.toContain('Salat');
        expect(stepIng.textContent).not.toContain('Bacon');
        expect(step1.mainComponents.length).toBeGreaterThanOrEqual(1);
    });

    test('supports paragraph headers and multiple ingredient subgroups before Zubereitung', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <p>Zutaten Sandwich</p>
            <ul>
                <li>Salat</li>
                <li>Bacon</li>
            </ul>
            <h3>Sauce</h3>
            <ul>
                <li>Mayo</li>
            </ul>
            <p>Zubereitung</p>
            <h2>Confit Garlic</h2>
            <ul>
                <li>Knoblauch</li>
            </ul>
            <p>Cover garlic...</p>
        `;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-test', mockPlugin);

        // Global ingredients: Sandwich header, Sandwich list, Sauce header, Sauce list
        expect(result.globalIngredients.length).toBe(4);
        const sandwichList = result.globalIngredients[1].props.list as HTMLElement;
        expect(sandwichList.textContent).toContain('Salat');
        expect(sandwichList.textContent).toContain('Bacon');
        const sauceList = result.globalIngredients[3].props.list as HTMLElement;
        expect(sauceList.textContent).toContain('Mayo');

        // Steps contains ONLY Confit Garlic
        expect(result.steps.length).toBe(1);
        expect(result.steps[0].stepTitle).toBe('Confit Garlic');
        expect(result.steps[0].stepIngredients.length).toBe(1);
        const garlicIng = result.steps[0].stepIngredients[0].props.list as HTMLElement;
        expect(garlicIng.textContent).toContain('Knoblauch');
    });

    test('fallback without header: leading UL without headings automatically belongs to globalIngredients', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <ul>
                <li>200 g Mehl</li>
                <li>100 g Zucker</li>
            </ul>
            <h2>Zubereitung</h2>
            <ol>
                <li>Alles vermengen und backen.</li>
            </ol>
        `;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-test', mockPlugin);

        // Leading UL is in globalIngredients
        expect(result.globalIngredients.length).toBe(1);
        const listComp = result.globalIngredients[0].props.list as HTMLElement;
        expect(listComp.textContent).toContain('200 g Mehl');
        expect(listComp.textContent).toContain('100 g Zucker');

        // Steps contain the ol step
        expect(result.steps.length).toBe(1);
        expect(result.steps[0].stepNumber).toBe(1);
    });

    test('Test 1 (Regex-Validierung): "Zutaten" landet in globalIngredients, "test" landet NICHT in globalIngredients', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Zutaten</h2>
            <ul>
                <li>200 g Mehl</li>
            </ul>
            <h2>test</h2>
            <ul>
                <li>Unbekanntes Element</li>
            </ul>
            <h2>Zubereitung</h2>
            <h2>Schritt 1</h2>
            <p>Den Teig kneten.</p>
        `;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-test', mockPlugin);

        // 1. "Zutaten" landet in globalIngredients
        expect(result.globalIngredients.length).toBe(2);
        const header = result.globalIngredients[0].props.childNodesOf as HTMLElement;
        expect(header.textContent).toBe('Zutaten');
        const list = result.globalIngredients[1].props.list as HTMLElement;
        expect(list.textContent).toContain('200 g Mehl');

        // 2. "test" (unbekannter Header) landet NICHT in globalIngredients
        expect(list.textContent).not.toContain('Unbekanntes Element');
        for (const comp of result.globalIngredients) {
            const el = (comp.props.childNodesOf || comp.props.list) as HTMLElement;
            expect(el.textContent).not.toContain('test');
            expect(el.textContent).not.toContain('Unbekanntes Element');
        }

        // "test" and "Schritt 1" are steps
        expect(result.steps.some((s) => s.stepTitle === 'test')).toBe(true);
        expect(result.steps.some((s) => s.stepTitle === 'Schritt 1')).toBe(true);
    });

    test('Test 2 (Kein Leerzeilen-Zwang): Text direkt nach Zutaten-Spiegelstrichen landet in Anweisungen', () => {
        // A) Verify markdown pre-processing normalizes missing blank line
        const rawMarkdown = [
            '## Confit Garlic',
            '- Knoblauch',
            '- Olivenöl',
            'Cover garlic cloves in oil.',
            'Cook in oven at 180°C.',
        ].join('\n');
        const normalized = normalizeMarkdownStepListSpacing(rawMarkdown);
        expect(normalized).toBe([
            '## Confit Garlic',
            '- Knoblauch',
            '- Olivenöl',
            '',
            'Cover garlic cloves in oil.',
            'Cook in oven at 180°C.',
        ].join('\n'));

        // B) Verify DOM where text lines directly follow UL as paragraphs
        const containerA = document.createElement('div');
        containerA.innerHTML = `
            <h2>Zubereitung</h2>
            <h2>Confit Garlic</h2>
            <ul>
                <li>Knoblauch</li>
                <li>Olivenöl</li>
            </ul>
            <p>Cover garlic cloves in oil.</p>
            <p>Cook in oven at 180°C.</p>
        `;

        const resultA: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: containerA,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(resultA, 'radio-test', mockPlugin);

        expect(resultA.steps.length).toBe(1);
        const stepA = resultA.steps[0];
        expect(stepA.stepTitle).toBe('Confit Garlic');
        expect(stepA.stepIngredients.length).toBe(1);
        const ingListA = stepA.stepIngredients[0].props.list as HTMLElement;
        expect(ingListA.textContent).toContain('Knoblauch');
        expect(ingListA.textContent).toContain('Olivenöl');

        // Instructions in mainComponents must contain both lines
        const stepTextA = stepA.mainComponents
            .map((c) => {
                const el = (c.props.childNodesOf || c.props.list) as HTMLElement | Array<HTMLElement>;
                if (Array.isArray(el)) {
                    return el.map((e) => e.textContent).join(' ');
                }
                return el ? el.textContent : '';
            })
            .join(' ');
        expect(stepTextA).toContain('Cover garlic cloves in oil.');
        expect(stepTextA).toContain('Cook in oven at 180°C.');

        // C) Verify DOM where lazy continuation placed text inside the last LI
        const containerB = document.createElement('div');
        containerB.innerHTML = `
            <h2>Zubereitung</h2>
            <h2>Confit Garlic</h2>
            <ul>
                <li>Knoblauch</li>
                <li>Olivenöl
Cover garlic cloves in oil.
Cook in oven at 180°C.</li>
            </ul>
        `;

        const resultB: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: containerB,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(resultB, 'radio-test', mockPlugin);

        expect(resultB.steps.length).toBe(1);
        const stepB = resultB.steps[0];
        expect(stepB.stepTitle).toBe('Confit Garlic');
        expect(stepB.stepIngredients.length).toBe(1);
        const ingListB = stepB.stepIngredients[0].props.list as HTMLElement;
        expect(ingListB.textContent).toContain('Knoblauch');
        expect(ingListB.textContent).toContain('Olivenöl');
        expect(ingListB.textContent).not.toContain('Cover garlic cloves in oil.');

        const stepTextB = stepB.mainComponents
            .map((c) => {
                const el = (c.props.childNodesOf || c.props.list) as HTMLElement | Array<HTMLElement>;
                if (Array.isArray(el)) {
                    return el.map((e) => e.textContent).join(' ');
                }
                return el ? el.textContent : '';
            })
            .join(' ');
        expect(stepTextB).toContain('Cover garlic cloves in oil.');
        expect(stepTextB).toContain('Cook in oven at 180°C.');
    });
});

describe('configurable header regex settings', () => {
    test('getDirectionsRegex and getIngredientsRegex use plugin settings and handle invalid regex gracefully', () => {
        expect(getDirectionsRegex().test('Zubereitung')).toBe(true);
        expect(getDirectionsRegex().test('Directions')).toBe(true);
        expect(getIngredientsRegex().test('Zutaten')).toBe(true);
        expect(getIngredientsRegex().test('Ingredients')).toBe(true);

        const customPlugin = {
            settings: {
                directionsHeaderRegex: 'zubereiten|vorgehen',
                ingredientsHeaderRegex: 'komponenten|material',
            },
        } as any;

        const dirRegex = getDirectionsRegex(customPlugin);
        expect(dirRegex.test('Zubereiten')).toBe(true);
        expect(dirRegex.test('Vorgehen')).toBe(true);
        expect(dirRegex.test('Directions')).toBe(false);

        const ingRegex = getIngredientsRegex(customPlugin);
        expect(ingRegex.test('Komponenten')).toBe(true);
        expect(ingRegex.test('Material')).toBe(true);
        expect(ingRegex.test('Zutaten')).toBe(false);

        // Invalid regex fallback
        const invalidPlugin = {
            settings: {
                directionsHeaderRegex: '[invalid(regex',
                ingredientsHeaderRegex: '[invalid(regex',
            },
        } as any;
        expect(() => getDirectionsRegex(invalidPlugin)).not.toThrow();
        expect(getDirectionsRegex(invalidPlugin).test('Zubereitung')).toBe(true);
        expect(() => getIngredientsRegex(invalidPlugin)).not.toThrow();
        expect(getIngredientsRegex(invalidPlugin).test('Zutaten')).toBe(true);
    });

    test('buildUnifiedRecipeStructure respects custom directions and ingredients header regexes', () => {
        const customPlugin = {
            settings: {
                ...DEFAULT_SETTINGS,
                directionsHeaderRegex: 'methodology|cook-steps',
                ingredientsHeaderRegex: 'items-needed|pantry',
            },
        } as any;

        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Items-Needed</h2>
            <ul>
                <li><input type="checkbox"> 200 g Pasta</li>
            </ul>
            <h2>Methodology</h2>
            <h2>Cook Sauce</h2>
            <ul>
                <li><input type="checkbox"> 100 ml Cream</li>
            </ul>
            <p>Heat cream in pan.</p>
        `;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-custom', customPlugin);

        // Global ingredients should match Items-Needed
        expect(result.globalIngredients.length).toBe(2);
        const globalUl = result.globalIngredients[1].props.list as HTMLElement;
        expect(globalUl.textContent).toContain('200 g Pasta');

        // Steps should begin under Methodology
        expect(result.steps.length).toBe(1);
        const step = result.steps[0];
        expect(step.stepTitle).toBe('Cook Sauce');
        expect(step.stepIngredients.length).toBe(1);
        const stepUl = step.stepIngredients[0].props.list as HTMLElement;
        expect(stepUl.textContent).toContain('100 ml Cream');
    });
});

describe('requireCheckboxesForIngredients option', () => {
    test('isListItemWithCheckbox identifies checkbox items correctly', () => {
        // Native checkbox input
        const li1 = document.createElement('li');
        li1.innerHTML = '<input type="checkbox"> 200 g Mehl';
        expect(isListItemWithCheckbox(li1)).toBe(true);

        // Task-list-item class
        const li2 = document.createElement('li');
        li2.className = 'task-list-item';
        li2.textContent = '200 g Mehl';
        expect(isListItemWithCheckbox(li2)).toBe(true);

        // Markdown bracket syntax: [ ]
        const li3 = document.createElement('li');
        li3.textContent = '- [ ] 200 g Mehl';
        expect(isListItemWithCheckbox(li3)).toBe(true);

        // Markdown bracket syntax: [x]
        const li4 = document.createElement('li');
        li4.textContent = '[x] 200 g Mehl';
        expect(isListItemWithCheckbox(li4)).toBe(true);

        // Regular bullet point instruction without checkbox
        const li5 = document.createElement('li');
        li5.textContent = '- Kartoffeln wenden und Deckel schließen';
        expect(isListItemWithCheckbox(li5)).toBe(false);

        // Regular text
        const li6 = document.createElement('li');
        li6.textContent = 'Kartoffeln wenden und Deckel schließen';
        expect(isListItemWithCheckbox(li6)).toBe(false);

        // Text starting with brackets that are NOT checkboxes (e.g. [Wichtig])
        const li7 = document.createElement('li');
        li7.textContent = '[Wichtig] Vorher den Ofen vorheizen';
        expect(isListItemWithCheckbox(li7)).toBe(false);
    });

    test('Test A: requireCheckboxesForIngredients: true assigns checkbox items to stepIngredients and bullet points to instructions', () => {
        const pluginA = {
            settings: {
                ...DEFAULT_SETTINGS,
                requireCheckboxesForIngredients: true,
            },
        } as any;

        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Zubereitung</h2>
            <h2>Schritt 1</h2>
            <ul>
                <li><input type="checkbox"> 200 g Mehl</li>
                <li>Kartoffeln wenden und Deckel schließen</li>
            </ul>
            <h2>Schritt 2</h2>
            <ul>
                <li>Kartoffeln noch 5 Minuten ruhen lassen</li>
            </ul>
        `;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-check-a', pluginA);

        expect(result.steps.length).toBe(2);

        // Step 1: has checkbox ingredient "200 g Mehl", while bullet instruction "Kartoffeln wenden..." remains in mainComponents
        const step1 = result.steps[0];
        expect(step1.stepTitle).toBe('Schritt 1');
        expect(step1.stepIngredients.length).toBe(1);
        const s1IngUl = step1.stepIngredients[0].props.list as HTMLElement;
        expect(s1IngUl.textContent).toContain('200 g Mehl');
        expect(s1IngUl.textContent).not.toContain('Kartoffeln wenden');

        // Instructions in mainComponents must contain the non-checkbox bullet point
        const s1InstructionText = step1.mainComponents
            .map((c) => {
                const el = (c.props.childNodesOf || c.props.list) as HTMLElement | Array<HTMLElement>;
                if (Array.isArray(el)) {
                    return el.map((e) => e.textContent).join(' ');
                }
                return el ? el.textContent : '';
            })
            .join(' ');
        expect(s1InstructionText).toContain('Kartoffeln wenden und Deckel schließen');
        expect(s1InstructionText).not.toContain('200 g Mehl');

        // Step 2: only regular bullet points, NO checkboxes at all
        const step2 = result.steps[1];
        expect(step2.stepTitle).toBe('Schritt 2');
        expect(step2.stepIngredients.length).toBe(0); // Zero ingredients!
        const s2InstructionText = step2.mainComponents
            .map((c) => {
                const el = (c.props.childNodesOf || c.props.list) as HTMLElement | Array<HTMLElement>;
                if (Array.isArray(el)) {
                    return el.map((e) => e.textContent).join(' ');
                }
                return el ? el.textContent : '';
            })
            .join(' ');
        expect(s2InstructionText).toContain('Kartoffeln noch 5 Minuten ruhen lassen');
    });

    test('Test B: requireCheckboxesForIngredients: false parses regular bullet points as step ingredients', () => {
        const pluginB = {
            settings: {
                ...DEFAULT_SETTINGS,
                requireCheckboxesForIngredients: false,
            },
        } as any;

        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Zubereitung</h2>
            <h2>Schritt 1</h2>
            <ul>
                <li>200 g Mehl</li>
            </ul>
            <p>Den Teig kräftig kneten.</p>
        `;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-check-b', pluginB);

        expect(result.steps.length).toBe(1);
        const step = result.steps[0];
        // In mode false, normal bullet points become step ingredients
        expect(step.stepIngredients.length).toBe(1);
        const ingUl = step.stepIngredients[0].props.list as HTMLElement;
        expect(ingUl.textContent).toContain('200 g Mehl');

        // Instruction text remains in mainComponents
        const instructionText = step.mainComponents
            .map((c) => {
                const el = (c.props.childNodesOf || c.props.list) as HTMLElement | Array<HTMLElement>;
                if (Array.isArray(el)) {
                    return el.map((e) => e.textContent).join(' ');
                }
                return el ? el.textContent : '';
            })
            .join(' ');
        expect(instructionText).toContain('Den Teig kräftig kneten.');
    });

    test('Test C: globalIngredients with requireCheckboxesForIngredients: true only includes checkbox items as CheckableIngredientList', () => {
        const pluginC = {
            settings: {
                ...DEFAULT_SETTINGS,
                requireCheckboxesForIngredients: true,
            },
        } as any;

        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Zutaten</h2>
            <ul>
                <li><input type="checkbox"> 100 g Salz</li>
                <li>Hinweis: Vor Feuchtigkeit schützen</li>
            </ul>
            <h2>Zubereitung</h2>
            <h2>Schritt 1</h2>
            <p>Alles vermengen.</p>
        `;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-check-c', pluginC);

        // CheckableIngredientList only has 100 g Salz
        const checkableComp = result.globalIngredients.find((c) => (c.props.list as HTMLElement)?.textContent?.includes('100 g Salz'));
        expect(checkableComp).toBeDefined();
        const checkableUl = checkableComp!.props.list as HTMLElement;
        expect(checkableUl.textContent).toContain('100 g Salz');
        expect(checkableUl.textContent).not.toContain('Hinweis: Vor Feuchtigkeit schützen');
    });

    test('Problem A: Checklist item followed immediately by bullet points splits into stepIngredients and instructions', () => {
        const plugin = {
            settings: {
                ...DEFAULT_SETTINGS,
                requireCheckboxesForIngredients: true,
            },
        } as any;

        const container = document.createElement('div');
        // HTML rendered from:
        // ## Zubereitung
        // ## Schritt 1
        // - [ ] 200 g Mehl
        // - Rühren bis glatt
        // - In die Pfanne geben
        container.innerHTML = `
            <h2>Zubereitung</h2>
            <h2>Schritt 1</h2>
            <ul>
                <li><input type="checkbox"> 200 g Mehl</li>
                <li>Rühren bis glatt</li>
                <li>In die Pfanne geben</li>
            </ul>
        `;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-prob-a', plugin);

        expect(result.steps.length).toBe(1);
        const step = result.steps[0];
        // stepIngredients should only have "200 g Mehl"
        expect(step.stepIngredients.length).toBe(1);
        const ingUl = step.stepIngredients[0].props.list as HTMLElement;
        expect(ingUl.textContent).toContain('200 g Mehl');
        expect(ingUl.textContent).not.toContain('Rühren bis glatt');

        // mainComponents contains the headerElement RecipeLeaf plus the bullet instructions RecipeLeaf
        expect(step.mainComponents.length).toBe(2);
        const instUl = step.mainComponents[1].props.childNodesOf as HTMLElement;
        expect(instUl.textContent).toContain('Rühren bis glatt');
        expect(instUl.textContent).toContain('In die Pfanne geben');
        expect(instUl.textContent).not.toContain('200 g Mehl');
    });

    test('Problem B: Loose list items with blank lines retain their paragraph text and stay in single step', () => {
        const plugin = {
            settings: {
                ...DEFAULT_SETTINGS,
                requireCheckboxesForIngredients: false,
            },
        } as any;

        const container = document.createElement('div');
        // HTML from loose list:
        // - Schritt A
        //
        // - Schritt B
        container.innerHTML = `
            <h2>Zubereitung</h2>
            <h2>Schritt 1</h2>
            <ul>
                <li><p>Schritt A</p></li>
                <li><p>Schritt B</p></li>
            </ul>
        `;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-prob-b', plugin);

        expect(result.steps.length).toBe(1);
        const step = result.steps[0];
        expect(step.stepIngredients.length).toBe(1);
        const ingUl = step.stepIngredients[0].props.list as HTMLElement;
        expect(ingUl.textContent).toContain('Schritt A');
        expect(ingUl.textContent).toContain('Schritt B');
    });

    test('Mayo step without text produces valid step with stepIngredients and only header in mainComponents', () => {
        const plugin = {
            settings: {
                ...DEFAULT_SETTINGS,
                requireCheckboxesForIngredients: true,
            },
        } as any;

        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Zubereitung</h2>
            <h2>Mayo</h2>
            <ul>
                <li><input type="checkbox"> 1 Eigelb</li>
                <li><input type="checkbox"> 100 ml Öl</li>
            </ul>
            <h2>Fries</h2>
            <p>Kartoffeln schneiden und frittieren.</p>
        `;

        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore: writable(new Fraction(1)),
        };

        buildUnifiedRecipeStructure(result, 'radio-mayo', plugin);

        expect(result.steps.length).toBe(2);
        const mayoStep = result.steps[0];
        expect(mayoStep.stepTitle).toBe('Mayo');
        expect(mayoStep.stepIngredients.length).toBe(1);
        // Only the header is in mainComponents, no instruction text
        expect(mayoStep.mainComponents.length).toBe(1);
        expect(mayoStep.mainComponents[0].props.asTag).toBe('H2');

        const friesStep = result.steps[1];
        expect(friesStep.stepTitle).toBe('Fries');
        // Header + paragraph instruction = 2 components
        expect(friesStep.mainComponents.length).toBe(2);
    });

    test('Quantity scaling applies to regular bullet point ingredients in globalIngredients and stepIngredients', () => {
        const plugin = {
            settings: {
                ...DEFAULT_SETTINGS,
                requireCheckboxesForIngredients: false,
            },
        } as any;

        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Zutaten</h2>
            <ul>
                <li>200 g Mehl</li>
                <li>2 Eier</li>
                <li>2 EL Olivenöl</li>
            </ul>
            <h2>Zubereitung</h2>
            <h2>Schritt 1</h2>
            <ul>
                <li>100 ml Milch</li>
                <li>1 TL Zucker</li>
            </ul>
            <p>Alles verrühren.</p>
        `;

        const qtyScaleStore = writable(new Fraction(1));
        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore,
        };

        buildUnifiedRecipeStructure(result, 'radio-scale-test', plugin);
        injectQuantities(result);

        // Global ingredients: check that data-qty spans are inserted
        const globalUl = result.globalIngredients[1].props.list as HTMLElement;
        const globalQtySpans = Array.from(globalUl.querySelectorAll('span[data-qty="true"]'));
        expect(globalQtySpans.length).toBe(3);

        // Step ingredients: check that data-qty spans are inserted
        const step1 = result.steps[0];
        const step1Ul = step1.stepIngredients[0].props.list as HTMLElement;
        const step1QtySpans = Array.from(step1Ul.querySelectorAll('span[data-qty="true"]'));
        expect(step1QtySpans.length).toBe(2);

        // Now test reactive scaling by multiplying scale by 2
        qtyScaleStore.set(new Fraction(2));

        // Global quantities: 200g -> 400g, 2 -> 4, 2 EL -> 4 EL
        const scaleNumbers = globalQtySpans.map((s) => s.querySelector('.scale-number')?.textContent?.trim());
        expect(scaleNumbers).toContain('400');
        expect(scaleNumbers).toContain('4');

        // Step quantities: 100 ml -> 200 ml, 1 TL -> 2 TL
        const stepScaleNumbers = step1QtySpans.map((s) => s.querySelector('.scale-number')?.textContent?.trim());
        expect(stepScaleNumbers).toContain('200');
        expect(stepScaleNumbers).toContain('2');
    });

    test('Quantity scaling applies to non-checkbox items in globalIngredients even when requireCheckboxesForIngredients is true', () => {
        const plugin = {
            settings: {
                ...DEFAULT_SETTINGS,
                requireCheckboxesForIngredients: true,
            },
        } as any;

        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Zutaten</h2>
            <ul>
                <li>200 g Mehl</li>
                <li>2 Eier</li>
            </ul>
            <h2>Zubereitung</h2>
            <h2>Schritt 1</h2>
            <p>Verrühren.</p>
        `;

        const qtyScaleStore = writable(new Fraction(1));
        const result: ParsedRecipe = {
            title: '',
            thumbnailPath: '',
            sections: [],
            globalIngredients: [],
            steps: [],
            hasStepIngredients: false,
            totalTimerMinutes: 0,
            highlightIngredients: [],
            renderedMarkdownParent: container,
            qtyScaleStore,
        };

        buildUnifiedRecipeStructure(result, 'radio-scale-require-checkboxes', plugin);
        injectQuantities(result);

        // Non-checkbox items under Zutaten are stored in RecipeLeaf (as normalUl)
        expect(result.globalIngredients.length).toBe(2);
        const leafComp = result.globalIngredients[1];
        const normalUl = leafComp.props.childNodesOf as HTMLElement;
        const qtySpans = Array.from(normalUl.querySelectorAll('span[data-qty="true"]'));
        expect(qtySpans.length).toBe(2);

        // Multiply scale by 3
        qtyScaleStore.set(new Fraction(3));
        const scaleNumbers = qtySpans.map((s) => s.querySelector('.scale-number')?.textContent?.trim());
        expect(scaleNumbers).toContain('600');
        expect(scaleNumbers).toContain('6');
    });
});



