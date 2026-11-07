import { DEFAULT_WEIGHTS, scoreLocation } from "@/lib/scoring"
import { loadDataset } from "@/lib/server-data"
import type { Weights } from "@/lib/types"

type Body = { lat?: unknown; lon?: unknown; weights?: Partial<Record<keyof Weights, unknown>> }

export async function POST(request: Request) {
  let body: Body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Body must be JSON: { lat, lon, weights? }" }, { status: 400 })
  }

  const lat = Number(body.lat)
  const lon = Number(body.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: "lat and lon must be valid coordinates" }, { status: 400 })
  }

  const weights = { ...DEFAULT_WEIGHTS }
  for (const key of Object.keys(weights) as (keyof Weights)[]) {
    const v = Number(body.weights?.[key])
    if (Number.isFinite(v) && v >= 0) weights[key] = v
  }

  const data = await loadDataset()
  const result = scoreLocation(data, lat, lon, weights)
  if (!result) {
    return Response.json({ error: "That point is outside the Netherlands. Drop the pin inside the country." }, { status: 422 })
  }
  return Response.json(result)
}
