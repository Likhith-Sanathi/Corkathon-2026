# Data centre site scorer (web)

Next.js app: drop a pin anywhere in the Netherlands and it scores the spot as a data centre site, with the evidence behind every number.

## Run it

```bash
# from the repo root: build the map layers from the CSVs (only needed when the CSVs change)
python3 scripts/build_data.py

# then the app
cd web
npm install
npm run dev        # http://localhost:3000
```

`scripts/build_data.py` reads `power.csv`, `water.csv`, `roads.csv`, `isolation.csv`, `telecom.csv`, `seismic.csv` and `flood.csv` from the repo root and writes compact JSON layers to `web/public/data/`. It also downloads the municipality boundaries from PDOK once (cached in `scripts/.cache/`), which the app uses to check that a pin is inside the Netherlands.

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
