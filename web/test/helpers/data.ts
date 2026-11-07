import { readFileSync } from "node:fs"
import path from "node:path"
import { gunzipSync } from "node:zlib"
import { loadDataset } from "@/lib/server-data"
import type { Dataset } from "@/lib/types"

export const DATA_DIR = path.join(process.cwd(), "public", "data")
export const readJson = <T = unknown>(name: string): T => JSON.parse(readFileSync(path.join(DATA_DIR, name), "utf-8")) as T
export const readGridBytes = () => new Uint8Array(gunzipSync(readFileSync(path.join(DATA_DIR, "grid.bin.gz"))))

/** The same in-memory dataset the API routes use. */
export const dataset = (): Promise<Dataset> => loadDataset()

/** Generous bounding box around the Netherlands (all built layers are clipped to the national outline). */
export const NL_BBOX = { south: 50.6, north: 53.8, west: 3.2, east: 7.3 }
export const inNlBbox = (lat: number, lon: number) =>
  lat >= NL_BBOX.south && lat <= NL_BBOX.north && lon >= NL_BBOX.west && lon <= NL_BBOX.east

/** Reference points used across tests. */
export const PLACES = {
  sciencePark: { lat: 52.3545, lon: 4.956 }, // Amsterdam data-centre cluster
  eemshaven: { lat: 53.438, lon: 6.834 },
  groningenGasField: { lat: 53.29, lon: 6.77 },
  veluwe: { lat: 52.13, lon: 5.85 },
  northSea: { lat: 53.0, lon: 3.6 },
  essen: { lat: 51.455, lon: 7.011 }, // Germany
} as const
