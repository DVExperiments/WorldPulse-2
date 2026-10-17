# WorldPulse 2.0C.2 — Population Accuracy / New Zealand Test

This GitHub Pages-ready release builds on 2.0C.1 and **keeps flight/shipping corridors, their directional highlights, the open mesh, cyan border styling and motion controls unchanged**.

## Main improvements
- Reads `assets/population-density-info.json` and checks the raster resolution against metadata.
- Uses bilinear sampling aligned to the 1440×720 image. Image pixel values represent `log1p(persons/km²)/log1p(10000)` according to the uploaded metadata, and are interpreted as relative intensity, not raw density values.
- Restricts neighborhood smoothing to ~0.3° instead of several degrees, avoiding false population spread across nearby sparsely inhabited regions.
- Generates additional points using sub-degree local sampling in areas where the raster shows settlement. Higher detail fades in as users zoom in, rather than overwhelming the world overview.
- Preserves the existing soft independent blinking and reduced-motion option.

## Important files
Your existing `assets/population-density.png` and `assets/population-density-info.json` must remain in the `WorldPulse-2` repository. **Neither raster nor JSON is overwritten by this ZIP.** If the PNG is missing, the map shows its labelled geographic preview.

## Installation
Extract the ZIP. Upload the contents of the **WorldPulse_2.0C.2** folder to the repo root, with `index.html` at the root. Replace source files, preserve the existing population assets. Refresh after deployment.

## Verification
1. Confirm Population lights reads **Measured density · zoom-adaptive**.
2. Zoom to New Zealand. Look for more localised concentrations around major urban centres and fewer unrelated inland points.
3. Zoom back out; fine-detail points should soften/fade to avoid clutter.
4. Check flight and shipping motion still behave as in 2.0C.1.

The source raster itself is only 0.25° per pixel, so this patch cannot provide accurate individual-city-boundary or neighbourhood patterns. A true higher-resolution WorldPop dataset, clipped to countries, is needed for that.

The flight and shipping networks remain schematic, not tracked traffic. Route kinks near Hawaii come from the illustrative sea-network waypoint geometry and are not verified navigation tracks.
