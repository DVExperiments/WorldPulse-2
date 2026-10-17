# WorldPulse 2.0A — Living Earth rendering foundation

A separate Three.js proof of architecture for the next generation of WorldPulse, designed to coexist with the current production news site. This release is a **rendering prototype**, not a replacement for the functioning news website.

## Included
- True Three.js/WebGL Earth, OrbitControls rotation/zoom and atmosphere.
- Neon country-boundary geometry from the existing WorldPulse border GeoJSON.
- Individual GPU-rendered surface points with asynchronous shader-based brightness changes (no repeated large canvas uploads).
- Independent scene groups for Earth, borders, population points, news, flight routes, shipping corridors and atmosphere.
- Layer switches, manual rotation, reduced-motion controls and graphical quality options.
- Responsive standalone web UI; no accounts or server required.
- Optional measured-population-raster integration.

### Important data disclosure
The bundled download has **no** `assets/population-density.png`. Until a real raster is supplied, the cyan points simply illustrate **land geography**, with procedural brightness that is **not a population measurement**. Do not describe that fallback as measured population density. To enable measured brightness, copy your original WorldPulse `assets/population-density.png` to this new repo's `assets/` folder. The loader reads its red channel as a value; the original build should use a worldwide equirectangular raster. Check orientation and units against the original project's raster generator.

There are **no fabricated news markers, airline flight paths or shipping lanes** in v2.0A. Independent, empty data groups are provided for future integrations.

## Publish on GitHub Pages (easiest, no build required)
1. Create a **new repository**, for example `WorldPulse-2` (do not overwrite the existing WorldPulse repo).
2. Extract this ZIP. Upload the **files and folders inside** the directory to the **repository root**: `index.html`, `style.css`, `src/`, `data/`, `assets/`, and supporting files. Do not upload the enclosing folder as a single directory.
3. In GitHub, go to **Settings → Pages → Build and deployment → Deploy from a branch**. Select `main`, `/ (root)` and save.
4. Your test URL will be `https://<github-username>.github.io/<repo-name>/`, for example `https://dvexperiments.github.io/WorldPulse-2/` if named `WorldPulse-2` under that account.
5. Wait for Pages, then hard-refresh. The first load requires access to jsDelivr to download Three.js.

**Do not open `index.html` by double-clicking it on your computer.** ES modules and GeoJSON loading require a local web server or GitHub Pages.

## Optional local development with Vite

Node 20+ recommended:

```bash
npm install
npm run dev
```

For a compiled deployment:

```bash
npm run build
```

Upload contents of `dist/` to a static host (or use a Pages Actions workflow in the future). `base: './'` supports GitHub Pages subpaths. The included root files are already **directly deployable** to GitHub Pages, so you do not have to install Node to try the project.

## Accessibility and performance
- Automatically disables rotation and illumination variation when the browser requests reduced motion.
- User can independently disable animation and set graphics to Low power.
- Markers are real GPU points; no expensive frame-by-frame map image uploads.
- Constellations/news, airline/ship routes and data events will be distinct layers so they can be toggled independently.
- Performance and colour/contrast should be tested on actual target devices and with accessibility users before deployment as production.

## Technical limitations in this alpha
- GeoJSON linework is Earth-surface geometry, not terrain height data.
- Flight and shipping route layers are empty deliberately pending appropriately sourced data.
- No live news data is connected yet. The current production news feed stays intact.
- Three.js dependencies in the directly hosted version load from a third-party CDN; a compiled Vite production build can bundle code locally.
- Three.js Vite dependency installation/build and rendering were not available to verify in the authoring environment; source JS syntax was checked.

## Next milestones
- 2.0B: port real WorldPulse category-filtered news and location clusters into true GPU sprites/point geometry.
- 2.0C: preprocessed, licensed airport-to-airport route graph with altitude arcs; distinguish published routes from live aircraft positions.
- 2.0D: sourced maritime corridors/ports geometry; distinguish historical/scheduled corridors from live AIS vessel positions.
- 2.0E: quality controls, LOD, interaction polish, data transparency and accessibility review.

## Relevant files
- `src/main.js`: renderer, controls, runtime layer orchestration
- `src/layers.js`: Earth, borders, population GPU shader and reserved future layers
- `src/geo.js`: geographic coordinate conversion and land containment
- `data/world-borders.geojson`: bundled geographic boundary input
- `style.css`, `index.html`: UI
