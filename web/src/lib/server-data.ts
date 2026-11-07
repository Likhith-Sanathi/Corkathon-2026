import "server-only"
import { readFile } from "node:fs/promises"
import path from "node:path"
import type { Dataset } from "./types"

const DATA_DIR = path.join(process.cwd(), "public", "data")
const FILES = [
  "substations",
  "lines",
  "towers",
  "water",
  "junctions",
  "places",
  "telecom",
  "seismic",
  "flood",
  "municipalities",
  "ibis",
  "plots",
] as const
/** Built by a separate script (npm run build:plots); the app still works without it. */
const OPTIONAL = new Set<string>(["plots"])

let cache: Promise<Dataset> | null = null

/** Load every layer once per server process and keep it in memory. */
export function loadDataset(): Promise<Dataset> {
  cache ??= Promise.all(
    FILES.map(async (name) => {
      try {
        return [name, JSON.parse(await readFile(path.join(DATA_DIR, `${name}.json`), "utf-8"))] as const
      } catch (e) {
        if (OPTIONAL.has(name)) return [name, { type: "FeatureCollection", features: [] }] as const
        throw e
      }
    }),
  ).then((entries) => Object.fromEntries(entries) as Dataset)
  return cache
}
