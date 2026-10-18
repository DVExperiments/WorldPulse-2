# WorldPulse 2.0D.2 — Worldwide Publisher Expansion (Collector Patch)

**Install into the ORIGINAL `DVExperiments/WorldPulse` repository, not `WorldPulse-2`.**
The original collector produces `data/news.json` that the new site consumes.

## What this release actually provides

- 34 **candidate** additional regional and multilingual RSS/Atom feed URLs in `scripts/coverage_expansion.py`. They are **not claimed to be verified live**. Some may fail, redirect, block scraping, or have changed since listed.
- A conservative stage of **8 candidate feeds enabled by default** where their URLs are not already present in the existing registry. The existing registry already includes some overlapping sources, so the number of genuinely new feeds may be smaller.
- No changes to `scripts/update.py`, its geoparsing/deduplication logic, or `.github/workflows/update.yml`.
- `scripts/audit_global_coverage.py`, a stdlib-only utility that produces country-name-mention and source-health reports after a collector run.
- `scripts/preflight_candidates.py` to live-check URLs when GitHub Actions/network access is available.
- An inventory of 173 country / territory names derived from the current WorldPulse 2 boundary map, intended for an **initial** coverage report, NOT an exhaustive list of all countries or territories.

## Install (browser-only)

1. Download/extract this ZIP.
2. Go to the **original** `WorldPulse` GitHub repository.
3. Upload `scripts/publisher_network.py` (replace existing), `scripts/coverage_expansion.py`, `scripts/audit_global_coverage.py`, `scripts/preflight_candidates.py`, `data/country-inventory.json`, and `tests/test_coverage_extension.py`, keeping their directory paths.
4. **Do not remove anything else or alter the existing update workflow.**
5. Commit and check the next scheduled collector run and `data/source-health.json`. If feeds fail, the collector should record their failures; revert this commit if collection becomes unreliable.

**Compatibility prerequisite:** the currently deployed `scripts/update.py` must import `merge_feeds` from `publisher_network.py`. This was how the original v1.5.4B collector was configured. If your repository was changed afterward, check this before uploading. If that import is missing, the newly added feeds will not be used.

## Generate the audit

In a GitHub Codespace or any Python environment from the original repo root:

```bash
python scripts/audit_global_coverage.py
```

This writes `data/coverage-audit.json` and `data/coverage-audit.csv` in your working copy. The audit does **not** run automatically in GitHub Actions; adding that later requires an intentional workflow change.

The country-name counts are only a **partial lower bound** and exclude city- and region-labelled signals. A zero is NOT evidence of no news. Source region reports are about a feed's editorial focus, not the story's event location.

To test candidate feeds using a network-enabled environment:

```bash
python scripts/preflight_candidates.py --limit 10
```

The check writes `data/feed-candidate-preflight.json`. Later, to opt into the full unverified candidate pool, set `WP_EXPAND_ALL_CANDIDATES=1` for the collector, but **only after** feed checks and runtime/performance assessment. Running all sources can lengthen scheduled jobs.

## Next steps

D.2 is an incremental first expansion and diagnostics foundation—not global coverage parity. Evaluate `source-health.json` and the audit, verify additional country-specific feeds, and prioritise countries with sparse confirmed reporting. Improve geographic country attribution (city + region + source are separate dimensions) before treating the audit as complete.
