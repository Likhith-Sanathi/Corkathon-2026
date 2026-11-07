import { geocodePlace } from "@/lib/scoring/geocode";
import { scoreSite } from "@/lib/scoring";
import { findBestSites, gridSizeFor, MAX_GRID_POINTS, type BoundingBox } from "@/lib/scoring/search";

const KM_PER_DEGREE_LAT = 111;

// JSON-schema tool definitions in OpenAI/OpenRouter's "function calling"
// shape. Keep descriptions specific — the model only knows what to do with
// each tool from these strings, there's no other prompt describing them.
export const CHAT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "score_site",
      description:
        "Scores a single named place in Europe (city, town, or region) as a " +
        "data center site, using live evidence: isolation from population " +
        "centers, water availability, power grid access (including the host " +
        "country's generation mix), climate/cooling cost, and natural " +
        "disaster risk. Returns a weighted overall score (0-100) plus the " +
        "evidence behind each factor. Use this when the user asks about a " +
        "specific place.",
      parameters: {
        type: "object",
        properties: {
          place: {
            type: "string",
            description: 'A place name, e.g. "Vantaa, Finland" or "Galway, Ireland".',
          },
        },
        required: ["place"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_best_sites",
      description:
        "Scans a grid of candidate coordinates around a named region " +
        "(country, city, or area) in Europe and ranks them as data center " +
        "sites using the same scoring as score_site. Returns the top " +
        "candidate coordinates with their scores. Use this when the user " +
        "asks for the best place(s) in a region, not a single named site. " +
        "This is slow (scans multiple points) — only call it once per " +
        "question unless the user asks to compare regions.",
      parameters: {
        type: "object",
        properties: {
          region: {
            type: "string",
            description: 'A region to search around, e.g. "Sweden" or "northern Spain".',
          },
          radiusKm: {
            type: "number",
            description: "Search radius in km around the region's center. Default 100, max 300.",
          },
        },
        required: ["region"],
      },
    },
  },
];

type ToolCall = { name: string; arguments: Record<string, unknown> };

export type ToolResult = {
  name: string;
  content: string;
};

async function runScoreSite(args: Record<string, unknown>): Promise<string> {
  const place = typeof args.place === "string" ? args.place : null;
  if (!place) return JSON.stringify({ error: "Missing 'place' argument" });

  const located = await geocodePlace(place);
  if (!located) {
    return JSON.stringify({ error: `Could not find "${place}" on the map.` });
  }

  const score = await scoreSite({ lat: located.lat, lon: located.lon }, located.country);

  return JSON.stringify({
    place: located.displayName,
    lat: located.lat,
    lon: located.lon,
    country: located.country,
    overallScore: score.overallScore,
    confidence: score.confidence,
    factors: score.factors.map((f) => ({
      key: f.key,
      title: f.title,
      score: f.score,
      summary: f.summary,
      source: f.source,
    })),
  });
}

async function runFindBestSites(args: Record<string, unknown>): Promise<string> {
  const region = typeof args.region === "string" ? args.region : null;
  if (!region) return JSON.stringify({ error: "Missing 'region' argument" });

  const radiusKm = Math.min(
    typeof args.radiusKm === "number" && args.radiusKm > 0 ? args.radiusKm : 100,
    300,
  );

  const center = await geocodePlace(region);
  if (!center) {
    return JSON.stringify({ error: `Could not find "${region}" on the map.` });
  }

  const latDelta = radiusKm / KM_PER_DEGREE_LAT;
  const lonDelta =
    radiusKm / (KM_PER_DEGREE_LAT * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.1));

  const bbox: BoundingBox = {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLon: center.lon - lonDelta,
    maxLon: center.lon + lonDelta,
  };

  let stepKm = 25;
  while (gridSizeFor(bbox, stepKm) > MAX_GRID_POINTS) {
    stepKm += 10;
  }

  const result = await findBestSites(bbox, { stepKm, topN: 5 });

  return JSON.stringify({
    searchedAround: center.displayName,
    radiusKm,
    gridPoints: result.gridPoints,
    scoredOnLand: result.scoredOnLand,
    candidates: result.candidates.map((c) => ({
      lat: Number(c.lat.toFixed(4)),
      lon: Number(c.lon.toFixed(4)),
      country: c.country,
      overallScore: Math.round(c.overallScore),
      confidence: c.confidence,
    })),
  });
}

export async function executeTool(call: ToolCall): Promise<ToolResult> {
  try {
    const content =
      call.name === "score_site"
        ? await runScoreSite(call.arguments)
        : call.name === "find_best_sites"
          ? await runFindBestSites(call.arguments)
          : JSON.stringify({ error: `Unknown tool "${call.name}"` });

    return { name: call.name, content };
  } catch (error) {
    return {
      name: call.name,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : "Tool execution failed",
      }),
    };
  }
}
