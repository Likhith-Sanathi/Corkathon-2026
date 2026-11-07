import { describe, expect, it } from "vitest"
import { POST } from "@/app/api/rank-sites/route"
import { haversineKm } from "@/lib/geo"
import type { ScoreResult } from "@/lib/types"
import { json, mockFetch, post } from "../helpers/fetch"

const AMSTERDAM = [{ lat: "52.3730796", lon: "4.8924534", display_name: "Amsterdam, Noord-Holland, Nederland" }]
type RankBody = { sites: ScoreResult[]; plotsInRange: number; maxPrice: number | null; error?: string; suggestion?: string | null }
const rank = async (body: unknown) => {
  const res = await POST(post(body))
  return { status: res.status, body: (await res.json()) as RankBody }
}

describe("POST /api/rank-sites", () => {
  it("ranks only plots for sale inside the radius, best first, at most two per park", async () => {
    mockFetch({ "nominatim.openstreetmap.org": () => json(AMSTERDAM) })
    const { status, body } = await rank({ query: "Amsterdam", radiusKm: 30 })
    expect(status).toBe(200)
    expect(body.sites.length).toBe(5)
    expect(body.plotsInRange).toBeGreaterThan(body.sites.length)
    const parks = new Map<string, number>()
    body.sites.forEach((s, i) => {
      const l = s.plot!.listing!
      expect(haversineKm(52.3730796, 4.8924534, l.lat, l.lon)).toBeLessThanOrEqual(30)
      if (i) expect(body.sites[i - 1].score).toBeGreaterThanOrEqual(s.score)
      parks.set(l.parkId, (parks.get(l.parkId) ?? 0) + 1)
    })
    for (const c of parks.values()) expect(c).toBeLessThanOrEqual(2)
  })

  it("applies the price ceiling", async () => {
    mockFetch({ "nominatim.openstreetmap.org": () => json(AMSTERDAM) })
    const { body } = await rank({ query: "Amsterdam", radiusKm: 30, maxPrice: 1_000_000 })
    expect(body.maxPrice).toBe(1_000_000)
    expect(body.sites.length).toBeGreaterThan(0)
    for (const s of body.sites) expect(s.plot!.listing!.total).toBeLessThanOrEqual(1_000_000)
  })

  it("suggests a nearby place when nothing fits the price", async () => {
    mockFetch({ "nominatim.openstreetmap.org": () => json(AMSTERDAM) })
    const { status, body } = await rank({ query: "Amsterdam", radiusKm: 5, maxPrice: 1 })
    expect(status).toBe(422)
    expect(body.error).toMatch(/No plots for sale/)
  })

  it("offers a spelling suggestion for an unknown place", async () => {
    mockFetch({ "nominatim.openstreetmap.org": () => json([]) })
    const { status, body } = await rank({ query: "Amsterdm" })
    expect(status).toBe(404)
    expect(body.suggestion).toBe("Amsterdam")
  })

  it("rejects places outside the Netherlands", async () => {
    mockFetch({ "nominatim.openstreetmap.org": () => json([{ lat: "52.52", lon: "13.405", display_name: "Berlin, Deutschland" }]) })
    const { status, body } = await rank({ query: "Berlin" })
    expect(status).toBe(422)
    expect(body.error).toMatch(/outside the Netherlands/)
  })

  it("returns 502 when the geocoder is unreachable", async () => {
    mockFetch({
      "nominatim.openstreetmap.org": () => {
        throw new Error("network down")
      },
    })
    expect((await rank({ query: "Amsterdam" })).status).toBe(502)
  })

  it.each([
    ["an empty query", { query: "  " }],
    ["no query", {}],
  ])("rejects %s with 400", async (_, body) => {
    mockFetch({})
    expect((await rank(body)).status).toBe(400)
  })
})
