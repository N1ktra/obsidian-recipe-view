# Obsidian Recipe View Plus — Architektur & Modulübersicht

Dieses Dokument dient Coding-Agenten und Entwicklern als schneller Einstieg in die Projektarchitektur und die Verantwortlichkeiten der einzelnen Dateien.

---

## Verzeichnisstruktur

```
src/
├── components/                  # Svelte UI-Komponenten
│   ├── RecipeCard.svelte        # Haupt-Container: Verwaltet Frontmatter-Sync, Breakpoints & Events
│   ├── RecipeCardTitleBlock.svelte # Header: Thumbnail, Rezept-Titel, Nährwerte/Eigenschaften, Zeitleiste
│   ├── RecipeCardSplitSteps.svelte # 2-Spalten-Layout: Zutaten-Sidebar + Zubereitungsschritte (inkl. Description Callout)
│   ├── ScaleSelector.svelte     # Portions-Stepper (+ / - / Direkteingabe)
│   ├── ScaledQuantity.svelte    # Reaktiv skalierte Mengendarstellung im Fließtext
│   ├── CheckableIngredientList.svelte # Interaktive Zutatenliste mit Checkboxen (persistiert in LI)
│   ├── SelectableStepList.svelte # Fokussierbare/klickbare Schritte (OL/P) mit Tastaturnavigation
│   ├── RecipeLeaf.svelte        # Dynamischer DOM-Wrapper (hängt gerenderte Markdown-Nodes ein)
│   └── index.ts                 # Barrel-Export aller UI-Komponenten
│
├── types.ts                     # Schnittstellen: ParsedRecipe, ParsedRecipeStep, ParsedRecipeSection, ParsedRecipeComponent
├── media.ts                     # Medien-Auflösung: Wikilinks, Markdown-Images, Frontmatter-Cover, Vault-URLs
├── domUtils.ts                  # DOM- & Markdown-Helfer: Checkbox-Sanitizing, Header-Erkennung (H1-H6/P), CommonMark List Spacing
├── ingredientProcessor.ts       # Mengenerkennung & Injektion von ScaledQuantity & Step-Ingredient-Highlighting
├── recipeStructure.ts           # buildUnifiedRecipeStructure: Sliced Abschnitte in globale Zutaten & nummerierte Schritte
├── parsing.ts                   # Facade & Koordinator: parseRecipeMarkdown() und Re-Exports
├── quantities.ts                # Mengeneinheiten, Brüche, Multiplikation (Fraction.js) & Regex
├── timers.ts                    # Timer-Parsing (@timer{...}), Formatierung und Tag-Highlighting (@Zutat)
├── detection.ts                 # Heuristische Erkennung, ob eine aktive Notiz ein Rezept darstellt
├── settings.ts                  # Plugin-Einstellungen & Standardkonfigurationen
├── settingsTab.ts               # Einstellungs-Reiter im Obsidian-Einstellungsdialog
├── store.ts                     # Globale Svelte-Stores (Plugin-Instanz, Counter)
└── main.ts                      # Plugin-Einstiegspunkt (Obsidian Plugin Lifecycle, Views, Commands)
```

---

## Kern-Workflows

### 1. Markdown-Parsing & DOM-Aufbereitung (`parseRecipeMarkdown`)
1. **Normalisierung (`domUtils.ts`)**: `normalizeMarkdownStepListSpacing` verhindert, dass CommonMark nachfolgenden Text in vorherige `<li>` schluckt.
2. **Markdown-Rendering (`obsidian.MarkdownRenderer`)**: Rendert Markdown in ein temporäres Element.
3. **Timer-Extraktion (`timers.ts`)**: Findet `@timer{...}`, generiert interaktive Buttons und summiert Zeiten.
4. **Zutaten-Erkennung & Bereinigung (`domUtils.ts`)**: `sanitizeIngredientListElement` extrahiert `@Zutat`-Tags und wandelt Task-Checkboxen in `data-checked` um.
5. **Struktur-Segmentierung (`recipeStructure.ts`)**:
   - Preamble-Absätze (`<p>`) vor der ersten Sektion landen in `result.description`.
   - Globale Zutaten (`result.globalIngredients`) vs. Schritt-Zutaten (`step.stepIngredients`) vs. Zubereitungstext (`step.mainComponents`).
6. **Mengen- & Highlighting-Injektion (`ingredientProcessor.ts`)**:
   - `injectQuantities`: Findet Zahlen/Brüche/Einheiten und ersetzt sie durch `<ScaledQuantity>`.
   - `injectHighlightedIngredients`: Markiert Zutaten-Tags im Schritt-Fließtext.

### 2. UI-Rendering & Schrittnavigation
- **`RecipeCard.svelte`**:
  - Ermittelt responsives Layout (Smartphone: 1-spaltig; Tablet/Desktop: dynamisch über Containerbreite / Settings).
  - Synchronisiert Servings und `total_time` ins Frontmatter.
- **`RecipeCardSplitSteps.svelte`**:
  - Oben: `RecipeCardTitleBlock` (rechts) + `ScaleSelector` & globale Zutaten (links).
  - Description-Callout: Positioniert an oberster Stelle der Schrittfolge.
  - Zeilen: `.recipe-step-row` mit linker Schritt-Zutatenkarte und rechtem Anweisungstext.
  - Tastatur: Pfeiltasten (Up/Down) navigieren sauber über alle Zeilen (`effectiveSteps`).
