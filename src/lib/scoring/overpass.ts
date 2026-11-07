import { haversineKm, type LatLon } from "./geo";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

type OverpassElement = {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
};

export type NearestFeature = {
  distanceKm: number;
  name: string;
  tags: Record<string, string>;
  point: LatLon;
};

async function runOverpassQuery(
  query: string,
  timeoutMs = 12000,
): Promise<OverpassElement[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "User-Agent": "corkathon-2026-data-center-site-finder (hackathon project)",
      },
      body: query,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Overpass responded ${response.status}`);
    }

    const data = (await response.json()) as { elements: OverpassElement[] };
    return data.elements ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

function elementPoints(element: OverpassElement): LatLon[] {
  if (element.type === "node" && element.lat != null && element.lon != null) {
    return [{ lat: element.lat, lon: element.lon }];
  }
  if (element.geometry) {
    return element.geometry
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => ({ lat: p.lat, lon: p.lon }));
  }
  return [];
}

function featureName(tags: Record<string, string> | undefined): string {
  return tags?.name ?? tags?.["operator"] ?? "Unnamed feature";
}

/**
 * Queries Overpass for elements matching `selector` within `radiusMeters` of
 * `origin`, and returns up to `limit` of them sorted by distance (distance
 * measured to the nearest vertex of each returned way/node — an
 * approximation, not true nearest-point-on-line, but accurate enough at
 * these radii). Near-duplicate hits (e.g. two segments of the same river)
 * within 500m of an already-selected feature are skipped.
 */
export async function nearestOverpassFeatures(
  origin: LatLon,
  selector: string,
  radiusMeters: number,
  limit: number,
): Promise<NearestFeature[]> {
  const query = `
    [out:json][timeout:10];
    (
      ${selector
        .split(";")
        .filter(Boolean)
        .map(
          (clause) =>
            `${clause.trim()}(around:${radiusMeters},${origin.lat},${origin.lon});`,
        )
        .join("\n")}
    );
    out geom;
  `;

  const elements = await runOverpassQuery(query);

  const candidates: NearestFeature[] = [];

  for (const element of elements) {
    let closestPoint: LatLon | null = null;
    let closestDistance = Infinity;

    for (const point of elementPoints(element)) {
      const distanceKm = haversineKm(origin, point);
      if (distanceKm < closestDistance) {
        closestDistance = distanceKm;
        closestPoint = point;
      }
    }

    if (closestPoint) {
      candidates.push({
        distanceKm: closestDistance,
        name: featureName(element.tags),
        tags: element.tags ?? {},
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

export async function nearestOverpassFeature(
  origin: LatLon,
  selector: string,
  radiusMeters: number,
): Promise<NearestFeature | null> {
  const [closest] = await nearestOverpassFeatures(
    origin,
    selector,
    radiusMeters,
    1,
  );
  return closest ?? null;
}
