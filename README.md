# WorldPulse 2.0D.1 — Global Coverage & News Discovery (Phase 1)

This is a **complete GitHub Pages frontend replacement** based on 2.0D. It preserves the working 3D globe, measured population raster support, route motion, original news feed, article drawer and search.

## Added
- Discover News panel with **Top**, **Latest**, **Most covered**, and **Around the world** views.
- Publisher-link-based discovery; all headlines and links come from actual linked articles in the existing mapped feed.
- Each discovery card can open the geographic news drawer or the original source link.
- Source-limited explanations so users do not mistake *most covered* for social-media engagement or comprehensive worldwide importance.
- A **separate local coverage audit script** (`coverage-tools/audit_news.py`) which produces a CSV of mapped locations, links and publishers. No existing news collector or GitHub workflow was modified.

## Important limitation
This is **Phase 1**, not completed global source expansion. The current `data/news.json` exposes mapped location groups and some linked sampled articles; without inspecting and expanding the original full Python source registry, this package cannot honestly claim to add publishers to underserved countries. A future collector update should verify feed availability, rights, geographic mapping and each country's reporting diversity before enabling additional sources.

## Installation
Upload the contents of this folder (not the outer folder) to the **WorldPulse-2** GitHub repository root. Preserve `assets/population-density.png` and `assets/population-density-info.json`. Do not upload it to the original WorldPulse repository.

The original WorldPulse RSS collector and `.github/workflows/update.yml` are unchanged. This frontend reads the original feed as before.

## Run audit separately
With a downloaded copy of the original `news.json`, run:

`python coverage-tools/audit_news.py news.json --out coverage-report.csv`

This reports *mapped location names*, not inferred ISO countries or a full source registry. No new country coverage figures are claimed.
