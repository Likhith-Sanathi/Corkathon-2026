import { beforeAll, describe, expect, it } from "vitest"
import { DEFAULT_WEIGHTS, grade, locate, normaliseWeights, PARAMS, scoreAt, scoreLocation } from "@/lib/scoring"
import type { Dataset, ScoreResult, Weights } from "@/lib/types"
import { dataset, PLACES } from "../helpers/data"

let data: Dataset
beforeAll(async () => {
  data = await dataset()
})

const score = (p: { lat: number; lon: number }, w?: Weights) => scoreLocation(data, p.lat, p.lon, w) as ScoreResult

describe("normaliseWeights", () => {
  it("normalises to a sum of 1", () => {
    const w = normaliseWeights({ power: 2, isolation: 1, telecom: 1, water: 0, roads: 0 })
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
    expect(w.power).toBeCloseTo(0.5, 12)
  })
  it("treats negatives as zero", () => {
    expect(normaliseWeights({ power: -5, isolation: 1, telecom: 0, water: 0, roads: 0 }).isolation).toBe(1)
  })
  it("falls back to the defaults when every weight is zero", () => {
    expect(normaliseWeights({ power: 0, isolation: 0, telecom: 0, water: 0, roads: 0 })).toEqual(normaliseWeights(DEFAULT_WEIGHTS))
  })
})

describe("locate / outside the Netherlands", () => {
  it("names the municipality for a Dutch point", () => {
    expect(locate(data, PLACES.sciencePark.lat, PLACES.sciencePark.lon)?.name).toBe("Amsterdam")
  })
  it.each([
    ["North Sea", PLACES.northSea],
    ["Essen, Germany", PLACES.essen],
  ])("returns null for %s", (_, p) => {
    expect(locate(data, p.lat, p.lon)).toBeNull()
    expect(scoreLocation(data, p.lat, p.lon)).toBeNull()
  })
})

describe("scoreLocation", () => {
  it("returns a well-formed, internally consistent result", () => {
    const r = score(PLACES.sciencePark)
    expect(r.municipality).toBe("Amsterdam")
    expect(r.factors.map((f) => f.key).sort()).toEqual(["isolation", "power", "roads", "telecom", "water"])
    for (const f of r.factors) {
      expect(f.score).toBeGreaterThanOrEqual(0)
      expect(f.score).toBeLessThanOrEqual(1)
      expect(f.evidence.length).toBeGreaterThan(0)
    }
    expect(r.factors.reduce((a, f) => a + f.weight, 0)).toBeCloseTo(1, 9)
    for (const k of r.risks) {
      expect(k.multiplier).toBeGreaterThan(0)
      expect(k.multiplier).toBeLessThanOrEqual(1)
    }
    const suit = r.factors.reduce((a, f) => a + f.weight * f.score, 0)
    expect(r.suitability).toBeCloseTo(suit, 9)
    expect(r.score).toBeCloseTo(Math.round(1000 * suit * r.risk) / 10, 9)
    expect(r.points.length).toBeGreaterThan(0)
  })

  it("is deterministic", () => {
    expect(score(PLACES.eemshaven)).toEqual(score(PLACES.eemshaven))
  })

  it("ranks a known data-centre cluster above a forest", () => {
    expect(score(PLACES.sciencePark).score).toBeGreaterThan(score(PLACES.veluwe).score)
  })

  it("uses only the selected factor when the other weights are zero", () => {
    const r = score(PLACES.sciencePark, { power: 1, isolation: 0, telecom: 0, water: 0, roads: 0 })
    const power = r.factors.find((f) => f.key === "power")!
    expect(r.suitability).toBeCloseTo(power.score, 9)
  })

  it("penalises the Groningen gas field for seismicity, but not the Veluwe", () => {
    const seismic = (p: { lat: number; lon: number }) => score(p).risks.find((r) => r.key === "seismic")!.multiplier
    expect(seismic(PLACES.groningenGasField)).toBeLessThan(0.95)
    expect(seismic(PLACES.veluwe)).toBe(1)
  })

  it("applies the unprotected-flood multiplier inside a type D zone", () => {
    const zone = data.flood.features.find((f) => f.properties.type === "D")!
    const ring = zone.geometry.coordinates[0]
    const lon = ring.reduce((a, p) => a + p[0], 0) / ring.length
    const lat = ring.reduce((a, p) => a + p[1], 0) / ring.length
    const r = scoreLocation(data, lat, lon)
    if (!r) return // zone centre happens to fall outside the municipal outline (offshore): nothing to assert
    expect(r.risks.find((k) => k.key === "flood")!.multiplier).toBe(PARAMS.flood.D)
  })

  it("matches scoreAt (which skips the municipality lookup)", () => {
    const { lat, lon } = PLACES.eemshaven
    const a = scoreLocation(data, lat, lon)!
    const b = scoreAt(data, lat, lon)
    expect(b.score).toBe(a.score)
    expect(b.factors).toEqual(a.factors)
  })
})

describe("grade", () => {
  it.each([
    [85, "great"],
    [70, "great"],
    [55, "good"],
    [35, "fair"],
    [10, "poor"],
  ])("grades %d as %s", (s, tone) => {
    expect(grade(s).tone).toBe(tone)
  })
})
