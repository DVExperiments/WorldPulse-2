# WorldPulse v2.0E.4 — Frontend transparency patch

Target: `DVExperiments/WorldPulse-2` (the neon Three.js globe).

Upload/overwrite **only** these paths in your EXISTING frontend repo: `src/main.js`, `src/geo-evidence.js`, `style.css`. Do **not** delete the existing `assets/`, `data/`, `index.html`, or other source files.

The visible explanation appears beneath mapped story listings in the globe drawer, search results, and Discover cards. Browse-only articles are labelled unlocated. The globe, population density texture and routes remain untouched.

IMPORTANT: `src/main.js` and `style.css` are based on the previously supplied **2.0D.5 frontend**. If you edited those files after 2.0D.5, this overwrite could replace those changes. Compare before uploading; send your current versions if they differ.

Deploy collector first, then frontend. Even before new collector JSON arrives, the frontend shows sensible conservative fallbacks for old article records. No externally loaded UI library is added.
