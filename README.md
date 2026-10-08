# Buy Box Generator

Turn a market dataset (the analysts' `Cleaned_Data` sheet) into an interactive, self-contained buy-box web page.

**Flow:** upload workbook → fill in the overview and each buy box (regions are drawn on the map, amenities are picked from the analytics) → **Generate page** → download a single `.html` file that can be hosted anywhere. A generated page can be re-opened and edited (✎ Edit) and re-exported.

## What the page contains

- **Overview** – buy-box summary cards, market intro (what / why people visit / why STR works), revenue-distribution histogram with threshold, listing map (below-threshold bucket + revenue quartiles above it, basemap switcher), bed/sleep/bath distributions (all vs ≥ threshold) and revenue box plots per bed/sleep/bath count.
- **Per buy box** (paginated tabs)
  - Region (draw polygons on the map – all analytics use only listings inside) and bed/bath/sleep targets (exact, at least/most, between; each can optionally filter the analytics).
  - **Must-haves** – amenity-penetration chart with revenue and % cutoffs; image slots per must-have.
  - **Nice-to-haves** – top-X% vs bottom-X% prevalence; isolated revenue effect (OLS on log1p(revenue) ~ amenities + bedrooms [+ ZIP when it varies], must-haves excluded); **VIF collinearity report** (iteratively drops the most-inflated amenity until all VIF ≤ limit) with VIF bar chart + correlation heatmap; ranking by uplift with a minimum-sample rule (default 8 listings with *and* without).
  - All remaining BuyBox-template fields as text / image inputs: STR regulations, property profile, locations, traveler ICP, design & revenue comp sets, analyst notes, projections and underwriting examples.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # stats engine vs statsmodels/pandas goldens
npm run build    # → dist/index.html (single file)
```

`scripts/make_fixture.py` regenerates `tests/fixtures/golden.json` (needs pandas + statsmodels).

## Data & privacy

Generated pages embed the listing data (titles, URLs, coordinates, revenue) and any images you add. Host them privately if the data is confidential. Map tiles are loaded from CARTO / Esri, so viewers need internet access.

## Deploy

`.github/workflows/pages.yml` builds and publishes `dist/` to GitHub Pages. In the repo: **Settings → Pages → Source: GitHub Actions**.
