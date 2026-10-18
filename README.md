<div align="center">

<img src="docs/_static/Whisk.png" style="width:200px" alt="Whisk Logo">

# 🧑‍🍳 Obsidian Recipe View Plus 🥘

<a href="https://github.com/N1ktra/obsidian-recipe-view/blob/master/LICENSE">![License](https://img.shields.io/badge/license-MIT-blue)</a>
![Obsidian Compatibility](https://img.shields.io/badge/Obsidian-v1.0%2B-purple)

*Bring Obsidian with you into the kitchen — enhanced fork of Obsidian Recipe View*

</div>

![Two example windows of the plugin showing open recipes](docs/_static/preview.png)

---

Store, write, and manage your recipes as regular Obsidian notes in **portable, future-proof markdown**, then view them as a gorgeous, responsive, and **interactive recipe card** when it's time to cook in the kitchen.

**Recipe View Plus** upgrades the original plugin with automatic Reading View rendering, interactive metadata editing, smart timer synchronization, inline ingredient highlighting, iOS Shortcut triggers, and a refined unified split-step layout.

---

## 🌟 Key Features & Highlights

- 📖 **Automatic Reading View Integration:** Seamlessly renders matching recipe notes as interactive recipe cards in Obsidian's native Reading View, while Source Mode and Live Preview remain clean, unmodified Markdown.
- 📐 **Unified Two-Column & Split-Step Layout:**
  - **Left column:** Scaling controls, global ingredient cards, and step-specific ingredient boxes.
  - **Right column:** Title block, metadata bar, and interactive preparation steps.
  - Aligned flush edges with a cohesive selection frame (`.is-selected`) when selecting or navigating steps.
- 🏷️ **Two-Tier Metadata Header:**
  - **Row 1 (Properties):** Displays `type`, `servings` (defaults to `1`), plus custom frontmatter attributes (`tags`, `source`, `url`, `difficulty`, etc.).
  - **Row 2 (Three-Field Time Bar):** Clean badge/pill bar showing timer-summed cooking time, extra time, and total duration.
- ⚡ **Direct Reading-View Editing:** Click on `servings` or `extra_time` directly in Reading View to update YAML frontmatter without switching to Source Mode.
- 🔢 **Dataview & Obsidian Bases Compatibility:** Automatically synchronizes `total_time` as a pure numeric integer (minutes, e.g. `75`) to your frontmatter for reliable sorting, filtering, and querying.
- 🧈 **One-Touch Ingredient Highlighting:** Mark ingredients once in the ingredient list (`250 g @Butter`, `150 g @{brown sugar}`); the plugin cleans the list display and automatically highlights all occurrences in step instructions.
- ⏱️ **Inline iOS Shortcut Timers (`@timer{...}`):** Clickable timer buttons (`⏱ 30 min (Rest dough)`) that launch the native iOS Shortcuts app with pre-filled duration and label parameters.
- ☑️ **Smart Task-List Sanitization:** Automatic removal of raw `- [ ]` / `- [x]` prefixes to prevent duplicate checkboxes while preserving checked states.
- 📱 **Mobile & Tablet Optimized:** Full touch support with protection against accidental double-tap edit switches (`touch-action: pan-x pan-y`).

---

## 🏷️ Metadata Header & Time Bar

The header under the recipe title is organized into two distinct rows:

```text
[ type: recipe ]   [ servings: 4 ✎ ]   [ difficulty: Easy ]   [ #baking #dessert ]
──────────────────────────────────────────────────────────────────────────────────
( ⏱ Cook: 35 min )   ( ⏱ Extra: 15 min ✎ )   ( ⏱ Total: 50 min )
```

### Row 1: Core & Custom Properties (`.recipe-properties-row`)
- **`type`:** Displays the note type (or `—` placeholder).
- **`servings`:** Reads the base servings count from frontmatter. If omitted, defaults to `1` (matching the ingredient scaling stepper). Clickable to edit inline!
- **Dynamic Frontmatter:** Automatically presents any additional frontmatter keys (e.g. `source`, `difficulty`, `author`, `url`), with clickable links and tag pills.

### Row 2: Three-Field Time Bar (`.recipe-time-bar`)
A streamlined, minimalist badge bar designed for kitchen convenience:
1. **Cook (Timer-Time):** Read-only sum of all `@timer{...}` tags occurring in the recipe instructions. Displays `—` if no timers are defined.
2. **Extra (`extra_time` / `prep_time`):** Dedicated manual time for preparation, proofing, or chilling. Clickable badge allows direct editing in Reading View!
3. **Total (`total_time`):** Read-only, automatically computed sum of timer duration and extra time.

### 📊 Dataview & Numeric Time Sync
Whenever timers or extra time change, `RecipeCard` writes `total_time` back to YAML frontmatter as a **pure number in minutes** (e.g. `total_time: 75`).
- **Dataview queries:** Sort recipes with `SORT total_time ASC` or filter with `WHERE total_time <= 30`.
- **Obsidian Bases & Filters:** Compare recipe durations numerically without parsing string units like `"1 hr 15 min"`.
- **Display:** Human-friendly formatting (e.g. `1 hr 15 min` or `1h 15m`) is rendered dynamically in the UI.

### 🌐 Localization Support
Labels and time units adapt automatically based on Obsidian's active language (`moment.locale()`) or settings:
| Language / Mode | Cook Time | Extra Time | Total Time | Format Example |
| :--- | :--- | :--- | :--- | :--- |
| **English (`en`)** | `Cook` | `Extra` | `Total` | `1 hr 30 min` |
| **German (`de`)** | `Kochzeit` | `Zusatzzeit` | `Gesamt` | `1 Std. 30 Min` |
| **Compact** | — | — | — | `1h 30m` |
| **Minutes only** | — | — | — | `90 Min` |

---

## 🥗 Ingredient Workflow & Text Highlighting

Marking ingredients in recipe instructions shouldn't clutter your preparation text with symbols. **Recipe View Plus** uses a **define-once** approach:

### 1. Mark in the Ingredient List
Add `@` in front of the keyword in your ingredient list:
- **Single-word ingredients:** `250 g @Butter`, `2 tbsp @{olive oil}`, `500 g @Flour`
- **Multi-word ingredients:** `150 g @{brown sugar}`, `@{chopped almonds}`, `1 tsp @{vanilla extract}`

### 2. Clean Ingredient Display
The plugin strips the `@` and `{}` syntax when rendering the ingredient card. Your ingredient list displays cleanly as:
- `250 g Butter`
- `150 g brown sugar`
- `2 tbsp olive oil`

### 3. Automatic Step Highlighting (`.recipe-ingredient-tag`)
The recipe step text remains **completely free of special syntax**. The plugin scans the instructions and highlights matches automatically:

```markdown
<!-- Written in your ingredient list: -->
- 250 g @Butter
- 150 g @{brown sugar}

<!-- In your preparation step: -->
1. Melt the Butter in a saucepan and stir in the brown sugar.
```

- Multi-word phrases (`brown sugar`) are prioritized over shorter substrings (`sugar`).
- Case-insensitive matching preserves the casing written in the step text.
- Full support for word boundaries, umlauts, and hyphenated terms.
- Protected elements: Highlighting will never inject tags inside timers (`@timer`), existing links, code blocks, or scaled quantities.

---

## ⏱️ iOS Shortcut Timers (`@timer{...}`)

Trigger kitchen timers directly on your iPhone, iPad, or Mac via the iOS Shortcuts app:

- `@timer{15}` ➔ `⏱ 15 min`
- `@timer{30|Rest dough}` ➔ `⏱ 30 min (Rest dough)`
- `@timer{1h 15m|Bake cake}` ➔ `⏱ 1 hr 15 min (Bake cake)`

### How It Works
Clicking a timer button triggers the URL scheme:
```text
shortcuts://run-shortcut?name=StartTimer&input=text&text=30|Rest%20dough
```
- **Shortcut Name:** Configurable in settings (default: `StartTimer`).
- **Exact Numeric Input:** The shortcut always receives the exact duration in minutes (e.g. `90` for `1h 30m`), ensuring timer actions work reliably.
- **Custom URL Template:** Supports custom templates for apps other than Apple Shortcuts.

---

## 📋 Lists, Checkboxes & Layout Structure

### Interactive Ingredient Checkboxes
- Round, touch-friendly checkboxes in front of every ingredient item.
- Checked items are styled with a muted strikethrough effect.
- Click events use `stopPropagation` so ticking an ingredient won't trigger step selection or scroll jumps.

### Markdown Checkbox Sanitization
If your note already uses task-list syntax (e.g. `- [ ] 200 g Flour` or `- [x] 1 pinch of salt`), the parser cleans away native checkbox tokens:
- Eliminates duplicate checkboxes.
- Pre-checks ingredients if marked with `- [x]`.

### Side-Column Spacing for Subheaders
When recipes group ingredients into subcategories (e.g. `### Dough`, `### Filling`, `### Frosting`):
- The first header stays flush with the top (`margin-top: 0`).
- Subsequent section headers receive a generous top margin (`margin-top: var(--size-4-4)` / ~16px) to clearly separate ingredient groups.

### Step-by-Step Selection
Clicking any preparation step highlights the entire row with an accent border (`.is-selected`). Keyboard shortcuts allow hands-free navigation while cooking:
- <kbd>j</kbd> / <kbd>k</kbd>: Move to next / previous step.
- <kbd>n</kbd> / <kbd>p</kbd>: Check next / uncheck previous ingredient.
- <kbd>[</kbd> / <kbd>]</kbd>: Decrease / increase recipe servings scale.

---

## 📱 Mobile & Touch Usability

- **Double-Tap Protection:** Mobile WebViews frequently trigger edit mode on quick double-taps. Recipe View Plus captures rapid consecutive taps on reading view containers (`touch-action: pan-x pan-y`) so you never accidentally switch into editor mode while checking off items or starting timers.
- **Responsive Single-Column Breakpoint:** Switches gracefully to a stacked vertical flow on mobile phones and narrow split panes.
- **Cover Image Resolution:** Supports frontmatter `cover: "image.png"`, wikilinks (`![[image.png]]`), and web URLs, falling back to the first embedded image in the note.

---

## 📝 Complete Recipe Example

Copy and paste this example note into your vault to test all features:

````markdown
---
type: recipe
servings: 4
extra_time: 15
cover: "https://images.unsplash.com/photo-1578985545062-69928b1d9587"
difficulty: Easy
tags:
  - baking
  - cake
  - chocolate
---

# Chocolate Cake with Ganache

## Ingredients

### Dough
- 250 g @Butter (softened)
- 200 g @{brown sugar}
- 4 eggs
- 300 g @Flour
- 1 packet baking powder
- 50 g @{cocoa powder}
- 100 ml @Milk

### Ganache
- 150 g @{dark chocolate}
- 100 ml heavy cream
- 1 tbsp @{liquid honey}

## Directions

1. Preheat the oven to 180 °C (350 °F). Grease a round springform pan.
2. Beat the Butter and brown sugar until fluffy. Add the eggs one at a time.
3. Sift together the Flour, cocoa powder, and baking powder. Add alternately with the Milk into the batter.
4. Pour the dough into the pan and bake for @timer{35|Bake cake} in the oven. Test with a toothpick!
5. For the ganache, finely chop the dark chocolate. Heat the cream and liquid honey in a small pot, remove from heat, and melt the chocolate into it.
6. Spread the ganache over the cooled cake and let it set for @timer{20|Set ganache}.
````

---

## ⚙️ Plugin Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| **Auto-render in Reading View** | `true` | Automatically render recipe cards in native Reading View for matching notes. |
| **Frontmatter filter key** | `type` | Frontmatter key used to identify recipes (e.g. `type`). |
| **Frontmatter filter value** | `rezept` | Value required to trigger recipe view (case-insensitive, e.g. `rezept, recipe`). |
| **Cover image property** | `cover` | Frontmatter property for the recipe hero/cover image. |
| **Servings property** | `servings` | Frontmatter property for base servings (default: `1`). |
| **Shortcut name** | `StartTimer` | iOS Shortcut name triggered by clicking `@timer{...}` buttons. |
| **Custom URL template** | *(empty)* | Optional URL template for custom timer integration schemes. |
| **Timer display format** | `de` | Duration display format (`de`, `en`, `compact`, `minutes`). |
| **Side column regex** | `Ingredients\|Zutaten...` | Regex matching headings that should be pulled into the ingredient column. |
| **Style ingredients as card box** | `true` | Render the side ingredients column with subtle card background and border. |
| **Single-column max width** | `600px` | Viewport width below which the card switches to single-column layout. |

Additional visual options are configurable via the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin.

---

## 🛠️ Development & Building

```bash
# Install dependencies
npm install

# Run Jest unit tests
npm test

# Production build
npm run build
```

---

## 📜 Credits & Attribution

- **Original Plugin:** Forked from [Obsidian Recipe View](https://github.com/lachholden/obsidian-recipe-view) created by **[lachholden](https://github.com/lachholden)** under the [MIT License](LICENSE).
- **Icons & Artwork:** Whisk logo and preview artwork based on assets by [Andy Chilton](https://unsplash.com/@andyc) on Unsplash.
- **License:** MIT License. See [LICENSE](LICENSE) for details.
