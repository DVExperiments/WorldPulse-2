WorldPulse v2.0F.4.1 — responsive globe framing fix

Upload src/main.js to DVExperiments/WorldPulse-2/src/ on GitHub, replacing the current main.js.
This is a frontend-only change. Leave src/story-clusters.js, style.css and collector files unchanged.

Reset view will now recalculate camera distance and position based on the available globe area. A screen resize also recalculates the fit. Browser refresh after deployment (Ctrl+Shift+R).

Test on the affected device and on a regular desktop. If alignment is still wrong, send a screenshot plus browser/device information.
