import { callOpenRouter, type ChatMessage } from "@/lib/llm-rank"
import { retrieve } from "@/lib/rag/retrieve"
import type { ScoreResult } from "@/lib/types"

const SYSTEM_PROMPT = `You are an assistant embedded in a data centre site-scoring tool for the Netherlands.
Answer using only the provided context — methodology notes about this tool, and, if given, the evidence
computed for the site the user currently has pinned.
Be concise and plain-language: the reader is a decision-maker, not a geospatial analyst.
Be honest about uncertainty — if the context doesn't cover something, say so rather than guessing.
Never invent numbers, formulas, or data sources that are not in the context.`

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
  const knowledge = docs.map((d) => `### ${d.title}\n${d.text}`).join("\n\n")
  const siteNote = body.site ? formatSiteContext(body.site) : ""
  const context = [siteNote, knowledge].filter(Boolean).join("\n\n") || "No matching context found in the knowledge base."

  const history: ChatMessage[] = (body.history ?? []).slice(-6).map((h) => ({ role: h.role, content: h.content }))

  const answer = await callOpenRouter([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Context:\n${context}` },
    ...history,
    { role: "user", content: message },
  ])

  if (!answer) {
    return Response.json({ error: "Could not reach the chat service right now. Try again shortly." }, { status: 502 })
  }
  return Response.json({ answer, sources: docs.map((d) => d.title) })
}
