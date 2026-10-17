# WorldPulse 2.0C.1 — Route Motion Visibility Fix

Updates the route-line fragment shader to show a noticeable directional light band, rather than a barely visible tiny trace. The broad highlight has a soft trailing falloff and a brighter leading crest; progress travels from the first to the next route waypoint. Motion remains decorative, not live vessel or aircraft movement.

## Install
Upload all files in this ZIP at the root of your existing `WorldPulse-2` GitHub Pages repository. Retain your previously installed `assets/population-density.png` file. No change to the original WorldPulse site or update workflows.

## Accessibility
The existing Route motion toggle and Reduce motion setting disable animation. The route lines remain static and visible when motion is off.

## Data disclosure
Both air and maritime networks remain schematic and are not live traffic or independently verified active routes.
