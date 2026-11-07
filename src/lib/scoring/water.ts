import { clamp, type LatLon } from "./geo";
import { nearestOverpassFeatures } from "./overpass";
import { isInNetherlands, nearestLocalFeatures } from "./localdata/netherlands";
import type { FactorResult } from "./types";

// Beyond this, piping cooling water to the site gets impractical.
const MAX_USEFUL_DISTANCE_KM = 20;
const SEARCH_RADIUS_M = 30_000;
const PINS_TO_SHOW = 3;

function kindOf(tags: Record<string, string>): string {
  const waterway = tags.waterway ?? tags.kind;
  if (waterway === "river") return "river";
  if (waterway === "canal") return "canal";
  return "lake";
}

export async function evaluateWater(origin: LatLon, country?: string | null): Promise<FactorResult> {
  const source = isInNetherlands(origin, country)
    ? "local Netherlands extract (Geofabrik/OpenStreetMap)"
    : "OpenStreetMap (Overpass API)";

  try {
    const nearestWaters = isInNetherlands(origin, country)
      ? nearestLocalFeatures(
          origin,
          "water",
          ["river", "canal", "lake"],
          PINS_TO_SHOW,
        )
      : await nearestOverpassFeatures(
          origin,
          'way["natural"="water"];way["waterway"="river"];way["waterway"="canal"]',
          SEARCH_RADIUS_M,
          PINS_TO_SHOW,
        );

    if (nearestWaters.length === 0) {
      return {
        key: "water",
        title: "Water availability",
        score: 0,
        summary: `No river, canal, or lake found within ${SEARCH_RADIUS_M / 1000} km.`,
        source,
        markers: [],
      };
    }

    const [nearest] = nearestWaters;
    const score = clamp(
      100 - (nearest.distanceKm / MAX_USEFUL_DISTANCE_KM) * 100,
      0,
      100,
    );

    return {
      key: "water",
      title: "Water availability",
      score,
      summary: `Nearest ${kindOf(nearest.tags)} (${nearest.name}) is ${nearest.distanceKm.toFixed(1)} km away.`,
      source,
      markers: nearestWaters.map((water) => ({
        lat: water.point.lat,
        lon: water.point.lon,
        label: `${kindOf(water.tags)}: ${water.name} (${water.distanceKm.toFixed(1)} km)`,
        role: "water" as const,
      })),
    };
  } catch {
    return {
      key: "water",
      title: "Water availability",
      score: null,
      summary: "Could not reach OpenStreetMap's Overpass API.",
      source,
      markers: [],
    };
  }
}
