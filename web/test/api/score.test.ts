import { describe, expect, it } from "vitest"
import { POST } from "@/app/api/score/route"
import type { ScoreResult } from "@/lib/types"
import { PLACES } from "../helpers/data"
import { json, mockFetch, post } from "../helpers/fetch"

/** PDOK returns one parcel: a small square around the point, so it always contains it. */
const parcelAround = (url: string) => {
  const bbox = new URL(url).searchParams.get("bbox")!.split(",").map(Number)
  const [lon, lat] = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
  const d = 0.0005
  return json({
    features: [
      {
        properties: { kadastrale_gemeente_waarde: "Watergraafsmeer", sectie: "B", perceelnummer: 5278, kadastrale_grootte_waarde: 73717 },
        geometry: { type: "Polygon", coordinates: [[[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]]] },
      },
    ],
  })
}

describe("POST /api/score", () => {
  it("scores a Dutch point with plot details and a price estimate", async () => {
    mockFetch({ "api.pdok.nl": parcelAround })
    const res = await POST(post(PLACES.sciencePark))
    expect(res.status).toBe(200)
    const body = (await res.json()) as ScoreResult
    expect(body.municipality).toBe("Amsterdam")
    expect(body.score).toBeGreaterThan(50)
    expect(body.plot?.parcel?.id).toBe("Watergraafsmeer B 5278")
    // the pin is not on a synthetic listing, so the parcel gets a simulated value
    expect(body.plot?.listing ?? null).toBeNull()
    expect(body.plot?.estimate?.perM2).toBeGreaterThan(0)
  })

  it("returns the listing when the pin is on a plot for sale", async () => {
    mockFetch({ "api.pdok.nl": parcelAround })
    const { lat, lon, id } = (await import("../helpers/data")).readJson<{ features: { properties: { lat: number; lon: number; id: string } }[] }>(
      "plots.json",
    ).features[0].properties
    const body = (await (await POST(post({ lat, lon }))).json()) as ScoreResult
    expect(body.plot?.listing?.id).toBe(id)
    expect(body.plot?.estimate ?? null).toBeNull()
  })

  it("still scores when the parcel service is down", async () => {
    mockFetch({ "api.pdok.nl": () => json({}, 503) })
    const body = (await (await POST(post(PLACES.eemshaven))).json()) as ScoreResult
    expect(body.score).toBeGreaterThan(0)
    expect(body.plot?.parcel).toBeNull()
    expect(body.plot?.parcelError).toMatch(/unavailable/)
  })

  it("reports a parcel-service timeout distinctly", async () => {
    mockFetch({
      "api.pdok.nl": () => {
        throw Object.assign(new Error("timed out"), { name: "TimeoutError" })
      },
    })
    const body = (await (await POST(post(PLACES.eemshaven))).json()) as ScoreResult
    expect(body.plot?.parcelError).toMatch(/timed out/)
  })

  it("honours custom weights", async () => {
    mockFetch({ "api.pdok.nl": parcelAround })
    const powerOnly = { ...PLACES.veluwe, weights: { power: 1, isolation: 0, telecom: 0, water: 0, roads: 0 } }
    const body = (await (await POST(post(powerOnly))).json()) as ScoreResult
    expect(body.factors.find((f) => f.key === "power")!.weight).toBe(1)
    expect(body.factors.find((f) => f.key === "isolation")!.weight).toBe(0)
  })

  it("rejects points outside the Netherlands with 422", async () => {
    mockFetch({})
    const res = await POST(post(PLACES.northSea))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toMatch(/outside the Netherlands/)
  })

  it.each([
    ["malformed JSON", "{not json", true],
    ["missing coordinates", {}, false],
    ["latitude out of range", { lat: 120, lon: 5 }, false],
    ["non-numeric coordinates", { lat: "abc", lon: "def" }, false],
  ])("rejects %s with 400", async (_, body, raw) => {
    mockFetch({})
    expect((await POST(post(body, raw as boolean))).status).toBe(400)
  })
})
