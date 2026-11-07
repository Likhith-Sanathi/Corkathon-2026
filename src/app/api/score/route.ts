import { NextRequest, NextResponse } from "next/server";
import { scoreSite } from "@/lib/scoring";

export async function GET(request: NextRequest) {
  const latParam = request.nextUrl.searchParams.get("lat");
  const lonParam = request.nextUrl.searchParams.get("lon");

  const lat = Number(latParam);
  const lon = Number(lonParam);

  if (!latParam || !lonParam || Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json(
      { error: "Missing or invalid lat/lon" },
      { status: 400 },
    );
  }

  const country = request.nextUrl.searchParams.get("country");
  const score = await scoreSite({ lat, lon }, country);

  return NextResponse.json(score);
}
