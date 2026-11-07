import { beforeAll, describe, expect, it } from "vitest"
import { estimatePrice, parkPrice, PRICE_MODEL, seeded } from "@/lib/pricing"
import type { BusinessParkProps, Dataset } from "@/lib/types"
import { dataset, PLACES } from "../helpers/data"

let data: Dataset
beforeAll(async () => {
  data = await dataset()
})

const park = (over: Partial<BusinessParkProps> = {}): BusinessParkProps => ({
  id: "t",
  name: "Test Park",
  place: "Test",
  municipality: "Test",
  year: 2019,
  haGross: 10,
  haNet: 8,
  haAvailable: 2,
  priceMin: 100,
  priceMax: 150,
  maxEnvCategory: "4",
  ...over,
})

describe("parkPrice", () => {
  it("returns the listed range", () => {
    expect(parkPrice(park())).toEqual({ min: 100, max: 150 })
  })
  it("drops implausible entries (data-entry errors)", () => {
    expect(parkPrice(park({ priceMin: 3557682, priceMax: 145 }))).toEqual({ min: 145, max: 145 })
    expect(parkPrice(park({ priceMin: 2, priceMax: 4 }))).toBeNull()
    expect(parkPrice(park({ priceMin: null, priceMax: null }))).toBeNull()
  })
})

describe("seeded", () => {
  it("is deterministic and in [0, 1)", () => {
    for (const k of ["a", "Amsterdam AI 1029", "x".repeat(200), ""]) {
      expect(seeded(k)).toBe(seeded(k))
      expect(seeded(k)).toBeGreaterThanOrEqual(0)
      expect(seeded(k)).toBeLessThan(1)
    }
  })
  it("spreads different keys", () => {
    const vals = new Set(Array.from({ length: 200 }, (_, i) => seeded(`parcel ${i}`).toFixed(3)))
    expect(vals.size).toBeGreaterThan(150)
  })
})

describe("estimatePrice", () => {
  const { lat, lon } = PLACES.sciencePark

  it("prices industrial land from the park's own IBIS price, indexed and varied", () => {
    const e = estimatePrice(data, lat, lon, { areaM2: 10_000, seed: "p1", park: park() })
    expect(e.zoning).toBe("industrial")
    const base = 125 * PRICE_MODEL.indexSince2019
    expect(e.perM2).toBeGreaterThan(base * 0.85 * 0.93 - 5)
    expect(e.perM2).toBeLessThan(base * 1.12 * 1.07 + 5)
    expect(e.perM2 % 5).toBe(0)
    expect(e.basis.join(" ")).toContain("Test Park")
  })

  it("is deterministic for the same parcel", () => {
    const opts = { areaM2: 25_000, seed: "Amsterdam AI 1029", park: park() }
    expect(estimatePrice(data, lat, lon, opts)).toEqual(estimatePrice(data, lat, lon, opts))
  })

  it("keeps the range around the estimate and the total consistent", () => {
    const e = estimatePrice(data, lat, lon, { areaM2: 18_700, seed: "p2", park: park() })
    expect(e.low).toBeLessThanOrEqual(e.perM2)
    expect(e.high).toBeGreaterThanOrEqual(e.perM2)
    expect(Math.abs(e.total! - e.perM2 * 18_700)).toBeLessThanOrEqual(500)
  })

  it("gives bigger plots a lower or equal price per m²", () => {
    const small = estimatePrice(data, lat, lon, { areaM2: 2_000, seed: "same", park: park() })
    const big = estimatePrice(data, lat, lon, { areaM2: 200_000, seed: "same", park: park() })
    expect(big.perM2).toBeLessThanOrEqual(small.perM2)
  })

  it("falls back to nearby parks when the park has no usable price", () => {
    const e = estimatePrice(data, lat, lon, { areaM2: 10_000, seed: "p3", park: park({ priceMin: null, priceMax: null }) })
    expect(e.zoning).toBe("industrial")
    expect(e.basis[0]).toMatch(/nearby parks/)
    expect(e.perM2).toBeGreaterThan(20)
    expect(e.perM2).toBeLessThan(1500)
  })

  it("prices land outside business parks as farmland", () => {
    const e = estimatePrice(data, PLACES.veluwe.lat, PLACES.veluwe.lon, { areaM2: 50_000, seed: "farm", park: null })
    expect(e.zoning).toBe("agricultural")
    expect(e.perM2).toBeGreaterThanOrEqual(3)
    expect(e.perM2).toBeLessThanOrEqual(15)
  })

  it("returns a null total when the area is unknown", () => {
    expect(estimatePrice(data, lat, lon, { areaM2: null, seed: "x", park: park() }).total).toBeNull()
  })
})
