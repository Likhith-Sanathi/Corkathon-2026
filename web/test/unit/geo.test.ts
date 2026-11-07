import { describe, expect, it } from "vitest"
import { haversineKm, inPolygon, nearest, within } from "@/lib/geo"
import type { Ring } from "@/lib/types"

describe("haversineKm", () => {
  it("measures a known distance (Amsterdam–Rotterdam ≈ 57 km)", () => {
    expect(haversineKm(52.3676, 4.9041, 51.9244, 4.4777)).toBeGreaterThan(56)
    expect(haversineKm(52.3676, 4.9041, 51.9244, 4.4777)).toBeLessThan(58)
  })
  it("is zero for the same point and symmetric", () => {
    expect(haversineKm(52, 5, 52, 5)).toBe(0)
    expect(haversineKm(52, 5, 53, 6)).toBeCloseTo(haversineKm(53, 6, 52, 5), 9)
  })
  it("handles antipodal points without NaN", () => {
    const d = haversineKm(0, 0, 0, 180)
    expect(Number.isFinite(d)).toBe(true)
    expect(d).toBeCloseTo(Math.PI * 6371.0088, 0)
  })
})

describe("nearest / within", () => {
  const pts = [
    { lat: 52.0, lon: 5.0, id: "a" },
    { lat: 52.1, lon: 5.1, id: "b" },
    { lat: 53.0, lon: 6.0, id: "c" },
  ]
  it("returns the closest item and its distance", () => {
    const hit = nearest(pts, 52.09, 5.09)
    expect(hit?.item.id).toBe("b")
    expect(hit?.km).toBeCloseTo(haversineKm(52.09, 5.09, 52.1, 5.1), 9)
  })
  it("returns null for an empty list", () => {
    expect(nearest([], 52, 5)).toBeNull()
  })
  it("agrees with a brute-force search on random points", () => {
    let seed = 7
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
    const cloud = Array.from({ length: 500 }, (_, i) => ({ lat: 50.8 + rand() * 2.7, lon: 3.4 + rand() * 3.8, id: i }))
    for (let k = 0; k < 25; k++) {
      const q = { lat: 50.8 + rand() * 2.7, lon: 3.4 + rand() * 3.8 }
      const brute = cloud.reduce((a, b) => (haversineKm(q.lat, q.lon, b.lat, b.lon) < haversineKm(q.lat, q.lon, a.lat, a.lon) ? b : a))
      expect(nearest(cloud, q.lat, q.lon)?.item.id).toBe(brute.id)
    }
  })
  it("returns exactly the items inside the radius", () => {
    const got = within(pts, 52.05, 5.05, 10).map((x) => x.item.id).sort()
    expect(got).toEqual(["a", "b"])
    for (const { item, km } of within(pts, 52.05, 5.05, 200)) expect(km).toBeCloseTo(haversineKm(52.05, 5.05, item.lat, item.lon), 9)
  })
})

describe("inPolygon", () => {
  const square: Ring = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ]
  const hole: Ring = [
    [4, 4],
    [6, 4],
    [6, 6],
    [4, 6],
    [4, 4],
  ]
  it("detects points inside and outside", () => {
    expect(inPolygon(5, 5, [square])).toBe(true)
    expect(inPolygon(11, 5, [square])).toBe(false)
    expect(inPolygon(-1, -1, [square])).toBe(false)
  })
  it("excludes holes", () => {
    expect(inPolygon(5, 5, [square, hole])).toBe(false)
    expect(inPolygon(2, 2, [square, hole])).toBe(true)
  })
  it("handles an empty polygon", () => {
    expect(inPolygon(1, 1, [])).toBe(false)
  })
})
