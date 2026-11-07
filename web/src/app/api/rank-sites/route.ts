import { geocodePlace } from "@/lib/geocode"
import { haversineKm } from "@/lib/geo"
import { GRID_SPEC } from "@/lib/grid"
import { gridScorer } from "@/lib/grid-search"
import { DEFAULT_WEIGHTS, scoreLocation } from "@/lib/scoring"
import { loadDataset } from "@/lib/server-data"
import type { Dataset, ScoreResult, Weights } from "@/lib/types"

type Body = { query?: unknown; weights?: Partial<Record<keyof Weights, unknown>>; radiusKm?: unknown; maxPrice?: unknown }

const PAD_DEG = 0.5 // how far outside the NL grid bounds a geocode hit may land before we call it "out of coverage"
const TOP = 5
const EXACT_CANDIDATES = 40 // plots re-scored exactly after the fast grid pre-rank
const MAX_PER_PARK = 2 // keep the shortlist varied instead of five neighbouring plots

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[b.length]
}

function municipalitiesWithListings(data: Dataset): string[] {
  const names = new Set<string>()
  for (const f of data.plots?.features ?? []) if (f.properties.status === "for_sale") names.add(f.properties.municipality)
  return [...names]
}

/** Closest-spelled municipality (that actually has plots for sale) to a mistyped query, or null if nothing is close. */
function suggestSpelling(query: string, names: string[]): string | null {
  const q = query.toLowerCase()
  let best: { name: string; dist: number } | null = null
  for (const name of names) {
    const dist = levenshtein(q, name.toLowerCase())
    if (!best || dist < best.dist) best = { name, dist }
  }
  if (!best || best.dist === 0) return null
  return best.dist <= Math.max(2, Math.ceil(q.length * 0.4)) ? best.name : null
}

/**
 * Nearest municipality with plots for sale (within the same price ceiling the user already
 * applied) to a point that itself has none nearby. Respecting maxPrice here matters: without it,
 * a search that came up empty purely because of the price cap would circularly "suggest" the
 * very place the user already searched, since it's the nearest place with *any* listing.
 */
function suggestNearbyMunicipality(data: Dataset, lat: number, lon: number, maxPriceEur: number | null): string | null {
  const centroids = new Map<string, { latSum: number; lonSum: number; n: number }>()
  for (const f of data.plots?.features ?? []) {
    const p = f.properties
    if (p.status !== "for_sale") continue
    if (maxPriceEur !== null && p.total > maxPriceEur) continue
    const acc = centroids.get(p.municipality) ?? { latSum: 0, lonSum: 0, n: 0 }
    acc.latSum += p.lat
    acc.lonSum += p.lon
    acc.n += 1
    centroids.set(p.municipality, acc)
  }
  let best: { name: string; km: number } | null = null
  for (const [name, acc] of centroids) {
    const km = haversineKm(lat, lon, acc.latSum / acc.n, acc.lonSum / acc.n)
    if (!best || km < best.km) best = { name, km }
  }
  return best?.name ?? null
}

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

  const data = await loadDataset()

  let located
  try {
    located = await geocodePlace(query)
  } catch {
    return Response.json({ error: "Could not reach the geocoding service. Try again shortly." }, { status: 502 })
  }
  if (!located) {
    const suggestion = suggestSpelling(query, municipalitiesWithListings(data))
    return Response.json({ error: `Could not find "${query}" on the map.`, suggestion }, { status: 404 })
  }

  const { west, east, south, north } = GRID_SPEC
  if (located.lat < south - PAD_DEG || located.lat > north + PAD_DEG || located.lon < west - PAD_DEG || located.lon > east + PAD_DEG) {
    return Response.json(
      { error: `"${located.displayName}" is outside the Netherlands, the only area currently covered.` },
      { status: 422 },
    )
  }

  // 1. Every plot for sale (or under offer) within the radius and price ceiling.
  const inRange = (data.plots?.features ?? [])
    .map((f) => f.properties)
    .filter((p) => haversineKm(located.lat, located.lon, p.lat, p.lon) <= radiusKm)
    .filter((p) => maxPrice === null || p.total <= maxPrice)
  if (inRange.length === 0) {
    const under = maxPrice === null ? "" : ` under €${(maxPrice / 1e6).toLocaleString("en-GB")}M`
    const suggestion = suggestNearbyMunicipality(data, located.lat, located.lon, maxPrice)
    return Response.json(
      {
        error: `No plots for sale${under} within ${radiusKm} km of "${located.displayName}". Try a larger radius or a higher price.`,
        suggestion,
      },
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
