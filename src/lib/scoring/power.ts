import { clamp, type LatLon } from "./geo";
import { nearestOverpassFeatures } from "./overpass";
import { isInNetherlands, nearestLocalFeatures } from "./localdata/netherlands";
import type { FactorResult } from "./types";

// Beyond this, the cost of a new grid connection spur gets steep.
const MAX_USEFUL_DISTANCE_KM = 30;
const SEARCH_RADIUS_M = 40_000;
const PINS_TO_SHOW = 3;

function kindOf(tags: Record<string, string>): string {
  const power = tags.power ?? tags.kind;
  if (power === "substation") return "substation";
  if (power === "plant") return "power plant";
  return "transmission line";
}

export async function evaluatePower(origin: LatLon, country?: string | null): Promise<FactorResult> {
  const source = isInNetherlands(origin, country)
    ? "local Netherlands extract (Geofabrik/OpenStreetMap)"
    : "OpenStreetMap (Overpass API)";

  try {
    const nearestInfra = isInNetherlands(origin, country)
      ? nearestLocalFeatures(
          origin,
          "power",
          ["substation", "plant", "line"],
          PINS_TO_SHOW,
        )
      : await nearestOverpassFeatures(
          origin,
          'node["power"="substation"];way["power"="substation"];node["power"="plant"];way["power"="plant"];way["power"="line"]',
          SEARCH_RADIUS_M,
          PINS_TO_SHOW,
        );

    if (nearestInfra.length === 0) {
      return {
        key: "power",
        title: "Power grid access",
        score: 0,
        summary: `No substation, plant, or transmission line found within ${SEARCH_RADIUS_M / 1000} km.`,
        source,
        markers: [],
      };
    }

    const [nearest] = nearestInfra;
    const score = clamp(
      100 - (nearest.distanceKm / MAX_USEFUL_DISTANCE_KM) * 100,
      0,
      100,
    );

    return {
      key: "power",
      title: "Power grid access",
      score,
      summary: `Nearest ${kindOf(nearest.tags)} (${nearest.name}) is ${nearest.distanceKm.toFixed(1)} km away.`,
      source,
      markers: nearestInfra.map((infra) => ({
        lat: infra.point.lat,
        lon: infra.point.lon,
        label: `${kindOf(infra.tags)}: ${infra.name} (${infra.distanceKm.toFixed(1)} km)`,
        role: "power" as const,
      })),
    };
  } catch {
    return {
      key: "power",
      title: "Power grid access",
      score: null,
      summary: "Could not reach OpenStreetMap's Overpass API.",
      source,
      markers: [],
    };
  }
}
