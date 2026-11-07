import { clamp, type LatLon } from "./geo";
import { isInNetherlands, nearestLocalFeatures } from "./localdata/netherlands";
import { evaluateGridMix } from "./power-mix";
import type { FactorResult } from "./types";

// Beyond this, the cost of a new grid connection spur gets steep.
const MAX_USEFUL_DISTANCE_KM = 30;
const SEARCH_RADIUS_KM = 40;
const PINS_TO_SHOW = 3;
const LOCAL_SOURCE = "local Netherlands extract (Geofabrik/OpenStreetMap)";

// How much the country-level grid mix (size, fuel diversity, clean share,
// capacity trend — see power-mix.ts) can move the score relative to the
// site-level proximity to a substation/plant/line. Proximity dominates
// because a site with no nearby connection point isn't viable regardless of
// how strong the national grid is; the mix is a secondary differentiator
// between otherwise-similar sites.
const PROXIMITY_WEIGHT = 0.65;
const GRID_MIX_WEIGHT = 0.35;

function kindOf(tags: Record<string, string>): string {
  const power = tags.power ?? tags.kind;
  if (power === "substation") return "substation";
  if (power === "plant") return "power plant";
  return "transmission line";
}

export async function evaluatePower(
  origin: LatLon,
  country?: string | null,
): Promise<FactorResult> {
  const gridMix = country ? evaluateGridMix(country) : null;

  // No local OSM extract outside the Netherlands (the live Overpass fallback
  // was removed — it's unreachable in this environment). The Ember grid-mix
  // signal has no such dependency, so it's still reported where available
  // instead of dropping the factor to null outright.
  if (!isInNetherlands(origin, country)) {
    if (!gridMix) {
      return {
        key: "power",
        title: "Power grid access",
        score: null,
        summary:
          "No local dataset for this region yet — this demo currently only covers the Netherlands.",
        source: LOCAL_SOURCE,
        markers: [],
      };
    }
    return {
      key: "power",
      title: "Power grid access",
      score: clamp(gridMix.score, 0, 100),
      summary: `No site-level grid infrastructure data for this region yet (Netherlands-only dataset). ${gridMix.summary}`,
      source: "Ember generation data (country-level only)",
      markers: [],
    };
  }

  const combinedSource = gridMix ? `${LOCAL_SOURCE} + Ember generation data` : LOCAL_SOURCE;
  const nearestInfra = nearestLocalFeatures(
    origin,
    "power",
    ["substation", "plant", "line"],
    PINS_TO_SHOW,
  );

  if (nearestInfra.length === 0) {
    const score = gridMix ? clamp(gridMix.score * GRID_MIX_WEIGHT, 0, 100) : 0;
    return {
      key: "power",
      title: "Power grid access",
      score,
      summary: `No substation, plant, or transmission line found within ${SEARCH_RADIUS_KM} km.${gridMix ? ` ${gridMix.summary}` : ""}`,
      source: combinedSource,
      markers: [],
    };
  }

  const [nearest] = nearestInfra;
  const proximityScore = clamp(
    100 - (nearest.distanceKm / MAX_USEFUL_DISTANCE_KM) * 100,
    0,
    100,
  );
  const score = gridMix
    ? proximityScore * PROXIMITY_WEIGHT + gridMix.score * GRID_MIX_WEIGHT
    : proximityScore;

  return {
    key: "power",
    title: "Power grid access",
    score: clamp(score, 0, 100),
    summary: `Nearest ${kindOf(nearest.tags)} (${nearest.name}) is ${nearest.distanceKm.toFixed(1)} km away.${gridMix ? ` ${gridMix.summary}` : ""}`,
    source: combinedSource,
    markers: nearestInfra.map((infra) => ({
      lat: infra.point.lat,
      lon: infra.point.lon,
      label: `${kindOf(infra.tags)}: ${infra.name} (${infra.distanceKm.toFixed(1)} km)`,
      role: "power" as const,
    })),
  };
}
