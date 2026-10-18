<div align="center">

<img src="docs/_static/Whisk.png" style="width:200px">

# 🧑‍🍳 Obsidian Recipe View Plus 🥘

<a href="https://github.com/N1ktra/obsidian-recipe-view/blob/master/LICENSE">![License](https://img.shields.io/badge/license-MIT-blue)</a>

*Bring Obsidian with you into the kitchen — enhanced fork of Obsidian Recipe View*

</div>


![Two example windows of the plugins showing open recipes](docs/_static/preview.png)

---

Store, write, and manage your recipes as regular Obsidian notes in **portable, future-proof markdown**, then view them as a gorgeous **interactive recipe card** when it's time to cook in the kitchen.

**Features include:**
- 📒 Works with your recipes as-is, in whatever format you like to write them
- 🎨 Strives for maximum compatibility with custom themes
- 🌈 Lets you use all the markdown that works in the rest of your vault
- ⚖️ Scales the quantities in your recipes easily (with `servings` frontmatter support as the base scaling value)
- 🖼️ Loads cover/hero images directly from frontmatter (default property: `cover`) with fallback to the first note image
- ⏱️ Inline iOS Shortcut timer syntax (`@timer{30}` or `@timer{30|Teig ruhen}`) rendered as styled, clickable timer buttons
- ⚙️ Can split your recipes into two columns or separate ingredients out by step, for easier reference while cooking
- ✅ Makes ingredient lists cross-out-able
- 📌 Lets you highlight steps to keep track of where you're up to
- 📱 Optimized for phones (iOS/Android), tablets, and desktop

## New in Recipe View Plus

### 1. Inline iOS Shortcut Timers (`@timer{...}`)
Use `@timer{minutes}` or `@timer{minutes|Label}` anywhere in your recipe steps:
- `@timer{30|Teig ruhen}` renders as `⏱ 30 Min (Teig ruhen)`
- Clicking triggers the iOS Shortcuts URL scheme:
  `shortcuts://run-shortcut?name=StartTimer&input=text&text=30|Teig%20ruhen`
- Both the Shortcut name (default: `StartTimer`) and an optional custom URL template can be configured in the plugin settings.

### 2. Cover Image via Frontmatter
Define your recipe's hero image in the YAML frontmatter using the `cover` property (configurable in settings):
```yaml
---
cover: "Pasted image 20261018.png"
servings: 4
---
```
Supports vault filenames/paths, wikilinks (`[[image.png]]`), markdown links, and external URLs. If omitted or empty, it falls back to the first image in the note.

### 3. Base Servings (`servings`) & Mobile Fixes
- Reads `servings` from frontmatter (default `1`) and uses it as the initial base scaling value.
- Fixed mobile rendering issues for ingredient lists (no unwanted square bullets or line breaks), ordered step lists (flexbox alignment for step numbers and text), and the mobile scale input display.

## Additional settings
The [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin will let you configure aspects of how the recipe card appears.

## Credits & Attribution
- **Original Plugin**: Forked from [Obsidian Recipe View](https://github.com/lachholden/obsidian-recipe-view) originally created by **[lachholden](https://github.com/lachholden)** under the [MIT License](LICENSE).
- Recipes used in the screenshot examples:
    - [Tasty.co's Chewy Chocolate Chip Cookies](https://tasty.co/recipe/the-best-chewy-chocolate-chip-cookies)
    - [Leite's Culinaria's Pastéis de Nata / Portuguese Custard Tarts](https://leitesculinaria.com/7759/recipes-pasteis-de-nata.html)
- Themes used in the screenshot examples:
    - Default Obsidian theme with Orange accent
    - [Damian Korcz's excellent Prism Theme](https://github.com/damiankorcz/Prism-Theme)
- In logo, top preview image, & social media preview:
    - Photo by <a href="https://unsplash.com/@andyc?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Andy Chilton</a> on <a href="https://unsplash.com/photos/0JFveX0c778?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>

  
