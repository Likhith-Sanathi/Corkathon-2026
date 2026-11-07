import { DEFAULT_WEIGHTS, scoreLocation } from "@/lib/scoring"
import { loadDataset } from "@/lib/server-data"
import { fetchParcel, findBusinessPark, findListing, nearestBusinessPark } from "@/lib/plot"
import { estimatePrice } from "@/lib/pricing"
import type { PlotInfo, Weights } from "@/lib/types"

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

  // The plot: business park from IBIS (local data) and the cadastral parcel (live from PDOK).
  const businessPark = findBusinessPark(data, lat, lon)
  const plot: PlotInfo = {
    parcel: null,
    businessPark,
    nearestPark: businessPark ? null : nearestBusinessPark(data, lat, lon),
    listing: findListing(data, lat, lon),
  }
  try {
    plot.parcel = await fetchParcel(lat, lon)
  } catch (e) {
    plot.parcelError = e instanceof Error && e.name === "TimeoutError" ? "Parcel service timed out" : "Parcel service unavailable"
  }
  // Demo: a simulated value for any parcel that is not one of the synthetic listings.
  if (plot.parcel && !plot.listing) {
    plot.estimate = estimatePrice(data, lat, lon, { areaM2: plot.parcel.areaM2, seed: plot.parcel.id, park: businessPark })
  }
  return Response.json({ ...result, plot })
}
