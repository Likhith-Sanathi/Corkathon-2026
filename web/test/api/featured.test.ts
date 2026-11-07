import { describe, expect, it } from "vitest"
import { POST } from "@/app/api/featured/route"
import type { FeaturedSection } from "@/lib/types"
import { post } from "../helpers/fetch"

const fetchSections = async (body: unknown = {}) => ((await (await POST(post(body))).json()) as { sections: FeaturedSection[] }).sections
const TODAY = Date.parse("2026-11-07T00:00:00Z")

describe("POST /api/featured", () => {
  it("returns the four sections with valid, for-sale items", async () => {
    const sections = await fetchSections()
    expect(sections.map((s) => s.key)).toEqual(["top", "value", "large", "new"])
    const ids = sections.flatMap((s) => s.items.map((i) => i.listing.id))
    expect(new Set(ids).size).toBe(ids.length) // nothing featured twice
    for (const s of sections)
      for (const i of s.items) {
        expect(i.listing.status).toBe("for_sale")
        expect(i.outline.length).toBeGreaterThanOrEqual(3)
        expect(i.score).toBeGreaterThan(0)
      }
  })

  it("orders each section by its own rule", async () => {
    const s = Object.fromEntries((await fetchSections()).map((x) => [x.key, x.items]))
    const desc = (xs: number[]) => xs.every((v, i) => i === 0 || xs[i - 1] >= v)
    expect(desc(s.top.map((i) => i.score))).toBe(true)
    expect(desc(s.value.map((i) => -i.listing.perM2))).toBe(true)
    for (const i of s.large) expect(i.listing.areaM2).toBeGreaterThanOrEqual(50_000)
    for (const i of s.new) expect((TODAY - Date.parse(i.listing.listedOn)) / 86_400_000).toBeLessThanOrEqual(30)
  })

  it("keeps sections varied: at most two plots per municipality", async () => {
    for (const s of await fetchSections()) {
      const counts = new Map<string, number>()
      for (const i of s.items) counts.set(i.listing.municipality, (counts.get(i.listing.municipality) ?? 0) + 1)
      for (const c of counts.values()) expect(c).toBeLessThanOrEqual(2)
    }
  })

  it("follows the weights", async () => {
    const def = await fetchSections()
    const iso = await fetchSections({ weights: { power: 0, isolation: 1, telecom: 0, water: 0, roads: 0 } })
    expect(iso[0].items.map((i) => i.listing.id)).not.toEqual(def[0].items.map((i) => i.listing.id))
  })

  it("tolerates an empty or malformed body", async () => {
    expect((await POST(post("nope", true))).status).toBe(200)
  })
})
