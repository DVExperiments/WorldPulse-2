# WorldPulse 2.0D — News Exploration

Browser-ready WorldPulse 2.0 expansion on top of v2.0C.4.

## New features

- **Story explorer**: search linked headlines by title, publisher, category and mapped place; press Enter or select **Explore stories**.
- **Location jump**: open the correct geographic signal from search results and browse its articles.
- **Article ordering**: sort selected-location headlines by publication date or publisher.
- **Category shortcuts**: **Show all** / **Hide all** category filters.
- **Link safety**: clickable articles require valid HTTP(S) links; no new story or location is invented.
- **Accessibility**: Escape closes the news drawer, and input and actions are keyboard accessible.

## How to install

1. Unzip the archive.
2. Upload the *contents inside the `WorldPulse_2.0D` folder* to the root of **WorldPulse-2**, not the original WorldPulse repository.
3. Replace existing files, but keep your measured `assets/population-density.png` and `assets/population-density-info.json`.
4. Allow GitHub Pages to deploy and hard-refresh.

## News data

The site continues to load the original WorldPulse `data/news.json` feed, falling back to a local snapshot. Searches cover only articles included in mapped signals, so results are not necessarily exhaustive world news. The UI does not invent headlines or locations.

## What is unchanged

The Three.js globe, 3 news display modes, population illumination, borders, flight/shipping layers, route motion and reduced-motion settings are preserved.

## Limits

- Search is browser-side and works on the currently loaded mapped-news sample, not every article ever published.
- A single article URL may be associated with multiple places; search results deduplicate by URL.
- Sorting uses dates provided by the feed. Undated stories appear after dated items.
- No browser testing was possible in the packaging environment.
