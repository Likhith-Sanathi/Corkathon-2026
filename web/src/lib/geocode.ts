import "server-only"
import { GRID_SPEC } from "./grid"

export type GeocodeResult = { lat: number; lon: number; displayName: string }

/**
 * Nominatim usage policy requires a descriptive User-Agent identifying the app
 * (no API key needed, but anonymous/browser-like UAs get blocked).
 */
const USER_AGENT = "corkathon-2026-datacentre-site-scorer (hackathon project)"

/** Resolve a place name to coordinates, biased to the Netherlands (the only area we score). */
export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    viewbox: `${GRID_SPEC.west},${GRID_SPEC.north},${GRID_SPEC.east},${GRID_SPEC.south}`,
    bounded: "0", // prefer the viewbox but fall back outside it so we can report "outside coverage" clearly
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Geocoding service responded ${res.status}`)

  const body = (await res.json()) as { lat: string; lon: string; display_name: string }[]
  const hit = body[0]
  if (!hit) return null

  return { lat: Number(hit.lat), lon: Number(hit.lon), displayName: hit.display_name }
}
