import { haversineKm, inPolygon } from "./geo"
import type { BusinessPark, BusinessParkProps, Dataset, Parcel, Ring } from "./types"

/** The IBIS business park containing the point, if any. */
export function findBusinessPark(data: Dataset, lat: number, lon: number): BusinessParkProps | null {
  for (const park of data.ibis?.features ?? []) {
    if (!inBbox(park, lat, lon)) continue
    if (park.geometry.coordinates.some((poly) => inPolygon(lon, lat, poly))) return park.properties
  }
  return null
}

/** The business park whose boundary is closest to the point, within maxKm (measured to outline vertices). */
export function nearestBusinessPark(data: Dataset, lat: number, lon: number, maxKm = 15) {
  const dLat = maxKm / 111
  const dLon = maxKm / (111 * Math.cos((lat * Math.PI) / 180))
  let best: { park: BusinessParkProps; km: number } | null = null
  for (const park of data.ibis?.features ?? []) {
    if (!inBbox(park, lat, lon, dLat, dLon)) continue
    for (const poly of park.geometry.coordinates)
      for (const [x, y] of poly[0]) {
        const km = haversineKm(lat, lon, y, x)
        if (km <= maxKm && (!best || km < best.km)) best = { park: park.properties, km }
      }
  }
  return best
}

const bboxCache = new WeakMap<BusinessPark, [number, number, number, number]>()
function inBbox(park: BusinessPark, lat: number, lon: number, padLat = 0, padLon = 0) {
  let b = bboxCache.get(park)
  if (!b) {
    b = [Infinity, Infinity, -Infinity, -Infinity]
    for (const poly of park.geometry.coordinates)
      for (const [x, y] of poly[0]) {
        b[0] = Math.min(b[0], x)
        b[1] = Math.min(b[1], y)
        b[2] = Math.max(b[2], x)
        b[3] = Math.max(b[3], y)
      }
    bboxCache.set(park, b)
  }
  return lon >= b[0] - padLon && lon <= b[2] + padLon && lat >= b[1] - padLat && lat <= b[3] + padLat
}

const PARCEL_API = "https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/collections/perceel/items"

type PdokParcel = {
  properties: { kadastrale_gemeente_waarde: string; sectie: string; perceelnummer: number; kadastrale_grootte_waarde: number }
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Ring[] | Ring[][] }
}

/** The cadastral parcel under the point, from Kadaster's open parcel map on PDOK (free, no key). */
export async function fetchParcel(lat: number, lon: number): Promise<Parcel | null> {
  const d = 0.0004 // ~40 m search box; parcels are matched exactly below
  const url = `${PARCEL_API}?f=json&limit=50&bbox=${lon - d},${lat - d},${lon + d},${lat + d}`
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error(`PDOK parcel service returned ${res.status}`)
  const body = (await res.json()) as { features?: PdokParcel[] }
  for (const f of body.features ?? []) {
    const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][]
    if (!polys.some((poly) => inPolygon(lon, lat, poly))) continue
    const p = f.properties
    return {
      id: `${p.kadastrale_gemeente_waarde} ${p.sectie} ${p.perceelnummer}`,
      areaM2: p.kadastrale_grootte_waarde,
      geometry: { type: "MultiPolygon", coordinates: polys },
    }
  }
  return null
}
