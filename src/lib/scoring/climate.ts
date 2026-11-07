import { clamp, type LatLon } from "./geo";
import type { FactorResult } from "./types";

// 0°C annual average = best possible free-air-cooling climate (score 100).
// 25°C annual average = worst (score 0).
const COLD_ANCHOR_C = 0;
const HOT_ANCHOR_C = 25;

export async function evaluateClimate(origin: LatLon): Promise<FactorResult> {
  const year = new Date().getFullYear() - 1;
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", origin.lat.toString());
  url.searchParams.set("longitude", origin.lon.toString());
  url.searchParams.set("start_date", `${year}-01-01`);
  url.searchParams.set("end_date", `${year}-12-31`);
  url.searchParams.set("daily", "temperature_2m_mean");
  url.searchParams.set("timezone", "UTC");

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo responded ${response.status}`);
    }

    const data = (await response.json()) as {
      daily?: { temperature_2m_mean?: (number | null)[] };
    };

    const readings = (data.daily?.temperature_2m_mean ?? []).filter(
      (value): value is number => value != null,
    );

    if (readings.length === 0) {
      throw new Error("No temperature data returned");
    }

    const avgTemp =
      readings.reduce((sum, value) => sum + value, 0) / readings.length;

    const score = clamp(
      100 - ((avgTemp - COLD_ANCHOR_C) / (HOT_ANCHOR_C - COLD_ANCHOR_C)) * 100,
      0,
      100,
    );

    return {
      key: "climate",
      title: "Climate & cooling cost",
      score,
      summary: `Average temperature in ${year} was ${avgTemp.toFixed(1)}°C — ${
        avgTemp < 10
          ? "cold enough for extensive free-air cooling."
          : avgTemp < 18
            ? "moderate — some free-air cooling, some mechanical."
            : "warm — cooling will rely heavily on mechanical chillers."
      }`,
      source: "Open-Meteo Historical Weather API (ERA5)",
      markers: [],
    };
  } catch {
    return {
      key: "climate",
      title: "Climate & cooling cost",
      score: null,
      summary: "Could not reach the Open-Meteo climate API.",
      source: "Open-Meteo Historical Weather API (ERA5)",
      markers: [],
    };
  }
}
