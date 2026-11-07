import { clamp, type LatLon } from "./geo";
import { nearestOverpassFeatures } from "./overpass";
import { isInNetherlands, nearestLocalFeatures } from "./localdata/netherlands";
import type { FactorResult } from "./types";

// Beyond this distance from a real city, extra isolation stops adding value —
// you still need roads and workers within reach.
const MAX_USEFUL_DISTANCE_KM = 50;
const SEARCH_RADIUS_M = 80_000;
const PINS_TO_SHOW = 3;

export async function evaluateIsolation(origin: LatLon, country?: string | null): Promise<FactorResult> {
  const source = isInNetherlands(origin, country)
    ? "local Netherlands extract (Geofabrik/OpenStreetMap)"
    : "OpenStreetMap (Overpass API)";

  try {
    const nearestCities = isInNetherlands(origin, country)
      ? nearestLocalFeatures(origin, "places", ["city", "town"], PINS_TO_SHOW)
      : await nearestOverpassFeatures(
          origin,
          'node["place"~"^(city|town)$"]',
          SEARCH_RADIUS_M,
          PINS_TO_SHOW,
        );

    if (nearestCities.length === 0) {
      return {
        key: "isolation",
        title: "Isolation",
        score: 100,
        summary: `No city or town found within ${SEARCH_RADIUS_M / 1000} km — highly isolated.`,
        source,
        markers: [],
      };
    }

    const [nearest] = nearestCities;
    const score = clamp(
      (nearest.distanceKm / MAX_USEFUL_DISTANCE_KM) * 100,
      0,
      100,
    );

    return {
      key: "isolation",
      title: "Isolation",
      score,
      summary: `Nearest city/town is ${nearest.name}, ${nearest.distanceKm.toFixed(1)} km away.`,
      source,
      markers: nearestCities.map((city) => ({
        lat: city.point.lat,
        lon: city.point.lon,
        label: `${city.name} (${city.distanceKm.toFixed(1)} km)`,
        role: "isolation" as const,
      })),
    };
  } catch {
    return {
      key: "isolation",
      title: "Isolation",
      score: null,
      summary: "Could not reach OpenStreetMap's Overpass API.",
      source,
      markers: [],
    };
  }
}
