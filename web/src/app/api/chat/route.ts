import { geocodePlace } from "@/lib/geocode"
import { GRID_SPEC } from "@/lib/grid"
import { callOpenRouterWithTools, type OpenRouterMessage, type ToolDef } from "@/lib/llm-rank"
import { retrieve } from "@/lib/rag/retrieve"
import type { ScoreResult } from "@/lib/types"

const SYSTEM_PROMPT = `You are an assistant embedded in a data centre site-scoring tool for the Netherlands.
Answer using only the provided context — methodology notes about this tool, and, if given, the evidence
computed for the site the user currently has pinned.
Be concise and plain-language: the reader is a decision-maker, not a geospatial analyst.
Be honest about uncertainty — if the context doesn't cover something, say so rather than guessing.
Never invent numbers, formulas, or data sources that are not in the context.
If the user names or asks about a specific place, call show_place_on_map so the app can move the map
and drop a pin there, then continue your answer referencing it.`

const GOTO_PLACE_TOOL: ToolDef = {
  type: "function",
  function: {
    name: "show_place_on_map",
    description:
      "Moves the map to a named place in the Netherlands and drops a pin there so the user can see it. Call " +
      "this whenever the user names, asks about, or wants to see a specific place, town, city, or address — " +
      "even in passing (e.g. \"what about Groningen?\", \"show me Eindhoven\"). Do not call it for general " +
      "questions about the scoring methodology with no place named.",
    parameters: {
      type: "object",
      properties: {
        place: { type: "string", description: 'The place name as the user wrote it, e.g. "Groningen" or "Eindhoven".' },
      },
      required: ["place"],
    },
  },
}

const PAD_DEG = 0.5 // how far outside the NL grid bounds a geocode hit may land before we call it "out of coverage"

type SiteContext = Pick<ScoreResult, "municipality" | "province" | "lat" | "lon" | "score" | "factors" | "risks">

type Body = {
  message?: string
  history?: { role: "user" | "assistant"; content: string }[]
  site?: SiteContext
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

export async function POST(request: Request) {
  let body: Body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Body must be JSON: { message, history?, site? }" }, { status: 400 })
  }

  const message = body.message?.trim()
  if (!message) return Response.json({ error: "Provide a message." }, { status: 400 })

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

  const first = await callOpenRouterWithTools(baseMessages, [GOTO_PLACE_TOOL])
  if (!first) {
    return Response.json({ error: "Could not reach the chat service right now. Try again shortly." }, { status: 502 })
  }

  const call = first.toolCalls.find((c) => c.function.name === "show_place_on_map")
  if (!call) {
    return Response.json({ answer: first.content ?? "", sources, place: null })
  }

  let placeArg = ""
  try {
    placeArg = JSON.parse(call.function.arguments).place ?? ""
  } catch {
    // malformed tool arguments: fall through and tell the model the lookup failed
  }

  let place: { lat: number; lon: number; displayName: string } | null = null
  let toolResult: Record<string, string>
  if (!placeArg) {
    toolResult = { error: "No place name was given." }
  } else {
    const located = await geocodePlace(placeArg).catch(() => null)
    const { west, east, south, north } = GRID_SPEC
    if (!located) {
      toolResult = { error: `Could not find "${placeArg}" on the map.` }
    } else if (located.lat < south - PAD_DEG || located.lat > north + PAD_DEG || located.lon < west - PAD_DEG || located.lon > east + PAD_DEG) {
      toolResult = { error: `"${located.displayName}" is outside the Netherlands, the only area this tool covers.` }
    } else {
      place = { lat: located.lat, lon: located.lon, displayName: located.displayName }
      toolResult = { movedMapTo: located.displayName, lat: String(located.lat), lon: String(located.lon) }
    }
  }

  const second = await callOpenRouterWithTools([
    ...baseMessages,
    { role: "assistant", content: first.content, tool_calls: first.toolCalls },
    { role: "tool", tool_call_id: call.id, content: JSON.stringify(toolResult) },
  ])

  const answer = second?.content ?? (place ? `Moved the map to ${place.displayName}.` : `Couldn't find "${placeArg}" on the map.`)
  return Response.json({ answer, sources, place })
}
