import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "corkathon-2026-data-center-site-finder (hackathon project)",
    },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Geocoding service unavailable" },
      { status: 502 },
    );
  }

  const results = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    address?: { country?: string };
  }>;

  if (results.length === 0) {
    return NextResponse.json({ error: "No match found" }, { status: 404 });
  }

  const [result] = results;

  return NextResponse.json({
    displayName: result.display_name,
    lat: Number(result.lat),
    lon: Number(result.lon),
    country: result.address?.country ?? null,
  });
}
