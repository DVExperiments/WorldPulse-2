# WorldPulse 2.0B.5 — Density Field Spread

This complete GitHub Pages-ready upgrade builds on **2.0B.4** and keeps the open mesh globe, thin bright borders, wireframe controls and ambient light glints.

## What changes in 2.0B.5

- Population lights now use a **spread-aware density field** instead of relying mainly on a single local raster sample.
- Denser settlements softly influence **nearby lights as well as their own position**, so populated regions read as broader connected fields rather than isolated pinpricks.
- Sparse interiors, deserts and remote regions remain comparatively quiet.
- Dot brightness and companion-light generation now respond to the **combined local + nearby density signal**.
- Fallback behaviour is unchanged: if the population raster is missing, the app clearly stays in **land-point preview** mode.

## Why this patch exists

2.0B.4 improved local population weighting, but the density representation could still look too thin or too isolated in some areas. This patch is intended to make population patterns feel more geographically continuous.

## REQUIRED for measured density

Copy the measured raster **`assets/population-density.png`** from your original WorldPulse repo into the same path in `WorldPulse-2`. **This ZIP does not include that raster.**

Without it, the app cannot measure density and will fall back to the clearly labelled land-point preview.

## Install

1. Extract the ZIP.
2. Upload **all included files and folders** into the root of the `WorldPulse-2` GitHub repository.
3. Replace matching files.
4. Keep your existing `assets/population-density.png` in place.
5. Wait for GitHub Pages to redeploy, then hard refresh.

## Expected result

Dense regions should now read more continuously, including:

- eastern United States
- Great Lakes corridor
- California and Texas corridors
- western and central Europe
- India
- eastern China / Korea / Japan
- southeast Brazil
- denser African corridors and coastlines

This remains a **visual density field**, not a person-per-dot map.
