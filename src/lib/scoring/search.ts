import { haversineKm, type LatLon } from "./geo";
import { scoreSite } from "./index";
import { reverseGeocode } from "./reverse-geocode";
import type { FactorResult } from "./types";

export type BoundingBox = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

export type SiteCandidate = {
  lat: number;
  lon: number;
  country: string | null;
  overallScore: number;
  confidence: number;
  factors: Pick<FactorResult, "key" | "title" | "score" | "summary">[];
};

export type FindBestSitesResult = {
  candidates: SiteCandidate[];
  gridPoints: number;
  scoredOnLand: number;
};

// A full scan has to reverse-geocode every point sequentially (Nominatim's
// usage policy caps bulk lookups at ~1 req/sec) plus score every land point
// with its own handful of API calls — that's minutes of wall-clock time for
// even a modest grid, so the grid size is capped well below "scan all of
// Europe at high resolution".
const MAX_GRID_POINTS = 60;
const NOMINATIM_DELAY_MS = 1100;
const SCORE_CONCURRENCY = 4;

export function generateGrid(bbox: BoundingBox, stepKm: number): LatLon[] {
  const points: LatLon[] = [];
  const latStepDeg = stepKm / 111;
  const midLatRad = ((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180);
  const lonStepDeg = stepKm / (111 * Math.max(Math.cos(midLatRad), 0.1));

  if (latStepDeg <= 0 || lonStepDeg <= 0) return points;

  for (let lat = bbox.minLat; lat <= bbox.maxLat; lat += latStepDeg) {
    for (let lon = bbox.minLon; lon <= bbox.maxLon; lon += lonStepDeg) {
      points.push({ lat, lon });
    }
  }
  return points;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

export type FindBestSitesOptions = {
  stepKm?: number;
  topN?: number;
};

export function gridSizeFor(bbox: BoundingBox, stepKm: number): number {
  return generateGrid(bbox, stepKm).length;
}

export { MAX_GRID_POINTS };

/**
 * Scans a bounding box on a regular grid and scores every point that
 * resolves to land, returning the top candidates by overall score. The
 * country resolved for each point (via reverse geocoding) is passed into
 * `scoreSite` so the power factor can fold in that country's grid mix.
 */
export async function findBestSites(
  bbox: BoundingBox,
  options: FindBestSitesOptions = {},
): Promise<FindBestSitesResult> {
  const stepKm = options.stepKm ?? 25;
  const topN = options.topN ?? 10;

  const grid = generateGrid(bbox, stepKm);
  if (grid.length === 0) {
    return { candidates: [], gridPoints: 0, scoredOnLand: 0 };
  }
  if (grid.length > MAX_GRID_POINTS) {
    throw new Error(
      `Bounding box at ${stepKm} km spacing has ${grid.length} grid points ` +
        `(max ${MAX_GRID_POINTS}). Use a larger stepKm or a smaller bounding box.`,
    );
  }

  const located: { point: LatLon; country: string | null }[] = [];
  for (const point of grid) {
    const { country } = await reverseGeocode(point);
    if (country) located.push({ point, country });
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_DELAY_MS));
  }

  const scoredPoints = await mapWithConcurrency(
    located,
    SCORE_CONCURRENCY,
    async ({ point, country }) => {
      const result = await scoreSite(point, country);
      return { point, country, result };
    },
  );

  const ranked: SiteCandidate[] = scoredPoints
    .filter(
      (entry): entry is typeof entry & { result: { overallScore: number } } =>
        entry.result.overallScore != null,
    )
    .map((entry) => ({
      lat: entry.point.lat,
      lon: entry.point.lon,
      country: entry.country,
      overallScore: entry.result.overallScore,
      confidence: entry.result.confidence,
      factors: entry.result.factors.map((f) => ({
        key: f.key,
        title: f.title,
        score: f.score,
        summary: f.summary,
      })),
    }))
    .sort((a, b) => b.overallScore - a.overallScore);

  // Skip candidates too close to one already picked — adjacent grid cells
  // with similar scores shouldn't all surface as distinct "best" sites.
  const minSeparationKm = stepKm * 0.75;
  const candidates: SiteCandidate[] = [];
  for (const candidate of ranked) {
    const tooClose = candidates.some(
      (picked) => haversineKm(picked, candidate) < minSeparationKm,
    );
    if (!tooClose) candidates.push(candidate);
    if (candidates.length >= topN) break;
  }

  return { candidates, gridPoints: grid.length, scoredOnLand: located.length };
}
