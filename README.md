# WorldPulse 2.0C.3 — Geographic News Intelligence

**Complete, static GitHub Pages site** built on 2.0C.2. This release adds a news layer to the working open-mesh globe, preserving the population accuracy work, directional flight-route pulses and schematic shipping corridors.

## What is new

- Loads **real mapped news snapshots** in the original WorldPulse `data/news.json` structure (`points`, `category`, `lat`, `lng`, `count`, `articles`, etc.). Does not invent stories or locations.
- Tries `https://dvexperiments.github.io/WorldPulse/data/news.json` first. If that request fails, tries an optional local `data/news.json`. The original WorldPulse collector and workflow remain untouched.
- Draws clickable **GPU-rendered coloured news lights**, replacing large cylinders. Categories have their original colour identities.
- Zoom-dependent grouping: 8° cells far out, 4.5° at moderate globe distances, 2° close, individual signals at the closest zoom. Groups never cross category boundaries.
- Category filters, news layer toggle, article details panel with source links, manual refresh and automated 15-minute checks.
- Shows the snapshot's reported freshness/status and article sample count. No claim of verified real-time reporting.
- Missing feed is visibly reported without breaking the globe. No placeholder news is manufactured.

## Install

1. Extract the ZIP and upload **the contents of `WorldPulse_2.0C.3/`**, not the folder itself, directly into the `WorldPulse-2` GitHub repository root. `index.html` must be at the root.
2. Replace matching existing files, but **keep** `assets/population-density.png` and `assets/population-density-info.json` if already uploaded.
3. Commit, allow GitHub Pages to publish, then hard-refresh.
4. Look for the **NEWS INTELLIGENCE / MAPPED FEED** section. When the feed is accessible you should see counts and coloured clickable lights. Click a news light to open its underlying article links.

### If the news feed does not load

WorldPulse-2 uses a *read-only request* to your original site's `data/news.json`. If the original site is unavailable, blocks cross-origin requests, or no current feed exists, the app shows **News feed unavailable**. You can alternatively copy the original repository's current `data/news.json` into `WorldPulse-2/data/news.json`. That fallback is a **static snapshot**: it will not refresh automatically unless you separately maintain it.

No news collector or GitHub Action has been copied or modified by this build. The original site must keep running to provide automatic updates.

## Interpretation and limitations

- News marker count is based on mapped feed records and their **deduplicated sampled article counts**, not all reporting worldwide.
- A signal may represent a broad country- or region-level topic, **not the exact event location**. The selected marker reports broad accuracy when provided in the original feed.
- Spatial grouping is a cartographic representation, not evidence that individual news stories share an event.
- Flights and sea routes remain **schematic**, not live tracking or authoritative navigational data.
- Population raster remains a historical **relative settlement-density** map rather than live population counts.
- News source access has been checked for schema compatibility, but its external availability could not be verified from this offline build environment. Please test on the published GitHub Pages site.
