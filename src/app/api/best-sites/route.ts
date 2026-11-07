import { NextRequest, NextResponse } from "next/server";
import { findBestSites, gridSizeFor, MAX_GRID_POINTS } from "@/lib/scoring/search";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const minLat = Number(params.get("minLat"));
  const maxLat = Number(params.get("maxLat"));
  const minLon = Number(params.get("minLon"));
  const maxLon = Number(params.get("maxLon"));
  const stepKm = params.get("stepKm") ? Number(params.get("stepKm")) : 25;
  const topN = params.get("topN") ? Number(params.get("topN")) : 10;

  if (
    [minLat, maxLat, minLon, maxLon].some((n) => Number.isNaN(n)) ||
    minLat >= maxLat ||
    minLon >= maxLon
  ) {
    return NextResponse.json(
      { error: "Provide valid minLat, maxLat, minLon, maxLon (minLat < maxLat, minLon < maxLon)" },
      { status: 400 },
    );
  }

  const bbox = { minLat, maxLat, minLon, maxLon };
  const gridPoints = gridSizeFor(bbox, stepKm);

  if (gridPoints > MAX_GRID_POINTS) {
    return NextResponse.json(
      {
        error: `This bounding box at ${stepKm} km spacing would need ${gridPoints} grid points (max ${MAX_GRID_POINTS}). Increase stepKm or shrink the bounding box.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await findBestSites(bbox, { stepKm, topN });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 },
    );
  }
}
