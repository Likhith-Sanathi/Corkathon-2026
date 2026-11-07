import type { FactorKey } from "./types"

/**
 * Precomputed score grid (web/public/data/grid.json + grid.bin), built by scripts/build-grid.ts.
 *
 * grid.bin holds `cols × rows` cells, row 0 at the north edge, each cell GRID_FIELDS.length bytes.
 * A byte b in 0..254 encodes the value b / 254 (0..1); 255 marks a cell outside the Netherlands.
 */
export const GRID_FIELDS = ["power", "isolation", "telecom", "water", "roads", "risk"] as const satisfies readonly (
  | FactorKey
  | "risk"
)[]
export const GRID_NODATA = 255

export type GridMeta = {
  west: number
  north: number
  dLon: number
  dLat: number
  cols: number
  rows: number
  fields: readonly string[]
  cellsInside: number
  builtAt: string
}

export const GRID_SPEC = { west: 3.3, east: 7.3, south: 50.7, north: 53.6, dLon: 0.015, dLat: 0.01 }
