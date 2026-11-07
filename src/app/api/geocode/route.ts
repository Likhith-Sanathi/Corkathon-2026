import { NextRequest, NextResponse } from "next/server";
import { geocodePlace } from "@/lib/scoring/geocode";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const result = await geocodePlace(q);

    if (!result) {
      return NextResponse.json({ error: "No match found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Geocoding service unavailable" },
      { status: 502 },
    );
  }
}
