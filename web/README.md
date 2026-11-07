# Data centre site scorer (web)

Next.js app: drop a pin anywhere in the Netherlands and it scores the spot as a data centre site, with the evidence behind every number.

## Run it

```bash
# from the repo root: build the map layers from the CSVs (only needed when the CSVs change)
python3 scripts/build_data.py

# then the app
cd web
npm install
npm run build:grid # precompute the score heatmap (after build_data.py, ~1 min)
npm run dev        # http://localhost:3000
```

The **site score heatmap** comes from `scripts/build-grid.ts`. It scores every ~500 m cell in the Netherlands (about 146k cells) with the same `scoreAt` function the API uses, and stores the five factor scores and the risk multiplier per cell (`public/data/grid.bin.gz`, ~0.5 MB gzipped). The browser decompresses it, combines it with the current weights and repaints a canvas overlay, interpolating smoothly between cells, on the next frame after each slider move (about 30 ms). Colours stretch over the 2nd–98th percentile of the current scores; the legend shows the actual range.

`scripts/build_data.py` reads `power.csv`, `water.csv`, `roads.csv`, `isolation.csv`, `telecom.csv`, `seismic.csv` and `flood.csv` from the repo root and writes compact JSON layers to `web/public/data/`. It also downloads the municipality boundaries from PDOK once (cached in `scripts/.cache/`), which the app uses to check that a pin is inside the Netherlands.

## Plots

Dropping a pin also returns the **plot** (`plot` in the `/api/score` response):

- **Cadastral parcel:** looked up live from Kadaster's open parcel map on PDOK (`api.pdok.nl/kadaster/brk-kadastrale-kaart`, free, no key): parcel ID and area, outlined on the map. Ownership and sale prices are not open data.
- **Business park:** from IBIS (Interprovinciaal Overleg, CC0), built into `public/data/ibis.json` by `scripts/build_data.py`: available hectares, land price range (€/m²) and maximum environmental category. When the pin is not inside a park, the nearest park within 15 km is returned. The national IBIS file is the **2019** edition.

The map has a **Business parks** layer (pink where land is still available) and a **Cadastral parcels** overlay (PDOK WMS, from zoom 15).

## Plots for sale (synthetic demo data)

There is no open data on which Dutch plots are for sale or what they cost, so for the demo `npm run build:plots` (`scripts/build-plots.ts`, ~30 s first run, then cached) generates **5,686 synthetic listings**:

- Only business parks that IBIS reports as having land available get listings, up to roughly that park's available hectares.
- Every listing is a real Kadaster parcel inside the park (fetched from PDOK and cached in `scripts/.cache/parcels/`).
- Asking prices come from `src/lib/pricing.ts`: the park's own IBIS 2019 price (implausible entries dropped), or an inverse-distance-weighted average of nearby parks, indexed ×1.32 to 2026, with a plot-size discount and a stable ±7% per-parcel variation.
- Status (for sale or under offer), seller and listing date are seeded from the parcel ID, so rebuilds give the same listings.

Any other parcel you pin gets an **estimated land value** from the same model: industrial pricing inside business parks, farmland pricing (≈€75k/ha, scaled by regional price level) outside them. Everything simulated is marked **Simulated** in the panel.

## Testing

```bash
npm test               # unit, API and data-integrity tests (Vitest, ~1 s)
npm run test:coverage  # same, with coverage thresholds on the scoring/pricing/geometry core
npm run build && npm run test:e2e   # end-to-end tests against the production build (Playwright)
```

- `test/unit/`: geometry, scoring model, pricing model, plot and park lookups, score grid.
- `test/api/`: every route handler called directly, with Nominatim, PDOK and OpenRouter mocked (no network): success paths, validation (400), outside-the-Netherlands (422), degraded upstreams (502, parcel service down), "did you mean" suggestions, and the chat's tool calls.
- `test/data/`: integrity of every generated file in `public/data` (schemas, value ranges, coordinates inside the Netherlands, grid size and no-data consistency, every listing's label point inside its own parcel).
- `e2e/`: landing page, map and heatmap, dropping a pin, outside-NL rejection, live reweighting, themes, panel toggles, featured listings and the plot search, at desktop and laptop widths.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests on Node 20/22/24 (coverage on 22), the end-to-end suite, a production build, a Python compile check of the data script and a production dependency audit, plus a nightly run. The **CI passed** job is the single check to require in branch protection.

## How it works

- `POST /api/score` with `{ lat, lon, weights? }` returns the score, every sub-score, and the evidence. Points outside the Netherlands get a `422`.
- The scoring lives in `src/lib/scoring.ts`, one function per factor. All tunables (decay distances, weights, flood and seismic settings) are in `PARAMS` and `DEFAULT_WEIGHTS` at the top of the file.
- The map (`src/components/site-map.tsx`) is Leaflet on the PDOK BRT basemap. Large point layers draw to a canvas, so tens of thousands of points stay fast.

## Scoring

`score = 100 × suitability × risk`

| Factor | Default weight | Measured as |
|---|---|---|
| Power grid | 35% | Nearest ≥110 kV substation (λ = 3 km) and nearest ≥110 kV line or pylon (λ = 2 km), 380 kV ×1.2 |
| Isolation | 20% | 1 / (1 + Σ wᵢ·e^(−d/2 km)) over settlements within 15 km (city 1, town 0.5, suburb 0.3, village 0.15, hamlet 0.03) |
| Telecom | 20% | Nearest data centre or exchange (λ = 10 km), plus up to 0.2 for data centres within 25 km |
| Water | 15% | Nearest river, canal, lake or reservoir (λ = 3 km) |
| Road access | 10% | Nearest motorway junction (λ = 5 km) |

Distance factors use `e^(−d/λ)`. Risk multiplies the result:

- **Flood:** ×0.2 unprotected zone (type D), ×0.7 protected zone (type B), ×0.5 other zone types, ×1 outside all zones.
- **Seismic:** `1 / (1 + Σ 10^(M−4.5)·e^(−d/10 km))` over events within 25 km. An M4.5 at the site halves the score; small induced quakes barely count.

## Known data limits

- Only Dutch features are kept: the build drops anything outside PDOK's national outline (`Landgebied`), including offshore substations and German and Belgian earthquakes. Sites near the border are therefore scored without nearby foreign infrastructure or quakes.
- `flood.csv` holds 20 identical 2 km circles, not the real flood risk map, so the flood factor almost never triggers. Replace it with the full PDOK flood risk zones before relying on it.
- Lines, rivers and roads are stored as one point per OSM way (the average of its vertices), so distances to long features are approximate.
- Isolation uses OSM place points, not population counts.
- Business park data (IBIS) is from 2019; availability and prices will have changed. Whether a specific parcel is for sale is not in any open dataset.
