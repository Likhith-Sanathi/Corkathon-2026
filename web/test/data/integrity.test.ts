/**
 * Data integrity: the generated files in public/data are what the app and its scores rest on.
 * These checks catch a broken rebuild (bad projection, truncated download, schema drift) before deploy.
 */
import { describe, expect, it } from "vitest"
import { inPolygon } from "@/lib/geo"
import { GRID_FIELDS, GRID_NODATA, GRID_SPEC, type GridMeta } from "@/lib/grid"
import { parkPrice } from "@/lib/pricing"
import type {
  BusinessPark,
  FeatureCollection,
  FloodZone,
  Junction,
  Listing,
  Municipality,
  Place,
  PowerLine,
  SeismicEvent,
  Substation,
  TelecomSite,
  Tower,
  WaterFeature,
} from "@/lib/types"
import { inNlBbox, readGridBytes, readJson } from "../helpers/data"

const finite = (...v: number[]) => v.every(Number.isFinite)

describe.each([
  ["substations.json", 500],
  ["lines.json", 1000],
  ["towers.json", 5000],
  ["water.json", 10000],
  ["junctions.json", 1000],
  ["places.json", 3000],
  ["telecom.json", 200],
  ["seismic.json", 50],
])("%s", (file, minCount) => {
  const items = readJson<{ lat: number; lon: number }[]>(file)
  it(`has at least ${minCount} features`, () => {
    expect(items.length).toBeGreaterThanOrEqual(minCount)
  })
  it("has finite coordinates inside the Netherlands", () => {
    const bad = items.filter((p) => !finite(p.lat, p.lon) || !inNlBbox(p.lat, p.lon))
    expect(bad).toEqual([])
  })
})

describe("layer attributes", () => {
  it("substations and lines are ≥110 kV", () => {
    for (const s of readJson<Substation[]>("substations.json")) expect(s.kv).toBeGreaterThanOrEqual(110)
    for (const l of readJson<PowerLine[]>("lines.json")) expect(l.kv).toBeGreaterThanOrEqual(110)
  })
  it("towers, junctions and water have the expected shape", () => {
    expect(readJson<Tower[]>("towers.json")[0]).toEqual({ lat: expect.any(Number), lon: expect.any(Number) })
    for (const j of readJson<Junction[]>("junctions.json").slice(0, 50)) expect(typeof j.name).toBe("string")
    const types = new Set(readJson<WaterFeature[]>("water.json").map((w) => w.type))
    for (const t of types) expect(["river", "canal", "lake", "reservoir"]).toContain(t)
  })
  it("settlement weights match their type", () => {
    const W: Record<string, number> = { city: 1, town: 0.5, suburb: 0.3, village: 0.15, hamlet: 0.03 }
    for (const p of readJson<Place[]>("places.json")) expect(p.w).toBe(W[p.type])
  })
  it("telecom sites are data centres or exchanges", () => {
    for (const t of readJson<TelecomSite[]>("telecom.json")) expect(["data_center", "exchange"]).toContain(t.type)
  })
  it("earthquakes have plausible magnitudes and dates", () => {
    for (const q of readJson<SeismicEvent[]>("seismic.json")) {
      expect(q.mag).toBeGreaterThan(-2)
      expect(q.mag).toBeLessThan(7)
      expect(q.time).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

describe("polygons", () => {
  const closed = (ring: number[][]) => ring.length >= 4 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1]

  it("flood zones are closed polygons with a known basin and type", () => {
    const fc = readJson<FeatureCollection<FloodZone>>("flood.json")
    expect(fc.features.length).toBe(20)
    for (const f of fc.features) {
      expect(["Maas", "Rijn", "Schelde", "Eems"]).toContain(f.properties.basin)
      expect(closed(f.geometry.coordinates[0])).toBe(true)
    }
  })
  it("all 342 municipalities are present, named once, inside the Netherlands", () => {
    const fc = readJson<FeatureCollection<Municipality>>("municipalities.json")
    expect(fc.features.length).toBe(342)
    expect(new Set(fc.features.map((f) => f.properties.name)).size).toBe(342)
    for (const f of fc.features) for (const poly of f.geometry.coordinates) for (const [x, y] of poly[0]) expect(inNlBbox(y, x)).toBe(true)
  })
  it("business parks have non-negative areas, and usable prices once validated", () => {
    const fc = readJson<FeatureCollection<BusinessPark>>("ibis.json")
    expect(fc.features.length).toBeGreaterThan(3000)
    let priced = 0
    for (const { properties: p } of fc.features) {
      for (const v of [p.haGross, p.haNet, p.haAvailable]) if (v !== null) expect(v).toBeGreaterThanOrEqual(0)
      // Raw IBIS keeps a few known typos (e.g. totals typed as €/m²); the pricing model filters them.
      const price = parkPrice(p)
      if (!price) continue
      priced++
      expect(price.min).toBeLessThanOrEqual(price.max)
      expect(price.min).toBeGreaterThanOrEqual(5)
      expect(price.max).toBeLessThanOrEqual(1000)
    }
    expect(priced).toBeGreaterThan(800)
  })
})

describe("synthetic listings (plots.json)", () => {
  const fc = readJson<FeatureCollection<Listing>>("plots.json")
  const parkIds = new Set(readJson<FeatureCollection<BusinessPark>>("ibis.json").features.map((f) => f.properties.id))
  const L = fc.features.map((f) => f.properties)

  it("has thousands of listings with unique ids", () => {
    expect(L.length).toBeGreaterThan(3000)
    expect(new Set(L.map((p) => p.id)).size).toBe(L.length)
  })
  it("has valid enums, prices, areas and dates", () => {
    for (const p of L) {
      expect(["for_sale", "under_offer"]).toContain(p.status)
      expect(["municipality", "private"]).toContain(p.seller)
      expect(p.synthetic).toBe(true)
      expect(p.areaM2).toBeGreaterThanOrEqual(1500)
      expect(p.perM2).toBeGreaterThanOrEqual(5)
      expect(p.perM2).toBeLessThanOrEqual(1500)
      expect(Math.abs(p.total - p.perM2 * p.areaM2)).toBeLessThanOrEqual(500)
      expect(p.listedOn <= "2026-11-07" && p.listedOn >= "2025-11-01").toBe(true)
      expect(parkIds.has(p.parkId)).toBe(true)
    }
  })
  it("puts every label point inside its own parcel (holes excluded)", () => {
    const bad = fc.features.filter((f) => !f.geometry.coordinates.some((poly) => inPolygon(f.properties.lon, f.properties.lat, poly)))
    expect(bad.map((f) => f.properties.id)).toEqual([])
  })
})

describe("score grid (grid.json + grid.bin.gz)", () => {
  const meta = readJson<GridMeta>("grid.json")
  const bytes = readGridBytes()
  const n = meta.cols * meta.rows

  it("matches the grid spec", () => {
    expect(meta.west).toBe(GRID_SPEC.west)
    expect(meta.north).toBe(GRID_SPEC.north)
    expect(meta.dLon).toBe(GRID_SPEC.dLon)
    expect(meta.dLat).toBe(GRID_SPEC.dLat)
    expect(meta.fields).toEqual([...GRID_FIELDS])
  })
  it("decompresses to exactly one byte per cell per field", () => {
    expect(bytes.length).toBe(n * meta.fields.length)
  })
  it("marks the same cells as outside the country in every field", () => {
    let inside = 0
    let mismatched = 0
    for (let i = 0; i < n; i++) {
      const out = bytes[i] === GRID_NODATA
      if (!out) inside++
      for (let k = 1; k < meta.fields.length; k++) if ((bytes[k * n + i] === GRID_NODATA) !== out) mismatched++
    }
    expect(mismatched).toBe(0)
    expect(inside).toBe(meta.cellsInside)
    expect(inside).toBeGreaterThan(100_000)
  })
  it("never stores a risk multiplier of zero inside the country", () => {
    const risk = meta.fields.indexOf("risk") * n
    let zero = 0
    for (let i = 0; i < n; i++) if (bytes[i] !== GRID_NODATA && bytes[risk + i] === 0) zero++
    expect(zero).toBe(0)
  })
})
