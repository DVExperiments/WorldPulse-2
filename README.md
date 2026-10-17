# WorldPulse 2.0C.1 — Travelling Route Highlights

## Base: Global Connections Preview

**GitHub Pages-ready** continuation of WorldPulse 2.0B.5.

## What's new
- Separate AIR and SEA layers, independently switchable.
- 100+ *schematic* flight-corridor arcs using approximate real airport locations. These airport pairs illustrate global connectivity; **they are not validated schedules or current service availability**.
- 16 generalized shipping corridors routed along mapped maritime waypoints and major chokepoints. These are **illustrative generalized lanes, not navigable routes or vessel tracks**.
- Visually distinct flight arcs (cool blue and elevated) versus shipping corridors (teal and low over the water).
- Optional soft directional highlight pulses; disabled with reduced-motion setting. No solid globe or atmospheric halo.
- Population-density light field, glints, thin country borders, geographic wireframe, and graphic settings preserved from 2.0B.5.

## Data sources / limitations

The **airport-pair route collection is hand-curated and illustrative**, informed by broadly known international aviation hubs and OpenFlights airport/route data definitions, but source route files were not downloadable in the build environment and the individual pairs have **not been independently cross-checked**. Coordinates are approximate.

- OpenFlights database: https://openflights.org/data.php (Open Database License / ODbL). The enclosed simplified visual network is **not a copy or claimed validated extract** of that dataset.

The **maritime corridor geometry is hand-simplified**, using geographic landmarks including Suez, Malacca, Panama, and the Cape of Good Hope. The general structure is informed by published global shipping-lane references but is not copied from or an exact geometry representation of those sources.

- Benden, P. (2022), *Global Shipping Lanes*: https://doi.org/10.5281/zenodo.6361763
- Repository and usage notes: https://github.com/newzealandpaul/Shipping-Lanes

No actual AIS vessels, live aircraft, scheduled flights, counts, trade volume, or transport frequency are claimed. **Do not use these data for navigation or factual route-status decisions.** Upgrade these modules with georeferenced, license-appropriate route files later.

## Installation

1. Download ZIP and **extract it**.
2. Upload the contents **directly to the root** of your `WorldPulse-2` GitHub repository; `index.html` must be at the root.
3. Replace files when prompted, while **retaining your existing `assets/population-density.png`**.
4. Keep the original `WorldPulse` repository untouched.
5. After GitHub Pages deploys, hard-refresh.

The measured population raster is **not included** in this package. If absent, the existing UI continues to disclose its land-point preview mode.

## Suggested next milestone

2.0C.1: import and validate openly licensed actual flight route records and georeferenced shipping-lane polylines, apply distance-based simplification, precise dateline crossing, zoom-level density and interactive feature labels. Follow with news intelligence.

## Accessibility

The route-motion toggle and existing reduced-motion setting disable optional animated motion. Movement is illustrative, not real-time movement of aircraft or vessels.
