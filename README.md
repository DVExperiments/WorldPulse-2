# WorldPulse 2.0B — Open Mesh Earth

A GitHub Pages–ready evolution of the working 2.0A Three.js prototype.

## What changed

- Removed the opaque planet sphere material completely.
- Removed the atmosphere/halo geometry and its toggle; no bubble effect.
- Added an independent **Network wireframe** switch for a low-contrast 3D spherical lattice: meridians, parallels and sparse diagonal links.
- Kept cyan population lights, neon country outlines, camera navigation, automatic rotation, reduced-motion handling and graphics settings.
- Kept a **colorless depth-only sphere** strictly for occluding back-side geometry. It cannot be seen, and isn't a physical globe surface. This makes foreground borders and points readable instead of showing both sides through the planet.
- Retained separate `news`, `air`, `sea` scene groups for real datasets later. Nothing is simulated as genuine traffic.

## Install on GitHub Pages

Upload the **contents** of this ZIP to the **root** of your separate `WorldPulse-2` repository, replacing files when prompted. `index.html`, `style.css`, `src/` and `data/` must be directly in the root; do not upload a parent folder instead. The existing WorldPulse site is not touched.

Settings → Pages → Deploy from branch → `main` / `(root)`; after deployment, hard-refresh your page (`Ctrl+F5`).

The static site runs from `index.html` with CDN-hosted Three.js; no local build step is required. The included `package.json` and `vite.config.js` support optional local development via `npm install` / `npm run dev` and compilation with `npm run build`.

## Important note about population points

This starter uses land points as a geographic preview unless `assets/population-density.png` is supplied. The measured population raster is not bundled. Flight, shipping and news layers remain empty until sourced data is integrated.

## Visual controls

`Population lights`, `Country boundaries`, `Network wireframe`, `Ambient light variation`, `Slow automatic rotation`, `Reduce motion` and `Graphics quality` are independent.

## Implementation detail

The wireframe is true world-space THREE.LineSegments geometry, not a texture painted onto a sphere. The hidden depth mask preserves front-side visibility and depth, while adding **no visible shell, shading, or Fresnel halo**.
