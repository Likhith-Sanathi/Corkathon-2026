import { geocodePlace } from "@/lib/geocode"
import { haversineKm } from "@/lib/geo"
import { GRID_SPEC } from "@/lib/grid"
import { gridScorer } from "@/lib/grid-search"
import { callOpenRouterWithTools, type OpenRouterMessage, type ToolDef } from "@/lib/llm-rank"
import { retrieve } from "@/lib/rag/retrieve"
import { DEFAULT_WEIGHTS, scoreLocation } from "@/lib/scoring"
import { loadDataset } from "@/lib/server-data"
import type { ListingProps, ScoreResult, Weights } from "@/lib/types"

const SYSTEM_PROMPT = `You are an assistant embedded in a data centre site-scoring tool for the Netherlands.
Answer using only the provided context — methodology notes about this tool, and, if given, the evidence
computed for the site the user currently has pinned.
Be concise and plain-language: the reader is a decision-maker, not a geospatial analyst.
Be honest about uncertainty — if the context doesn't cover something, say so rather than guessing.
Never invent numbers, scores, prices, or place names — only state ones that came from a tool result or
the provided context.

You have two tools for moving the map. Use at most one per reply:
- show_place_on_map: the user named one specific, already-decided place and just wants to see it.
- find_best_plot: the user wants the BEST site/plot — "anywhere", "within budget", "near X", "what do you
  recommend" — anything where you need to search and rank, not just look up a named place. This is almost
  always the right tool when no single place has been decided yet, including follow-ups like "anywhere but
  within my budget" after you already showed one place. Never answer a "find the best" question from the
  show_place_on_map result alone — its result has no score, only coordinates.`

const GOTO_PLACE_TOOL: ToolDef = {
  type: "function",
  function: {
    name: "show_place_on_map",
    description:
      "Moves the map to a single, already-named place in the Netherlands and drops a pin there — a plain " +
      "lookup with no scoring or ranking. Call this only when the user names one specific place they've " +
      'already decided on (e.g. "show me Eindhoven"). For anything involving "best", "anywhere", or a ' +
      "budget, use find_best_plot instead.",
    parameters: {
      type: "object",
      properties: {
        place: { type: "string", description: 'The place name as the user wrote it, e.g. "Groningen" or "Eindhoven".' },
      },
      required: ["place"],
    },
  },
}

const FIND_BEST_PLOT_TOOL: ToolDef = {
  type: "function",
  function: {
    name: "find_best_plot",
    description:
      "Searches real plots for sale and ranks them by the user's current factor weights, returning each " +
      "plot's actual computed score, size and asking price. Searches the whole Netherlands by default, or " +
      'near a named place if one is given. Use this for "best", "anywhere", "within my budget", or any ' +
      "request to find or recommend a site rather than just look one up.",
    parameters: {
      type: "object",
      properties: {
        near: { type: "string", description: "Optional place name to centre the search on. Omit to search all of the Netherlands." },
        radiusKm: { type: "number", description: "Search radius in km around 'near'. Default 30; only used if 'near' is given." },
        maxPriceEur: { type: "number", description: "Optional maximum total asking price in euros, e.g. 1000000 for a €1M budget." },
      },
    },
  },
}

const PAD_DEG = 0.5 // how far outside the NL grid bounds a geocode hit may land before we call it "out of coverage"
const CANDIDATE_POOL = 25 // plots re-scored exactly after the fast grid pre-rank
const TOP_N = 3

type SiteContext = Pick<ScoreResult, "municipality" | "province" | "lat" | "lon" | "score" | "factors" | "risks">

type Body = {
  message?: string
  history?: { role: "user" | "assistant"; content: string }[]
  site?: SiteContext
  weights?: Partial<Record<keyof Weights, unknown>>
}

function formatSiteContext(site: SiteContext): string {
  const factors = site.factors.map((f) => `${f.key} ${Math.round(f.score * 100)}/100 (${Math.round(f.weight * 100)}% weight)`).join(", ")
  const risks = site.risks.map((r) => `${r.key} ×${r.multiplier.toFixed(2)}`).join(", ")
  return [
    `Site currently pinned: ${site.municipality}, ${site.province} (${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}).`,
    `Overall score: ${site.score}/100.`,
    `Factors: ${factors}.`,
    `Risk multipliers: ${risks}.`,
  ].join("\n")
}

async function runGotoPlace(args: Record<string, unknown>) {
  const place = typeof args.place === "string" ? args.place.trim() : ""
  if (!place) return { result: { error: "No place name was given." }, located: null }

  const geo = await geocodePlace(place).catch(() => null)
  const { west, east, south, north } = GRID_SPEC
  if (!geo) return { result: { error: `Could not find "${place}" on the map.` }, located: null }
  if (geo.lat < south - PAD_DEG || geo.lat > north + PAD_DEG || geo.lon < west - PAD_DEG || geo.lon > east + PAD_DEG) {
    return { result: { error: `"${geo.displayName}" is outside the Netherlands, the only area this tool covers.` }, located: null }
  }
  return {
    result: { movedMapTo: geo.displayName, lat: geo.lat, lon: geo.lon },
    located: { lat: geo.lat, lon: geo.lon, displayName: geo.displayName },
  }
}

async function runFindBestPlot(args: Record<string, unknown>, weights: Weights) {
  const nearName = typeof args.near === "string" ? args.near.trim() : ""
  const radiusKm = Math.min(80, Math.max(5, Number(args.radiusKm) || 30))
  const maxPriceEur = Number(args.maxPriceEur) > 0 ? Number(args.maxPriceEur) : null

  let center: { lat: number; lon: number; displayName: string } | null = null
  if (nearName) {
    const geo = await geocodePlace(nearName).catch(() => null)
    const { west, east, south, north } = GRID_SPEC
    if (geo && geo.lat >= south - PAD_DEG && geo.lat <= north + PAD_DEG && geo.lon >= west - PAD_DEG && geo.lon <= east + PAD_DEG) {
      center = geo
    }
  }

  const data = await loadDataset()
  let forSale = (data.plots?.features ?? []).map((f) => f.properties).filter((p): p is ListingProps => p.status === "for_sale")
  if (center) forSale = forSale.filter((p) => haversineKm(center!.lat, center!.lon, p.lat, p.lon) <= radiusKm)
  if (maxPriceEur !== null) forSale = forSale.filter((p) => p.total <= maxPriceEur)

  if (forSale.length === 0) {
    const where = center ? `near ${center.displayName}` : "in the Netherlands"
    const under = maxPriceEur !== null ? ` under €${maxPriceEur.toLocaleString("en-GB")}` : ""
    return { result: { error: `No plots for sale ${where}${under}.` }, best: null }
  }

  const fast = await gridScorer(weights)
  const shortlist = forSale
    .map((p) => ({ p, fastScore: fast(p.lat, p.lon) ?? 0 }))
    .sort((a, b) => b.fastScore - a.fastScore)
    .slice(0, CANDIDATE_POOL)

  const scored = shortlist
    .map(({ p }) => ({ p, site: scoreLocation(data, p.lat, p.lon, weights) }))
    .filter((x): x is { p: ListingProps; site: ScoreResult } => x.site !== null)
    .sort((a, b) => b.site.score - a.site.score)
    .slice(0, TOP_N)

  const results = scored.map(({ p, site }) => ({
    municipality: p.municipality,
    businessPark: p.parkName,
    score: site.score,
    sizeHectares: Math.round(p.areaM2 / 100) / 100,
    askingPriceEur: p.total,
    askingPriceEurPerM2: p.perM2,
    lat: p.lat,
    lon: p.lon,
  }))

  const best = scored[0]
  return {
    result: { searchedPlots: forSale.length, results },
    best: best ? { lat: best.p.lat, lon: best.p.lon, displayName: `${best.p.parkName}, ${best.p.municipality}` } : null,
  }
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Body must be JSON: { message, history?, site?, weights? }" }, { status: 400 })
  }

  const message = body.message?.trim()
  if (!message) return Response.json({ error: "Provide a message." }, { status: 400 })

  const weights = { ...DEFAULT_WEIGHTS }
  for (const key of Object.keys(weights) as (keyof Weights)[]) {
    const v = Number(body.weights?.[key])
    if (Number.isFinite(v) && v >= 0) weights[key] = v
  }

  const docs = retrieve(message, 4)
  const sources = docs.map((d) => d.title)
  const knowledge = docs.map((d) => `### ${d.title}\n${d.text}`).join("\n\n")
  const siteNote = body.site ? formatSiteContext(body.site) : ""
  const context = [siteNote, knowledge].filter(Boolean).join("\n\n") || "No matching context found in the knowledge base."

  const history: OpenRouterMessage[] = (body.history ?? []).slice(-6).map((h) => ({ role: h.role, content: h.content }))

  const baseMessages: OpenRouterMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Context:\n${context}` },
    ...history,
    { role: "user", content: message },
  ]

  const first = await callOpenRouterWithTools(baseMessages, [GOTO_PLACE_TOOL, FIND_BEST_PLOT_TOOL])
  if (!first) {
    return Response.json({ error: "Could not reach the chat service right now. Try again shortly." }, { status: 502 })
  }

  const call = first.toolCalls[0]
  if (!call) {
    return Response.json({ answer: first.content ?? "", sources, place: null })
  }

  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(call.function.arguments)
  } catch {
    // malformed tool arguments: fall through with empty args, the handler reports the error itself
  }

  const { result, place } =
    call.function.name === "find_best_plot"
      ? await runFindBestPlot(args, weights).then(({ result, best }) => ({ result, place: best }))
      : await runGotoPlace(args).then(({ result, located }) => ({ result, place: located }))

  const second = await callOpenRouterWithTools([
    ...baseMessages,
    { role: "assistant", content: first.content, tool_calls: first.toolCalls },
    { role: "tool", tool_call_id: call.id, content: JSON.stringify(result) },
  ])

  const answer = second?.content ?? (place ? `Found it: ${place.displayName}.` : "Couldn't find a match for that.")
  return Response.json({ answer, sources, place })
}
