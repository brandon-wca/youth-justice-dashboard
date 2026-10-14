# Youth Justice Dashboard

*Draft README, October 14, 2026. Structure to be settled with Brandon.*

| | |
|---|---|
| **Status** | Setting up. Data copied in; no framework or code yet. |
| **Owner** | Brandon Washington, WCA. Claude does the work; Brandon approves every change. |
| **Published at** | Not yet. Planned: data.wca4kids.org (GitHub + Netlify). |
| **Data source** | WCA's data warehouse (`brandonwashington/data`), DCJS tables CUR-0010 and CUR-0011. |

## What it is

An interactive map of New York's 62 counties plus a short story of five charts on felony arrests of people under 18 and what happens to Adolescent Offender (AO) cases, built from DCJS data. It makes the points in WCA's October 2, 2026 email to the youth justice coalition: arrests are up since 2019, a steady share of AO cases stay in criminal court, that share depends on where the case is, sentences differ by race, and arrests by race.

## Files

| File | What it is |
|---|---|
| `README.md` | This file: what the dashboard is, what's in the folder, how to work on it, and the change log. |
| `update_data_here/` | The inputs, copied unchanged from the warehouse, plus the build script. Not pushed to git. |
| `update_data_here/build_data.py` | Turns the CSVs into `data/data.json` and copies the outlines to `data/Geography.json`. Run `python update_data_here/build_data.py` after any input changes. |
| `update_data_here/CHANGELOG.md` | Every change to the input files: what, when, by whom, from where. |
| `update_data_here/CUR-0010_ao-jo-case-outcomes_ny-counties.csv` | What happened to AO and JO arrests (DA declined, moved to Family Court, stayed in criminal court, outcomes, sentences), with shares. Every county, NYC, the rest of the state and the state, 2016–2025. Feeds the map and charts 2–4. |
| `update_data_here/CUR-0011_under-18-felony-arrests-by-race_ny-counties.csv` | Felony arrests of people under 18 by race, each group's share, and change since 2019. Same places, 2019–2025. Feeds the map and charts 1 and 5. |
| `update_data_here/STG-0016_county-boundaries_nys.geojson` | Outlines of New York's 62 counties (U.S. Census Bureau, 2025), with each county's 5-digit code and name. Holds no numbers. |
| `data/` | What the page reads. Written by the script; never edited by hand. Pushed to git. |
| `data/data.json` | The numbers for the headlines, map and charts. |
| `data/Geography.json` | The county outlines, an exact copy of `STG-0016` under the name the page expects. |
| `index.html` | The page: the words (titles, commentary, captions) and the empty boxes the charts draw into. Numbers inside sentences are filled from `data.json` by `charts.js`. |
| `styles.css` | All the styling: WCA colors and font (defined once, at the top), page basics, the map section. |
| `charts.js` | Draws everything: headline tiles, the map, the five charts. Part one is helpers (colors, number formatting, tooltip); part two is this page. Reads `data/data.json` and `data/Geography.json`. |
| `vendor/chart.umd.js` | Chart.js 4.4.4, the chart library (with its licence file). Kept in the folder so the page never calls out to another site. |
| `fonts/` | Lexend, WCA's font, served from the folder. |

Each CSV has a dataset doc in the warehouse (same name, `.md`) with column meanings and caveats. Read it before using the table.

**To look at the page:** it has to be opened through a web server (a browser won't load the data files straight from a folder). From the `youth_justice` folder run `python -m http.server 8000`, then open `http://localhost:8000/` in a browser. Or push to GitHub and use the Netlify preview.

## How to work on this dashboard

1. **Data.** Never edit a CSV by hand. To update one, re-copy the curated table from the warehouse into `update_data_here/`, run the script, then add an entry to `update_data_here/CHANGELOG.md`. Only reviewed, release-ready tables get published.
2. **Words.** Titles, commentary and captions are edited in `index.html`. Don't type numbers into sentences; use a `data-fill` span (see the examples there) so they come from `data.json`.
3. **Charts and style.** Chart changes go in `charts.js` (one function per chart). Styling goes in `styles.css`. *Full protocol to be written.*
4. **Publishing.** Changes go on a branch and through a pull request. Netlify builds a preview. Brandon reviews the changes and the preview, then merges. Nothing is pushed straight to main.
5. **Every change** gets a line in the change log below. Data changes also go in `update_data_here/CHANGELOG.md`.

## Before anything is published

- [ ] Brandon reviews CUR-0010 and CUR-0011 and fills in `reviewed_by` in their dataset docs.
- [ ] Check whether DCJS publishes a small-numbers rule. If not, hide counts under 5, with complementary suppression.
- [ ] Recalculate chart 2 without DA declines and show Brandon the new values.
- [ ] Clear open fact checks FC-0030 and FC-0031.

## Change log

Newest first.

| Date | Who | Change |
|---|---|---|
| 2026-10-14 | Claude (Cowork), for Brandon | First draft of the page (v1): `index.html`, `styles.css`, `charts.js`, plus `vendor/` (Chart.js) and `fonts/` (Lexend). All text is placeholder. `build_data.py` now marks change values with unit "change". |
| 2026-10-14 | Claude (Cowork), for Brandon | Reorganised: inputs and the script in `update_data_here/` (not pushed to git), outputs in `data/`. The script now also copies the outlines to `data/Geography.json`. |
| 2026-10-14 | Claude (Cowork), for Brandon | Added `build_data.py` (CSV → `data.json`) and the first `data.json`. The script's change-log step is muted until the log format is final. |
| 2026-10-14 | Claude (Cowork), for Brandon | Added the county outlines for the map (`data/STG-0016_county-boundaries_nys.geojson`, from the warehouse). |
| 2026-10-14 | Claude (Cowork), for Brandon | Created the folder. Copied CUR-0010 and CUR-0011 from the warehouse into `data/`. Drafted this README and `data/CHANGELOG.md`. |
