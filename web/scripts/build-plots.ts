/**
 * Build SYNTHETIC "plots for sale" for the hackathon demo (public/data/plots.json).
 *
 * There is no open data on which Dutch plots are for sale, so this script fakes it plausibly:
 *  - only business parks that IBIS reports as having land available get listings,
 *    up to roughly that park's available hectares;
 *  - every listing is a real Kadaster parcel inside the park (fetched from PDOK, no key);
 *  - prices come from the shared model in src/lib/pricing.ts (anchored on IBIS prices);
 *  - status, seller and listing date are seeded from the parcel ID, so rebuilds are stable.
 *
 * Usage (from web/): npm run build:plots   (after `python3 ../scripts/build_data.py`, ~2–4 min first run)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { inPolygon } from "../src/lib/geo"
import { estimatePrice, seeded } from "../src/lib/pricing"
import type { BusinessPark, Dataset, Listing, Ring } from "../src/lib/types"

const DATA = path.join(import.meta.dirname, "..", "public", "data")
const CACHE = path.join(import.meta.dirname, "..", "..", "scripts", ".cache", "parcels")
mkdirSync(CACHE, { recursive: true })

const ibis = JSON.parse(readFileSync(path.join(DATA, "ibis.json"), "utf-8")) as Dataset["ibis"]
const data = { ibis } as Dataset
const parks = ibis!.features.filter((f) => (f.properties.haAvailable ?? 0) > 0)

const API = "https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/collections/perceel/items"
const MAX_PAGES = 4
const MAX_LISTINGS_PER_PARK = 25
const TODAY = new Date("2026-11-07T00:00:00Z")

type PdokParcel = {
  properties: { kadastrale_gemeente_waarde: string; sectie: string; perceelnummer: number; kadastrale_grootte_waarde: number }
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Ring[] | Ring[][] }
}

function bboxOf(park: BusinessPark) {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const poly of park.geometry.coordinates)
    for (const [x, y] of poly[0]) {
      w = Math.min(w, x)
      s = Math.min(s, y)
      e = Math.max(e, x)
      n = Math.max(n, y)
    }
  return [w, s, e, n]
}

async function parcelsFor(park: BusinessPark): Promise<PdokParcel[]> {
  const file = path.join(CACHE, `${park.properties.id}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf-8"))
  const out: PdokParcel[] = []
  let url: string | undefined = `${API}?f=json&limit=1000&bbox=${bboxOf(park).join(",")}`
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res: Response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`PDOK ${res.status}`)
    const body = (await res.json()) as { features: PdokParcel[]; links?: { rel: string; href: string }[] }
    out.push(...body.features)
    url = body.links?.find((l) => l.rel === "next")?.href
  }
  writeFileSync(file, JSON.stringify(out))
  return out
}

/**
 * A point guaranteed to lie inside a polygon (outer ring minus holes): its centroid if that qualifies,
 * otherwise the middle of the widest inside span along one of several horizontal scan lines.
 * (Using only the outer ring put ~2% of labels inside a hole, i.e. on the neighbouring enclave parcel.)
 */
function labelPoint(rings: Ring[]): [number, number] {
  const outer = rings[0]
  const cx = outer.reduce((a, p) => a + p[0], 0) / outer.length
  const cy = outer.reduce((a, p) => a + p[1], 0) / outer.length
  if (inPolygon(cx, cy, rings)) return [cx, cy]
  const ys = outer.map((p) => p[1])
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)]
  let best: [number, number] = [cx, cy]
  let width = -1
  for (let k = 1; k <= 15; k++) {
    const y = minY + ((maxY - minY) * k) / 16
    const xs: number[] = []
    for (const ring of rings)
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i]
        const [x2, y2] = ring[i + 1]
        if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1))
      }
    xs.sort((a, b) => a - b)
    for (let i = 0; i + 1 < xs.length; i += 2)
      if (xs[i + 1] - xs[i] > width && inPolygon((xs[i] + xs[i + 1]) / 2, y, rings)) {
        width = xs[i + 1] - xs[i]
        best = [(xs[i] + xs[i + 1]) / 2, y]
      }
  }
  return best
}

/**
 * The original outer-ring-only label, kept solely for choosing which parcels become listings, so the
 * synthetic listing set stays stable. Use labelPoint() for anything shown or clicked.
 */
function selectionPoint(outer: Ring): [number, number] {
  const cx = outer.reduce((a, p) => a + p[0], 0) / outer.length
  const cy = outer.reduce((a, p) => a + p[1], 0) / outer.length
  if (inPolygon(cx, cy, [outer])) return [cx, cy]
  const xs: number[] = []
  for (let i = 0; i < outer.length - 1; i++) {
    const [x1, y1] = outer[i]
    const [x2, y2] = outer[i + 1]
    if (y1 > cy !== y2 > cy) xs.push(x1 + ((cy - y1) * (x2 - x1)) / (y2 - y1))
  }
  xs.sort((a, b) => a - b)
  let best: [number, number] = [cx, cy]
  let width = -1
  for (let i = 0; i + 1 < xs.length; i += 2)
    if (xs[i + 1] - xs[i] > width) {
      width = xs[i + 1] - xs[i]
      best = [(xs[i] + xs[i + 1]) / 2, cy]
    }
  return best
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6

async function listingsFor(park: BusinessPark): Promise<Listing[]> {
  const p = park.properties
  const target = (p.haAvailable ?? 0) * 10_000
  const maxArea = Math.max(target * 1.5, 10_000)
  const candidates = (await parcelsFor(park))
    .map((f) => {
      const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][]
      const largest = polys.reduce((a, b) => (b[0].length > a[0].length ? b : a))
      const [selLon, selLat] = selectionPoint(largest[0])
      const q = f.properties
      return {
        polys,
        largest,
        selLat,
        selLon,
        area: q.kadastrale_grootte_waarde,
        id: `${q.kadastrale_gemeente_waarde} ${q.sectie} ${q.perceelnummer}`,
      }
    })
    .filter((c) => c.area >= 1500 && c.area <= maxArea)
    .filter((c) => park.geometry.coordinates.some((poly) => inPolygon(c.selLon, c.selLat, poly)))
    .sort((a, b) => seeded(`${p.id}:${a.id}`) - seeded(`${p.id}:${b.id}`)) // stable shuffle

  const out: Listing[] = []
  let total = 0
  for (const c of candidates) {
    if (total >= target * 0.9 || out.length >= MAX_LISTINGS_PER_PARK) break
    total += c.area
    const price = estimatePrice(data, c.selLat, c.selLon, { areaM2: c.area, seed: c.id, park: p })
    const [lon, lat] = labelPoint(c.largest) // inside the parcel, holes excluded
    const daysAgo = 3 + Math.floor(seeded(`${c.id}:date`) * 260)
    out.push({
      type: "Feature",
      properties: {
        id: c.id,
        parkId: p.id,
        parkName: p.name,
        municipality: p.municipality,
        areaM2: c.area,
        status: seeded(`${c.id}:status`) < 0.78 ? "for_sale" : "under_offer",
        seller: seeded(`${c.id}:seller`) < 0.65 ? "municipality" : "private",
        listedOn: new Date(TODAY.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10),
        perM2: price.perM2,
        total: price.total ?? 0,
        lat: r6(lat),
        lon: r6(lon),
        synthetic: true,
      },
      geometry: { type: "MultiPolygon", coordinates: c.polys.map((poly) => poly.map((ring) => ring.map(([x, y]) => [r6(x), r6(y)]))) },
    })
  }
  return out
}

async function main() {
  const t0 = performance.now()
  const results: Listing[][] = []
  let done = 0
  let failed = 0
  const queue = [...parks]
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const park = queue.shift()!
        try {
          results.push(await listingsFor(park))
        } catch (e) {
          failed++
          console.warn(`skip ${park.properties.name}: ${(e as Error).message}`)
        }
        if (++done % 100 === 0) console.log(`${done}/${parks.length} parks (${((performance.now() - t0) / 1000).toFixed(0)} s)`)
      }
    }),
  )

  const features = results.flat().sort((a, b) => a.properties.id.localeCompare(b.properties.id))
  writeFileSync(path.join(DATA, "plots.json"), JSON.stringify({ type: "FeatureCollection", synthetic: true, features }))
  const ha = features.reduce((a, f) => a + f.properties.areaM2, 0) / 10_000
  console.log(
    `done: ${features.length} synthetic listings (${ha.toFixed(0)} ha) in ${results.filter((r) => r.length).length} parks, ${failed} parks failed, ${((performance.now() - t0) / 1000).toFixed(0)} s`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
