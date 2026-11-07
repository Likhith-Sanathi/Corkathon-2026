import { beforeAll, describe, expect, it } from "vitest"
import { fetchParcel, findBusinessPark, findListing, nearestBusinessPark } from "@/lib/plot"
import type { Dataset } from "@/lib/types"
import { dataset, PLACES } from "../helpers/data"
import { json, mockFetch } from "../helpers/fetch"

let data: Dataset
beforeAll(async () => {
  data = await dataset()
})

describe("findListing", () => {
  it("finds each listing at its own label point", () => {
    const sample = data.plots!.features.filter((_, i) => i % 97 === 0)
    expect(sample.length).toBeGreaterThan(30)
    for (const f of sample) expect(findListing(data, f.properties.lat, f.properties.lon)?.id).toBe(f.properties.id)
  })
  it("returns null far from any listing", () => {
    expect(findListing(data, PLACES.northSea.lat, PLACES.northSea.lon)).toBeNull()
  })
})

describe("findBusinessPark / nearestBusinessPark", () => {
  it("puts listings inside the park they were generated for", () => {
    const sample = data.plots!.features.filter((_, i) => i % 53 === 0)
    const hits = sample.filter((f) => findBusinessPark(data, f.properties.lat, f.properties.lon)?.id === f.properties.parkId)
    expect(hits.length / sample.length).toBeGreaterThan(0.95) // parks can overlap at their edges
  })
  it("reports the nearest park near Eemshaven", () => {
    const n = nearestBusinessPark(data, PLACES.eemshaven.lat, PLACES.eemshaven.lon)
    expect(n?.park.name).toMatch(/Eemshaven/)
    expect(n!.km).toBeGreaterThanOrEqual(0)
    expect(n!.km).toBeLessThan(2)
  })
  it("respects the search radius", () => {
    expect(nearestBusinessPark(data, PLACES.northSea.lat, PLACES.northSea.lon, 1)).toBeNull()
  })
})

describe("fetchParcel (PDOK, mocked)", () => {
  const square = (lon: number, lat: number, d = 0.001) => [
    [
      [lon - d, lat - d],
      [lon + d, lat - d],
      [lon + d, lat + d],
      [lon - d, lat + d],
      [lon - d, lat - d],
    ],
  ]
  const parcel = (lon: number, lat: number, nr: number) => ({
    properties: { kadastrale_gemeente_waarde: "Test", sectie: "A", perceelnummer: nr, kadastrale_grootte_waarde: 1234 },
    geometry: { type: "Polygon", coordinates: square(lon, lat) },
  })

  it("returns the parcel that contains the point, not just a nearby one", async () => {
    mockFetch({ "api.pdok.nl": () => json({ features: [parcel(5.01, 52.01, 1), parcel(5.0, 52.0, 2)] }) })
    const p = await fetchParcel(52.0, 5.0)
    expect(p).toMatchObject({ id: "Test A 2", areaM2: 1234 })
    expect(p!.geometry.type).toBe("MultiPolygon")
  })
  it("returns null when no parcel contains the point", async () => {
    mockFetch({ "api.pdok.nl": () => json({ features: [parcel(6, 53, 1)] }) })
    expect(await fetchParcel(52.0, 5.0)).toBeNull()
  })
  it("throws on an upstream error so the route can report it", async () => {
    mockFetch({ "api.pdok.nl": () => json({}, 503) })
    await expect(fetchParcel(52.0, 5.0)).rejects.toThrow(/503/)
  })
})
