# WorldPulse 2.0B.3 — Living City Lights

A complete GitHub Pages-ready replacement based on **2.0B.2**.

## What's changed

- GPU-rendered population lights now have **occasional, staggered glints**, rather than continuous, barely noticeable brightness fluctuations.
- Only a subset of dots glints, with independently timed and smoothly faded brightenings. No synchronized pulse, no rapid on/off strobe.
- Brighter glints are visible without changing the positions or sizes of the dots.
- Preserves the open mesh, no sphere surface, no halo, thin country boundaries, sparse latitude/longitude lines, and existing layer controls.
- The Ambient light variation switch continues to turn blinking off, and reduced-motion disables it by default.

## Installation

Extract the ZIP and upload its **contents** to the root of your `WorldPulse-2` GitHub repository. Overwrite matching files and keep existing additional files.

If you've uploaded `assets/population-density.png`, **keep it in place**. This ZIP does not contain that raster, and without it the dots remain a land-only preview, not population density data.

After GitHub Pages deploys, hard refresh the page. Toggle `Ambient light variation` on, look at one population-rich area for 10–15 seconds, then toggle it off to compare.

## Accessibility

The on/off setting remains available, and browser reduced-motion preference turns animated changes off. Glints are asynchronous, smoothed and intentionally infrequent, but this is not a formal photosensitivity assessment.

## Data integrity

There is no fake news, flight or shipping data in this build. The population brightness is only meaningful if you provide the measured raster from the original site.
