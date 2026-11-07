import { clamp, type LatLon } from "./geo";
import type { FactorResult } from "./types";

const SEARCH_RADIUS_KM = 300;
const SEARCH_RADIUS_DEG = SEARCH_RADIUS_KM / 111; // rough km → degrees
const YEARS_OF_HISTORY = 20;

type EmscFeature = {
  properties: { mag: number; flynn_region?: string; time?: string };
  geometry: { coordinates: [number, number, number] };
};

async function fetchNearbyQuakes(origin: LatLon): Promise<EmscFeature[]> {
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - YEARS_OF_HISTORY);

  const url = new URL("https://www.seismicportal.eu/fdsnws/event/1/query");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", origin.lat.toString());
  url.searchParams.set("lon", origin.lon.toString());
  url.searchParams.set("maxradius", SEARCH_RADIUS_DEG.toFixed(2));
  url.searchParams.set("minmagnitude", "4.5");
  url.searchParams.set("start", startDate.toISOString().slice(0, 10));
  url.searchParams.set("limit", "100");

  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });

  // EMSC returns 204 with an empty body when nothing matches the query —
  // that's a successful "zero results", not an error.
  if (response.status === 204) return [];
  if (!response.ok) throw new Error(`EMSC responded ${response.status}`);

  const text = await response.text();
  if (!text) return [];

  const data = JSON.parse(text) as { features?: EmscFeature[] };
  return data.features ?? [];
}

async function fetchElevationMeters(origin: LatLon): Promise<number | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/elevation");
    url.searchParams.set("latitude", origin.lat.toString());
    url.searchParams.set("longitude", origin.lon.toString());

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;

    const data = (await response.json()) as { elevation?: number[] };
    return data.elevation?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function evaluateRisk(origin: LatLon): Promise<FactorResult> {
  let quakes: EmscFeature[] = [];
  let seismicFailed = false;

  try {
    quakes = await fetchNearbyQuakes(origin);
  } catch {
    seismicFailed = true;
  }

  const elevation = await fetchElevationMeters(origin);

  if (seismicFailed && elevation == null) {
    return {
      key: "risk",
      title: "Natural disaster risk",
      score: null,
      summary: "Could not reach the EMSC seismic or elevation services.",
      source: "EMSC Seismic Portal + Open-Meteo Elevation API",
      markers: [],
    };
  }

  const quakeCount = quakes.length;
  const byMagnitude = [...quakes].sort(
    (a, b) => b.properties.mag - a.properties.mag,
  );
  const strongest = byMagnitude[0] ?? null;
  const notableQuakes = byMagnitude.slice(0, 3);

  const seismicPenalty = Math.min(70, quakeCount * 6);
  const majorQuakeBonus =
    strongest && strongest.properties.mag >= 6 ? 20 : 0;

  const elevationPenalty =
    elevation == null ? 0 : elevation < 5 ? 20 : elevation < 15 ? 10 : 0;

  const score = clamp(
    100 - seismicPenalty - majorQuakeBonus - elevationPenalty,
    0,
    100,
  );

  const summaryParts = [
    seismicFailed
      ? "Seismic data unavailable."
      : `${quakeCount} earthquake${quakeCount === 1 ? "" : "s"} ≥ M4.5 within ${SEARCH_RADIUS_KM} km over the last ${YEARS_OF_HISTORY} years${
          strongest
            ? ` (strongest: M${strongest.properties.mag.toFixed(1)})`
            : ""
        }.`,
    elevation == null
      ? "Elevation data unavailable."
      : `Elevation ${elevation.toFixed(0)} m — ${
          elevation < 5
            ? "low-lying, elevated flood risk."
            : elevation < 15
              ? "modest elevation, some flood exposure."
              : "well above typical flood levels."
        }`,
  ];

  return {
    key: "risk",
    title: "Natural disaster risk",
    score,
    summary: summaryParts.join(" "),
    source: "EMSC Seismic Portal + Open-Meteo Elevation API",
    markers: notableQuakes.map((quake) => ({
      lat: quake.geometry.coordinates[1],
      lon: quake.geometry.coordinates[0],
      label: `M${quake.properties.mag.toFixed(1)} earthquake${
        quake.properties.flynn_region ? ` — ${quake.properties.flynn_region}` : ""
      }`,
      role: "risk" as const,
    })),
  };
}
