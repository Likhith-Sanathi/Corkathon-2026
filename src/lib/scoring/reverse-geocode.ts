import type { LatLon } from "./geo";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

export type ReverseGeocodeResult = {
  country: string | null;
  displayName: string | null;
};

/**
 * Resolves a point to a country name via Nominatim's reverse endpoint.
 * Doubles as a land/sea check for grid search: Nominatim returns an
 * "Unable to geocode" error (not an HTTP error — still a 200) for points
 * over open water, which surfaces here as `country: null`.
 */
export async function reverseGeocode(
  point: LatLon,
): Promise<ReverseGeocodeResult> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("lat", point.lat.toString());
  url.searchParams.set("lon", point.lon.toString());
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "3");
  url.searchParams.set("addressdetails", "1");
  // English, so the resolved country lines up with the Ember dataset's
  // "Area" names (and the Netherlands-local-data country check) rather
  // than whatever local-language name Nominatim would default to.
  url.searchParams.set("accept-language", "en");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "corkathon-2026-data-center-site-finder (hackathon project)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return { country: null, displayName: null };

    const data = (await response.json()) as {
      display_name?: string;
      address?: { country?: string };
      error?: string;
    };

    if (!data.address?.country) {
      return { country: null, displayName: data.display_name ?? null };
    }

    return { country: data.address.country, displayName: data.display_name ?? null };
  } catch {
    return { country: null, displayName: null };
  }
}
