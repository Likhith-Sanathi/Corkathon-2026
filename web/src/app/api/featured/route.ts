import { gridScorer } from "@/lib/grid-search"
import { DEFAULT_WEIGHTS, scoreLocation } from "@/lib/scoring"
import { loadDataset } from "@/lib/server-data"
import type { FeaturedItem, FeaturedSection, Listing, ListingProps, Weights } from "@/lib/types"

const POOL = 40 // candidates per section, pre-ranked on the score grid, then scored exactly
const TODAY = Date.parse("2026-11-07T00:00:00Z") // matches the synthetic listing dates

type Body = { weights?: Partial<Record<keyof Weights, unknown>> }

/** Up to ~48 points of the plot's largest outer ring, for a small SVG thumbnail. */
function outlineOf(f: Listing): [number, number][] {
  const ring = f.geometry.coordinates.reduce((a, b) => (b[0].length > a[0].length ? b : a))[0]
  const step = Math.max(1, Math.ceil(ring.length / 48))
  return ring.filter((_, i) => i % step === 0).map(([x, y]) => [x, y])
}

/**
 * Featured listings for the right-hand bar, computed from the synthetic plots for sale
 * under the current weights: top rated, best value, large plots and just listed.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body
  const weights = { ...DEFAULT_WEIGHTS }
  for (const key of Object.keys(weights) as (keyof Weights)[]) {
    const v = Number(body.weights?.[key])
    if (Number.isFinite(v) && v >= 0) weights[key] = v
  }

  const data = await loadDataset()
  const forSale = (data.plots?.features ?? []).filter((f) => f.properties.status === "for_sale")
  if (!forSale.length) return Response.json({ sections: [] })

  // Fast grid score for every plot, then candidate pools per section.
  const fast = await gridScorer(weights)
  const graded = forSale.map((f) => ({ f, g: fast(f.properties.lat, f.properties.lon) ?? 0 }))
  const byGrid = [...graded].sort((a, b) => b.g - a.g)
  const p80 = byGrid[Math.floor(byGrid.length * 0.2)]?.g ?? 0
  const ageDays = (p: ListingProps) => (TODAY - Date.parse(p.listedOn)) / 86_400_000

  const pools = {
    top: byGrid.slice(0, POOL),
    value: graded
      .filter((x) => x.g >= p80)
      .sort((a, b) => a.f.properties.perM2 - b.f.properties.perM2)
      .slice(0, POOL),
    large: byGrid.filter((x) => x.f.properties.areaM2 >= 50_000).slice(0, POOL),
    new: byGrid.filter((x) => ageDays(x.f.properties) <= 30).slice(0, POOL),
  }

  // Exact scores (memoised across pools).
  const exact = new Map<Listing, number>()
  const scoreOf = (f: Listing) => {
    if (!exact.has(f)) exact.set(f, scoreLocation(data, f.properties.lat, f.properties.lon, weights)?.score ?? 0)
    return exact.get(f)!
  }

  const used = new Set<string>()
  const usedParks = new Set<string>()
  const pick = (pool: { f: Listing }[], count: number, order: (a: Listing, b: Listing) => number, onePerPark = true) => {
    const items: FeaturedItem[] = []
    const perMunicipality = new Map<string, number>() // at most 2 per municipality per section, for variety
    for (const f of pool.map((x) => x.f).sort(order)) {
      const p = f.properties
      if (used.has(p.id) || (onePerPark && usedParks.has(p.parkId))) continue
      if ((perMunicipality.get(p.municipality) ?? 0) >= 2) continue
      perMunicipality.set(p.municipality, (perMunicipality.get(p.municipality) ?? 0) + 1)
      used.add(p.id)
      usedParks.add(p.parkId)
      items.push({ listing: p, score: Math.round(scoreOf(f) * 10) / 10, outline: outlineOf(f) })
      if (items.length === count) break
    }
    return items
  }

  const byScore = (a: Listing, b: Listing) => scoreOf(b) - scoreOf(a)
  const topItems = pick(pools.top, 4, byScore)
  const bar = topItems.length ? topItems[topItems.length - 1].score - 12 : 0
  const valuePool = pools.value.filter((x) => scoreOf(x.f) >= bar)

  const sections: FeaturedSection[] = [
    { key: "top", title: "Top rated", hint: "Highest site score for your weights", items: topItems },
    {
      key: "value",
      title: "Best value",
      hint: "Strong score, lowest price per m²",
      items: pick(valuePool, 3, (a, b) => a.properties.perM2 - b.properties.perM2),
    },
    { key: "large", title: "Large plots", hint: "5 ha and up, room for a campus", items: pick(pools.large, 3, byScore) },
    {
      key: "new",
      title: "Just listed",
      hint: "On the market in the last 30 days",
      items: pick(pools.new, 3, (a, b) => Date.parse(b.properties.listedOn) - Date.parse(a.properties.listedOn) || byScore(a, b)),
    },
  ]

  return Response.json({ sections: sections.filter((s) => s.items.length) })
}
