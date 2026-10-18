# WorldPulse 2.0F.1 — expandable multi-source story groups

**Target: `DVExperiments/WorldPulse-2` frontend only. Requires the E.4 frontend and F.1 collector.**

## Install (safe integration, don't replace the globe)
1. Upload `src/story-clusters.js` and `scripts/apply_f1_frontend.py` into the matching folders in the WorldPulse-2 repository and commit them.
2. Open Codespaces in WorldPulse-2 and run:

```bash
git pull origin main
python scripts/apply_f1_frontend.py
node --check src/main.js
node --check src/story-clusters.js
```

3. **Optional styling:** append the contents of `cluster-styles.css` to the end of the repository's existing `style.css`. Do not replace `style.css`. You can use GitHub's built-in editor. The HTML works without these optional styles.
4. Commit the one-line import and render-hook change:

```bash
git add src/main.js
git commit -m "Display F1 story groups in Discover"
git push origin main
```

5. Wait for GitHub Pages deployment. Under Discover, multi-source story groups appear above the normal existing article list, when feed groups are available. Groups expand to original publisher articles. Other browsing modes remain unchanged.

## Safety
- Installer is fail-closed: if E.4 frontend hooks differ, it stops without touching the file. Send current `src/main.js` if you see this warning. Do not upload older complete `src/main.js` or `style.css` files.
- The module only uses DOM `textContent` for external titles, with validated HTTP(S) links. It does not alter the Three.js globe, map pins, routes, controls or news data fetch.
- If the collector is not deployed or there are no high-confidence groups, the existing Discover display stays the same.
