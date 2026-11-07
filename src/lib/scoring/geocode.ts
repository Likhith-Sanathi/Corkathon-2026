const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export type GeocodeResult = {
  displayName: string;
  lat: number;
  lon: number;
  country: string | null;
};

/**
 * Forward-geocodes a free-text place name via Nominatim. Shared by
 * /api/geocode and the chatbot's site_score tool so there's one place that
 * knows to request English names (the Ember power-mix lookup and the
 * Netherlands-local-data check both key off English country names).
 */
export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "corkathon-2026-data-center-site-finder (hackathon project)",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return null;

  const results = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    address?: { country?: string };
  }>;

  if (results.length === 0) return null;

  const [result] = results;
  return {
    displayName: result.display_name,
    lat: Number(result.lat),
    lon: Number(result.lon),
    country: result.address?.country ?? null,
  };
}
