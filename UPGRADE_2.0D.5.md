# WorldPulse 2.0D.5 — WorldPulse-2 frontend (GitHub Pages)

Upload this package **only** to `DVExperiments/WorldPulse-2`, at repository root. Preserve `assets/population-density.png` and `assets/population-density-info.json` and any files you added since 2.0D.1.

This frontend is based on the verified D.1 Discover release and retains Three.js globe, routes, population dots and mapped news dots. Discovery and headline search now include `unlocated_articles` when the original WorldPulse collector exposes that field.

- Browse-only stories receive no View on globe button; they explicitly say `Location unverified`.
- Stories older than 24 hours display an Archive badge (24–72 hours). They are not called breaking/live.
- "Around the World" is intentionally mapped-only because we cannot confidently place browse-only articles.
- Both packages are needed to enable this feature; frontend alone remains backward-compatible with the previous feed.
- Do not publish collector source scripts to this repo.

Optional: refresh the WorldPulse-2 webpage with Ctrl+F5 once GitHub Pages rebuilds.
