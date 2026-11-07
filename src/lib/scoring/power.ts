import { clamp, type LatLon } from "./geo";
import { isInNetherlands, nearestLocalFeatures } from "./localdata/netherlands";
import type { FactorResult } from "./types";

// Beyond this, the cost of a new grid connection spur gets steep.
const MAX_USEFUL_DISTANCE_KM = 30;
const SEARCH_RADIUS_KM = 40;
const PINS_TO_SHOW = 3;
const SOURCE = "local Netherlands extract (Geofabrik/OpenStreetMap)";

function kindOf(tags: Record<string, string>): string {
  const power = tags.power ?? tags.kind;
  if (power === "substation") return "substation";
  if (power === "plant") return "power plant";
  return "transmission line";
}

export async function evaluatePower(origin: LatLon, country?: string | null): Promise<FactorResult> {
  if (!isInNetherlands(origin, country)) {
    return {
      key: "power",
      title: "Power grid access",
      score: null,
      summary:
        "No local dataset for this region yet — this demo currently only covers the Netherlands.",
      source: SOURCE,
      markers: [],
    };
  }

  const nearestInfra = nearestLocalFeatures(
    origin,
    "power",
    ["substation", "plant", "line"],
    PINS_TO_SHOW,
  );

  if (nearestInfra.length === 0) {
    return {
      key: "power",
      title: "Power grid access",
      score: 0,
      summary: `No substation, plant, or transmission line found within ${SEARCH_RADIUS_KM} km.`,
      source: SOURCE,
      markers: [],
    };
  }

  const [nearest] = nearestInfra;
  const score = clamp(100 - (nearest.distanceKm / MAX_USEFUL_DISTANCE_KM) * 100, 0, 100);

  return {
    key: "power",
    title: "Power grid access",
    score,
    summary: `Nearest ${kindOf(nearest.tags)} (${nearest.name}) is ${nearest.distanceKm.toFixed(1)} km away.`,
    source: SOURCE,
    markers: nearestInfra.map((infra) => ({
      lat: infra.point.lat,
      lon: infra.point.lon,
      label: `${kindOf(infra.tags)}: ${infra.name} (${infra.distanceKm.toFixed(1)} km)`,
      role: "power" as const,
    })),
  };
}
