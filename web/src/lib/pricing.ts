/**
 * Simulated land prices for the demo. There is no open per-parcel price data in the Netherlands,
 * so prices are synthesised from real anchors:
 *
 *  - industrial land: the business park's own IBIS 2019 price where it has one, otherwise an
 *    inverse-distance-weighted average of nearby parks' prices (captures regional differences),
 *    indexed to today, with a size discount and a small stable per-parcel variation;
 *  - land outside business parks: an average farmland price scaled by how expensive the region is.
 *
 * The same function prices the synthetic listings (scripts/build-plots.ts) and any parcel a user pins.
 */
import { haversineKm } from "./geo"
import type { BusinessParkProps, Dataset } from "./types"

export const PRICE_MODEL = {
  /** IBIS prices are from 2019; assume ~4%/yr growth in industrial land prices to 2026. */
  indexSince2019: 1.32,
  /** Average Dutch farmland, € per m² (≈ €75k per hectare). */
  farmlandPerM2: 7.5,
  /** Nearby priced parks used for the regional average. */
  neighbours: 8,
  maxKm: 40,
  /** ± spread shown as the price range. */
  rangePct: 0.12,
}

export type PriceEstimate = {
  perM2: number
  low: number // € per m²
  high: number
  total: number | null // € for the whole parcel
  zoning: "industrial" | "agricultural"
  basis: string[]
}

/** A park's IBIS price range with implausible entries (data-entry errors, e.g. totals typed as €/m²) dropped. */
export function parkPrice(p: BusinessParkProps): { min: number; max: number } | null {
  const ok = [p.priceMin, p.priceMax].filter((v): v is number => v !== null && v >= 5 && v <= 1000)
  return ok.length ? { min: Math.min(...ok), max: Math.max(...ok) } : null
}

type PricedPark = { lat: number; lon: number; mid: number; name: string }
const pricedCache = new WeakMap<object, { parks: PricedPark[]; median: number }>()

/** Business parks with an IBIS price, as points with their mid price (cached per dataset). */
function pricedParks(data: Dataset) {
  const key = data.ibis ?? data
  let hit = pricedCache.get(key)
  if (!hit) {
    const parks: PricedPark[] = []
    for (const f of data.ibis?.features ?? []) {
      const price = parkPrice(f.properties)
      if (!price) continue
      const ring = f.geometry.coordinates[0][0]
      parks.push({
        lat: ring.reduce((a, q) => a + q[1], 0) / ring.length,
        lon: ring.reduce((a, q) => a + q[0], 0) / ring.length,
        mid: (price.min + price.max) / 2,
        name: f.properties.name,
      })
    }
    const sorted = parks.map((p) => p.mid).sort((a, b) => a - b)
    hit = { parks, median: sorted[Math.floor(sorted.length / 2)] ?? 100 }
    pricedCache.set(key, hit)
  }
  return hit
}

/** Inverse-distance-weighted 2019 industrial price around a point, from the nearest priced parks. */
function regionalPrice(data: Dataset, lat: number, lon: number) {
  const { parks, median } = pricedParks(data)
  const near = parks
    .map((p) => ({ p, km: haversineKm(lat, lon, p.lat, p.lon) }))
    .filter((x) => x.km <= PRICE_MODEL.maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, PRICE_MODEL.neighbours)
  if (!near.length) return { price: median, count: 0, median }
  let wsum = 0
  let acc = 0
  for (const { p, km } of near) {
    const w = 1 / Math.max(0.5, km) ** 2
    wsum += w
    acc += w * p.mid
  }
  return { price: acc / wsum, count: near.length, median }
}

/** Stable pseudo-random number in [0, 1) from a string, so a parcel always gets the same price. */
export function seeded(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return ((h >>> 0) % 100000) / 100000
}

const round = (v: number, step: number) => Math.max(step, Math.round(v / step) * step)
const eur = (v: number) => `€${Math.round(v).toLocaleString("en-GB")}`

export function estimatePrice(
  data: Dataset,
  lat: number,
  lon: number,
  opts: { areaM2: number | null; seed: string; park: BusinessParkProps | null },
): PriceEstimate {
  const { areaM2, seed, park } = opts
  const noise = 1 + (seeded(seed) - 0.5) * 0.14 // ±7%
  const basis: string[] = []
  let perM2: number
  let zoning: PriceEstimate["zoning"]

  if (park) {
    zoning = "industrial"
    let base: number
    const own = parkPrice(park)
    if (own) {
      base = (own.min + own.max) / 2
      basis.push(`${park.name} listed ${own.min === own.max ? eur(own.min) : `${eur(own.min)}–${eur(own.max)}`}/m² in IBIS 2019`)
    } else {
      const r = regionalPrice(data, lat, lon)
      base = r.price
      basis.push(`${park.name} has no listed price; average of ${r.count} nearby parks: ${eur(base)}/m² (2019)`)
    }
    const ha = (areaM2 ?? 10_000) / 10_000
    const size = Math.min(1.12, Math.max(0.85, ha ** -0.06))
    perM2 = base * PRICE_MODEL.indexSince2019 * size * noise
    basis.push(`Indexed ×${PRICE_MODEL.indexSince2019} to 2026, ×${size.toFixed(2)} for plot size`)
    perM2 = round(perM2, 5)
  } else {
    zoning = "agricultural"
    const r = regionalPrice(data, lat, lon)
    const regional = Math.min(1.5, Math.max(0.7, Math.sqrt(r.price / r.median)))
    perM2 = round(PRICE_MODEL.farmlandPerM2 * regional * noise, 0.5)
    basis.push(`Outside business parks, so priced as farmland (≈${eur(PRICE_MODEL.farmlandPerM2 * 10_000)}/ha nationally)`)
    basis.push(`×${regional.toFixed(2)} for regional price level (from ${r.count} nearby business parks)`)
    basis.push("Rezoning for industry would raise the value substantially")
  }

  const spread = PRICE_MODEL.rangePct
  return {
    perM2,
    low: round(perM2 * (1 - spread), zoning === "industrial" ? 5 : 0.5),
    high: round(perM2 * (1 + spread), zoning === "industrial" ? 5 : 0.5),
    total: areaM2 ? Math.round((perM2 * areaM2) / 1000) * 1000 : null,
    zoning,
    basis,
  }
}
