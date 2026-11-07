import { geocodePlace } from "@/lib/geocode"
import { haversineKm } from "@/lib/geo"
import { GRID_SPEC } from "@/lib/grid"
import { gridScorer } from "@/lib/grid-search"
import { DEFAULT_WEIGHTS, scoreLocation } from "@/lib/scoring"
import { loadDataset } from "@/lib/server-data"
import type { ScoreResult, Weights } from "@/lib/types"

type Body = { query?: unknown; weights?: Partial<Record<keyof Weights, unknown>>; radiusKm?: unknown; maxPrice?: unknown }

const PAD_DEG = 0.5 // how far outside the NL grid bounds a geocode hit may land before we call it "out of coverage"
const TOP = 5
const EXACT_CANDIDATES = 40 // plots re-scored exactly after the fast grid pre-rank
const MAX_PER_PARK = 2 // keep the shortlist varied instead of five neighbouring plots

/**
 * Rank the plots for sale around a place. The place name only sets the search area:
 * every result is a plot from the "Plots for sale" layer (synthetic demo listings).
 */
export async function POST(request: Request) {
  let body: Body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Body must be JSON: { query, weights?, radiusKm?, maxPrice? }" }, { status: 400 })
  }

  const query = typeof body.query === "string" ? body.query.trim() : ""
  if (!query) return Response.json({ error: "Provide a place name to search around." }, { status: 400 })

  const radiusKm = Math.min(60, Math.max(5, Number(body.radiusKm) || 20))
  // Optional ceiling on the plot's total asking price, in €.
  const maxPrice = Number(body.maxPrice) > 0 ? Number(body.maxPrice) : null

  const weights = { ...DEFAULT_WEIGHTS }
  for (const key of Object.keys(weights) as (keyof Weights)[]) {
    const v = Number(body.weights?.[key])
    if (Number.isFinite(v) && v >= 0) weights[key] = v
  }

  let located
  try {
    located = await geocodePlace(query)
  } catch {
    return Response.json({ error: "Could not reach the geocoding service. Try again shortly." }, { status: 502 })
  }
  if (!located) return Response.json({ error: `Could not find "${query}" on the map.` }, { status: 404 })

  const { west, east, south, north } = GRID_SPEC
  if (located.lat < south - PAD_DEG || located.lat > north + PAD_DEG || located.lon < west - PAD_DEG || located.lon > east + PAD_DEG) {
    return Response.json(
      { error: `"${located.displayName}" is outside the Netherlands, the only area currently covered.` },
      { status: 422 },
    )
  }

  // 1. Every plot for sale (or under offer) within the radius and price ceiling.
  const data = await loadDataset()
  const inRange = (data.plots?.features ?? [])
    .map((f) => f.properties)
    .filter((p) => haversineKm(located.lat, located.lon, p.lat, p.lon) <= radiusKm)
    .filter((p) => maxPrice === null || p.total <= maxPrice)
  if (inRange.length === 0) {
    const under = maxPrice === null ? "" : ` under €${(maxPrice / 1e6).toLocaleString("en-GB")}M`
    return Response.json(
      { error: `No plots for sale${under} within ${radiusKm} km of "${located.displayName}". Try a larger radius or a higher price.` },
      { status: 422 },
    )
  }

  // 2. Fast pre-rank on the precomputed grid, then exact scoring for the best candidates.
  const fast = await gridScorer(weights)
  const shortlist = inRange
    .map((p) => ({ p, s: fast(p.lat, p.lon) ?? 0 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, EXACT_CANDIDATES)

  const scored: ScoreResult[] = []
  for (const { p } of shortlist) {
    const site = scoreLocation(data, p.lat, p.lon, weights)
    if (site) scored.push({ ...site, plot: { parcel: null, businessPark: null, listing: p } })
  }
  scored.sort((a, b) => b.score - a.score)

  // 3. Top plots, at most MAX_PER_PARK from any one business park.
  const perPark = new Map<string, number>()
  const sites: ScoreResult[] = []
  for (const site of scored) {
    const park = site.plot!.listing!.parkId
    if ((perPark.get(park) ?? 0) >= MAX_PER_PARK) continue
    perPark.set(park, (perPark.get(park) ?? 0) + 1)
    sites.push(site)
    if (sites.length === TOP) break
  }

  return Response.json({
    query,
    resolved: { lat: located.lat, lon: located.lon, displayName: located.displayName },
    radiusKm,
    maxPrice,
    weights,
    plotsInRange: inRange.length,
    sites,
  })
}
