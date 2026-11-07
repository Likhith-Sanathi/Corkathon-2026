import { geocodePlace } from "@/lib/geocode"
import { topGridCandidates } from "@/lib/grid-search"
import { GRID_SPEC } from "@/lib/grid"
import { summariseRanking } from "@/lib/llm-rank"
import { DEFAULT_WEIGHTS, scoreLocation } from "@/lib/scoring"
import { loadDataset } from "@/lib/server-data"
import type { Weights } from "@/lib/types"

type Body = { query?: unknown; weights?: Partial<Record<keyof Weights, unknown>>; radiusKm?: unknown }

const PAD_DEG = 0.5 // how far outside the NL grid bounds a geocode hit may land before we call it "out of coverage"

export async function POST(request: Request) {
  let body: Body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Body must be JSON: { query, weights?, radiusKm? }" }, { status: 400 })
  }

  const query = typeof body.query === "string" ? body.query.trim() : ""
  if (!query) return Response.json({ error: "Provide a place name to search." }, { status: 400 })

  const radiusKm = Math.min(60, Math.max(5, Number(body.radiusKm) || 20))

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

  const coarse = await topGridCandidates(located, weights, { radiusKm, count: 20 })
  if (coarse.length === 0) {
    return Response.json(
      { error: `No scoreable land within ${radiusKm} km of "${located.displayName}". Try a larger radius.` },
      { status: 422 },
    )
  }

  const data = await loadDataset()
  const sites = coarse
    .map((c) => scoreLocation(data, c.lat, c.lon, weights))
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const summary = await summariseRanking(query, sites)

  return Response.json({
    query,
    resolved: { lat: located.lat, lon: located.lon, displayName: located.displayName },
    radiusKm,
    weights,
    sites,
    summary,
  })
}
