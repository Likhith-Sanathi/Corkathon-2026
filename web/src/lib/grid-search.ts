import "server-only"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { gunzipSync } from "node:zlib"
import { haversineKm } from "./geo"
import { GRID_NODATA, type GridMeta } from "./grid"
import { normaliseWeights } from "./scoring"
import type { Weights } from "./types"

const DATA_DIR = path.join(process.cwd(), "public", "data")

type Grid = { meta: GridMeta; bytes: Uint8Array }
let gridPromise: Promise<Grid> | null = null

function loadGrid(): Promise<Grid> {
  gridPromise ??= Promise.all([
    readFile(path.join(DATA_DIR, "grid.json"), "utf-8").then((s) => JSON.parse(s) as GridMeta),
    readFile(path.join(DATA_DIR, "grid.bin.gz")).then((buf) => gunzipSync(buf)),
  ]).then(([meta, buf]) => ({ meta, bytes: new Uint8Array(buf) }))
  return gridPromise
}

export type GridCandidate = { lat: number; lon: number; score: number; distanceKm: number }

/**
 * Scans the precomputed score grid (same bytes the heatmap uses) for the highest-scoring
 * cells within radiusKm of a point, combined with the given weights. This is a coarse,
 * fast pre-filter (~1km resolution, byte-quantised) — callers should re-score the winners
 * exactly with `scoreLocation` for display, since this only narrows down where to look.
 */
export async function topGridCandidates(
  center: { lat: number; lon: number },
  weights: Weights,
  opts: { radiusKm?: number; count?: number; minSeparationKm?: number } = {},
): Promise<GridCandidate[]> {
  const { radiusKm = 20, count = 10, minSeparationKm = 1.5 } = opts
  const { meta, bytes } = await loadGrid()
  const { west, north, dLon, dLat, cols, rows, fields } = meta
  const n = cols * rows
  const w = normaliseWeights(weights)
  // Planar layout: field k occupies bytes [k*n, (k+1)*n), one plane per field.
  const terms = fields.flatMap((f, k) => (f in w ? [[k * n, w[f as keyof Weights]] as const] : []))
  const riskOff = fields.indexOf("risk") * n

  const dLatRadius = radiusKm / 111.32
  const dLonRadius = radiusKm / (111.32 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.1))
  const rowCenter = (north - center.lat) / dLat - 0.5
  const colCenter = (center.lon - west) / dLon - 0.5
  const rowSpan = Math.ceil(dLatRadius / dLat)
  const colSpan = Math.ceil(dLonRadius / dLon)

  const rowLo = Math.max(0, Math.floor(rowCenter - rowSpan))
  const rowHi = Math.min(rows - 1, Math.ceil(rowCenter + rowSpan))
  const colLo = Math.max(0, Math.floor(colCenter - colSpan))
  const colHi = Math.min(cols - 1, Math.ceil(colCenter + colSpan))

  const all: GridCandidate[] = []
  for (let r = rowLo; r <= rowHi; r++) {
    const lat = north - (r + 0.5) * dLat
    for (let c = colLo; c <= colHi; c++) {
      const i = r * cols + c
      if (bytes[i] === GRID_NODATA) continue
      const lon = west + (c + 0.5) * dLon
      const distanceKm = haversineKm(center.lat, center.lon, lat, lon)
      if (distanceKm > radiusKm) continue
      let s = 0
      for (const [off, wk] of terms) s += wk * bytes[off + i]
      const score = (100 * s * bytes[riskOff + i]) / (254 * 254)
      all.push({ lat, lon, score, distanceKm })
    }
  }

  all.sort((a, b) => b.score - a.score)

  // Greedily keep the best cells, skipping ones too close to an already-picked site so
  // the top 10 are distinct candidate locations rather than ten adjacent pixels.
  const picked: GridCandidate[] = []
  for (const cand of all) {
    if (picked.length >= count) break
    if (picked.every((p) => haversineKm(p.lat, p.lon, cand.lat, cand.lon) >= minSeparationKm)) {
      picked.push(cand)
    }
  }
  return picked
}

/**
 * A fast scorer for arbitrary points: the precomputed grid cell's score under the given weights
 * (null outside the Netherlands). Used to pre-rank many candidates before exact scoring.
 */
export async function gridScorer(weights: Weights): Promise<(lat: number, lon: number) => number | null> {
  const { meta, bytes } = await loadGrid()
  const { west, north, dLon, dLat, cols, rows, fields } = meta
  const n = cols * rows
  const w = normaliseWeights(weights)
  const terms = fields.flatMap((f, k) => (f in w ? [[k * n, w[f as keyof Weights]] as const] : []))
  const riskOff = fields.indexOf("risk") * n
  return (lat, lon) => {
    const r = Math.floor((north - lat) / dLat)
    const c = Math.floor((lon - west) / dLon)
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null
    const i = r * cols + c
    if (bytes[i] === GRID_NODATA) return null
    let sum = 0
    for (const [off, wk] of terms) sum += wk * bytes[off + i]
    return (100 * sum * bytes[riskOff + i]) / (254 * 254)
  }
}
