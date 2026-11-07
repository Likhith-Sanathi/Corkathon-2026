import type { Ring } from "./types"

const R_KM = 6371.0088
const toRad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Nearest item to (lat, lon), by haversine distance. */
export function nearest<T extends { lat: number; lon: number }>(
  items: T[],
  lat: number,
  lon: number,
): { item: T; km: number } | null {
  let best: T | null = null
  let bestKm = Infinity
  // Cheap equirectangular pre-check, then exact haversine for candidates.
  const cosLat = Math.cos(toRad(lat))
  for (const it of items) {
    const dx = (it.lon - lon) * cosLat
    const dy = it.lat - lat
    const approxKm = Math.sqrt(dx * dx + dy * dy) * 111.32
    if (approxKm > bestKm * 1.01 + 0.5) continue
    const km = haversineKm(lat, lon, it.lat, it.lon)
    if (km < bestKm) {
      bestKm = km
      best = it
    }
  }
  return best ? { item: best, km: bestKm } : null
}

/** Items within radiusKm, each with its distance. */
export function within<T extends { lat: number; lon: number }>(
  items: T[],
  lat: number,
  lon: number,
  radiusKm: number,
): { item: T; km: number }[] {
  const dLat = radiusKm / 111.32
  const dLon = radiusKm / (111.32 * Math.cos(toRad(lat)))
  const out: { item: T; km: number }[] = []
  for (const it of items) {
    if (Math.abs(it.lat - lat) > dLat || Math.abs(it.lon - lon) > dLon) continue
    const km = haversineKm(lat, lon, it.lat, it.lon)
    if (km <= radiusKm) out.push({ item: it, km })
  }
  return out
}

/** Ray-casting point-in-ring test. Rings are [lon, lat] pairs (GeoJSON order). */
function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Point in a polygon given as [outer, ...holes]. */
export function inPolygon(lon: number, lat: number, rings: Ring[]): boolean {
  if (!rings.length || !inRing(lon, lat, rings[0])) return false
  for (let h = 1; h < rings.length; h++) if (inRing(lon, lat, rings[h])) return false
  return true
}
