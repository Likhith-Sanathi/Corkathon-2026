import { beforeAll, describe, expect, it } from "vitest"
import { gridScorer, topGridCandidates } from "@/lib/grid-search"
import { DEFAULT_WEIGHTS, scoreLocation } from "@/lib/scoring"
import type { Dataset } from "@/lib/types"
import { dataset, PLACES } from "../helpers/data"

let data: Dataset
beforeAll(async () => {
  data = await dataset()
})

describe("gridScorer", () => {
  it("returns null outside the Netherlands", async () => {
    const s = await gridScorer(DEFAULT_WEIGHTS)
    expect(s(PLACES.northSea.lat, PLACES.northSea.lon)).toBeNull()
    expect(s(10, 10)).toBeNull()
  })
  it("tracks the exact score closely (it is a ~500 m pre-filter)", async () => {
    const s = await gridScorer(DEFAULT_WEIGHTS)
    for (const p of [PLACES.sciencePark, PLACES.eemshaven, PLACES.veluwe]) {
      const fast = s(p.lat, p.lon)!
      const exact = scoreLocation(data, p.lat, p.lon)!.score
      expect(fast).toBeGreaterThanOrEqual(0)
      expect(fast).toBeLessThanOrEqual(100)
      expect(Math.abs(fast - exact)).toBeLessThan(8)
    }
  })
})

describe("topGridCandidates", () => {
  it("returns distinct, sorted, in-radius cells", async () => {
    const c = await topGridCandidates(PLACES.sciencePark, DEFAULT_WEIGHTS, { radiusKm: 20, count: 10, minSeparationKm: 1.5 })
    expect(c.length).toBe(10)
    for (let i = 1; i < c.length; i++) expect(c[i - 1].score).toBeGreaterThanOrEqual(c[i].score)
    for (const x of c) expect(x.distanceKm).toBeLessThanOrEqual(20)
  })
})
