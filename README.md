# WorldPulse 2.0B.4 — True Population Density Field

This complete GitHub Pages-ready upgrade builds on **2.0B.3** and **preserves its distinct city-light blinking, open 3D mesh, thin borders and motion settings**.

## What's improved

- The measured population raster controls **whether a point exists**, **its brightness**, and **how many additional lights appear in its immediate area**.
- Highly populated locations can support more, slightly larger and brighter points; very low-population areas lose most of their points.
- Maintains GPU shader-based independent blinking; all visual points remain anchored to the Earth.
- Preserves reduced-motion and layer toggles.
- Correctly labels fallback geographic points as a preview, **not** population data.

## REQUIRED for measured density

Copy the measured raster **`assets/population-density.png`** from your original WorldPulse repo into the same path in `WorldPulse-2`. **This ZIP does not include that raster.** Without it, there is no scientific basis for portraying dot presence as population density, and the site will display an explicitly labeled land-point preview.

The raster encodes relative intensity, not raw people per square kilometre. The renderer therefore displays a *relative* settlement illumination field, not an exact population count or equal-area density estimation. Visual density is additionally influenced by the map projection and viewing angle.

## Install

Extract the ZIP and upload **all included files and folders** to the root of the `WorldPulse-2` GitHub repository, replacing matching files. Do not delete a previously uploaded `assets/population-density.png`.

Hard-refresh after GitHub Pages deploys. Check that the panel under Population lights reads **“Measured density light field”**. Compare India, eastern China, Japan or western Europe against the Sahara and interior Australia.

## Safety and data transparency

Population glints are artistic ambience, not real-time settlement activity. Motion controls and reduced-motion support remain available. News, flight routes and shipping routes have not yet been added.
