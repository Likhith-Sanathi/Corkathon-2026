/**
 * Precompute the per-factor site scores on a ~1 km grid over the Netherlands.
 *
 * Usage (from web/): npm run build:grid   (after `python3 ../scripts/build_data.py`)
 * Output: public/data/grid.json (metadata) + public/data/grid.bin (packed scores)
 *
 * Only the factor scores and the risk multiplier are stored. The browser combines them
 * with the current weights, so the heatmap updates live without recomputing distances.
 */
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { inPolygon } from "../src/lib/geo"
import { GRID_FIELDS, GRID_NODATA, GRID_SPEC, type GridMeta } from "../src/lib/grid"
import { scoreAt } from "../src/lib/scoring"
import type { Dataset, Ring } from "../src/lib/types"

const DATA = path.join(import.meta.dirname, "..", "public", "data")
const load = (name: string) => JSON.parse(readFileSync(path.join(DATA, `${name}.json`), "utf-8"))

const names = ["substations", "lines", "towers", "water", "junctions", "places", "telecom", "seismic", "flood"] as const
const data = Object.fromEntries(names.map((n) => [n, load(n)])) as unknown as Dataset
const outline: Ring[][] = load("nl_outline").geometry.coordinates

const { west, east, south, north, dLon, dLat } = GRID_SPEC
const cols = Math.round((east - west) / dLon)
const rows = Math.round((north - south) / dLat)
const nf = GRID_FIELDS.length
const bytes = new Uint8Array(cols * rows * nf).fill(GRID_NODATA)
const enc = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 254)

const t0 = performance.now()
let inside = 0
for (let r = 0; r < rows; r++) {
  const lat = north - (r + 0.5) * dLat
  for (let c = 0; c < cols; c++) {
    const lon = west + (c + 0.5) * dLon
    if (!outline.some((poly) => inPolygon(lon, lat, poly))) continue
    const res = scoreAt(data, lat, lon)
    const byKey = Object.fromEntries(res.factors.map((f) => [f.key, f.score]))
    const o = (r * cols + c) * nf
    GRID_FIELDS.forEach((field, i) => {
      bytes[o + i] = enc(field === "risk" ? res.risk : byKey[field])
    })
    inside++
  }
  if (r % 50 === 0) console.log(`row ${r}/${rows}  (${inside} cells inside, ${((performance.now() - t0) / 1000).toFixed(1)} s)`)
}

const meta: GridMeta = {
  west,
  north,
  dLon,
  dLat,
  cols,
  rows,
  fields: GRID_FIELDS,
  cellsInside: inside,
  builtAt: new Date().toISOString(),
}
writeFileSync(path.join(DATA, "grid.bin"), bytes)
writeFileSync(path.join(DATA, "grid.json"), JSON.stringify(meta))
console.log(`done: ${cols}×${rows} grid, ${inside} cells inside NL, ${(bytes.length / 1e6).toFixed(2)} MB, ${((performance.now() - t0) / 1000).toFixed(1)} s`)
