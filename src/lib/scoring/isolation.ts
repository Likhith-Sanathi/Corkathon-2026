import { clamp, type LatLon } from "./geo";
import { isInNetherlands, nearestLocalFeatures } from "./localdata/netherlands";
import type { FactorResult } from "./types";

// Beyond this distance from a real city, extra isolation stops adding value —
// you still need roads and workers within reach.
const MAX_USEFUL_DISTANCE_KM = 50;
const SEARCH_RADIUS_KM = 80;
const PINS_TO_SHOW = 3;
const SOURCE = "local Netherlands extract (Geofabrik/OpenStreetMap)";

export async function evaluateIsolation(origin: LatLon, country?: string | null): Promise<FactorResult> {
  if (!isInNetherlands(origin, country)) {
    return {
      key: "isolation",
      title: "Isolation",
      score: null,
      summary:
        "No local dataset for this region yet — this demo currently only covers the Netherlands.",
      source: SOURCE,
      markers: [],
    };
  }

  const nearestCities = nearestLocalFeatures(
    origin,
    "places",
    ["city", "town"],
    PINS_TO_SHOW,
  );

  if (nearestCities.length === 0) {
    return {
      key: "isolation",
      title: "Isolation",
      score: 100,
      summary: `No city or town found within ${SEARCH_RADIUS_KM} km — highly isolated.`,
      source: SOURCE,
      markers: [],
    };
  }

  const [nearest] = nearestCities;
  const score = clamp((nearest.distanceKm / MAX_USEFUL_DISTANCE_KM) * 100, 0, 100);

  return {
    key: "isolation",
    title: "Isolation",
    score,
    summary: `Nearest city/town is ${nearest.name}, ${nearest.distanceKm.toFixed(1)} km away.`,
    source: SOURCE,
    markers: nearestCities.map((city) => ({
      lat: city.point.lat,
      lon: city.point.lon,
      label: `${city.name} (${city.distanceKm.toFixed(1)} km)`,
      role: "isolation" as const,
    })),
  };
}
