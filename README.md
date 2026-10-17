# WorldPulse 2.0C.4 — More Individual News Signals

A complete GitHub Pages replacement building on 2.0C.3.

## Changes
- **Balanced (default)**: smaller markers, with only limited geographic clustering at distant zoom.
- **Individual**: every mapped news signal shown separately, including overlapping signals sharing a location.
- **Clustered**: retains the original zoom-dependent category-specific grouping.
- Category colours, marker clicking, links, refresh, population lights, flight/shipping corridors and route motion are unchanged.
- No invented news or modified geographic coordinates.

## Install
Extract the ZIP and upload the files **inside** its `WorldPulse_2.0C.4/` folder directly to the root of your `WorldPulse-2` repository, replacing matching existing files. Keep `assets/population-density.png` and its metadata JSON. Wait for GitHub Pages to publish and hard refresh.

Select the three modes in the new **NEWS DISPLAY** control, below the News signals toggle. All modes use the same feed; only display grouping changes.

## Limitations
Geographic news accuracy comes from the original feed. Multiple signals at identical mapped coordinates will still visually overlap in Individual mode. We deliberately do not spread them to invented coordinates. Grouping is by category and geographic proximity and does not imply shared stories. Static hosting and original read-only live feed connection are unchanged.
