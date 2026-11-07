import fs from "node:fs";
import path from "node:path";
import { haversineKm, type LatLon } from "../geo";
import type { NearestFeature } from "../overpass";

// Bounding box from netherlands-latest.osm.pbf's header — only used as a
// fallback when we don't know the resolved country name (the box also
// covers slivers of Belgium/Germany, so it's not accurate on its own).
const NL_BOUNDS = { minLat: 50.74, maxLat: 54.02, minLon: 2.93, maxLon: 7.24 };

const NL_COUNTRY_NAMES = new Set([
  "netherlands",
  "nederland",
  "the netherlands",
  "pays-bas",
  "niederlande",
  "paesi bassi",
  "países bajos",
]);

function isInNetherlandsBounds(origin: LatLon): boolean {
  return (
    origin.lat >= NL_BOUNDS.minLat &&
    origin.lat <= NL_BOUNDS.maxLat &&
    origin.lon >= NL_BOUNDS.minLon &&
    origin.lon <= NL_BOUNDS.maxLon
  );
}

/**
 * Prefers the country name Nominatim already resolved via its proper
 * country-boundary polygon (accurate at borders). Falls back to a bounding
 * box only when the caller has no country string to go on.
 */
export function isInNetherlands(origin: LatLon, country?: string | null): boolean {
  if (country) return NL_COUNTRY_NAMES.has(country.trim().toLowerCase());
  return isInNetherlandsBounds(origin);
}

type RawFeature = {
  points: [number, number][];
  name: string | null;
  kind: string;
};

type Dataset = "places" | "water" | "power";

const cache = new Map<Dataset, RawFeature[]>();

function loadDataset(dataset: Dataset): RawFeature[] {
  const cached = cache.get(dataset);
  if (cached) return cached;

  const filePath = path.join(
    process.cwd(),
    "src/lib/scoring/localdata",
    `netherlands-${dataset}.json`,
  );
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as RawFeature[];
  cache.set(dataset, raw);
  return raw;
}

/**
 * Same contract as nearestOverpassFeatures, but served from the locally
 * extracted Netherlands dataset instead of a live API call.
 */
export function nearestLocalFeatures(
  origin: LatLon,
  dataset: Dataset,
  kinds: string[],
  limit: number,
): NearestFeature[] {
  const features = loadDataset(dataset);
  const candidates: NearestFeature[] = [];

  for (const feature of features) {
    if (!kinds.includes(feature.kind)) continue;

    let closestPoint: LatLon | null = null;
    let closestDistance = Infinity;

    for (const [lat, lon] of feature.points) {
      const distanceKm = haversineKm(origin, { lat, lon });
      if (distanceKm < closestDistance) {
        closestDistance = distanceKm;
        closestPoint = { lat, lon };
      }
    }

    if (closestPoint) {
      candidates.push({
        distanceKm: closestDistance,
        name: feature.name ?? "Unnamed feature",
        tags: { kind: feature.kind },
        point: closestPoint,
      });
    }
  }

  candidates.sort((a, b) => a.distanceKm - b.distanceKm);

  const results: NearestFeature[] = [];
  for (const candidate of candidates) {
    const tooClose = results.some(
      (picked) => haversineKm(picked.point, candidate.point) < 0.5,
    );
    if (!tooClose) results.push(candidate);
    if (results.length >= limit) break;
  }

  return results;
}
