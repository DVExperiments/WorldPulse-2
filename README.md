# WorldPulse 2.0B.2 — Population Grid and Border Refinement

This full GitHub Pages replacement builds on **2.0B.1**, preserving the open mesh, no solid visible globe, no atmosphere/halo, and sparse 20-degree lat/long lines.

## Fixes
- **Flicker actually responds to its toggle.** Shader updates were previously only set when the population layer first loaded. Now enabling/disabling the checkbox changes the shader in real time. Independent smoothly interpolated noise with a stronger brightness range is used; no synchronized pulse or sharp strobe flashes.
- **Visibility across zoom.** GPU point sizes are clamped to remain small but perceptible over a greater camera distance range.
- **Measured density restoration.** If `assets/population-density.png` is available, it now modulates both point brightness and dot presence, allowing dense areas to appear denser. This uses the raster from the **original WorldPulse project**; it is not bundled or falsely recreated.
- **Borders are visibly finer.** Removed the duplicate scaled glow line, leaving a single bright cyan WebGL line.

## Essential step for measured population
Your new `WorldPulse-2` repository currently appears to lack the original measured population raster, which is why the preview dots are arranged across land nearly uniformly. To fix this, in your ORIGINAL WorldPulse GitHub repository, open **assets/population-density.png**, click Download raw file, then upload it into the NEW WorldPulse-2 repository at **assets/population-density.png**. In GitHub you can create the `assets` folder if needed. Do not rename the PNG. This raster was previously generated from WorldPop data by the original project's separate workflow. Do not run or change any news collection workflow.

Until the PNG is present, the UI deliberately says **Land-point preview — not population data**. Population *appearance* cannot be fully corrected by shaders without population data.

## Installation
Upload the extracted contents of this ZIP into the root of `WorldPulse-2`, replacing existing matching files. Include the `src`, `data` and `assets` folder structures. **Do not overwrite/delete your existing population raster when updating**. Wait for GitHub Pages to deploy, then press Ctrl+F5.

## Controls and accessibility
The Ambient light variation toggle now works after loading. With reduced-motion enabled, animation is disabled. Soft brightness changes are not formally photosensitivity-tested; keep the switch off if sensitive to animated light.

## Testing
1. With the globe loaded, toggle Ambient light variation off/on while looking at a population-rich area.
2. Verify the `Population lights` subtitle says **Measured population-weighted points** once the raster is installed.
3. Zoom between global and regional views and check point visibility.
4. Confirm country boundaries stay fine and bright, and there is no bubble/halo.

No news, air or sea route data is fabricated in this foundation build.
