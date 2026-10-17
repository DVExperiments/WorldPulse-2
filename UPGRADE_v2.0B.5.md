# Upgrade notes — v2.0B.5

## Focus
Turn isolated population points into a more convincing spread-based density field.

## Files changed
- `index.html`
- `src/main.js`
- `src/layers.js`
- `README.md`

## Main implementation change
The population renderer now samples a local point plus several nearby rings to create a **spread-aware density value**. That combined value controls:

- whether a point survives
- how bright it is
- how many additional nearby lights are generated
- how widely those supporting lights spread

## Notes
- No solid sphere or atmosphere was reintroduced.
- No fake news, air, or sea data was added.
- If `assets/population-density.png` is missing, preview mode still activates safely.
