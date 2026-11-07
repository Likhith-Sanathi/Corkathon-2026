import "server-only"
import type { ScoreResult } from "./types"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
// Cheap, fast OpenAI model via OpenRouter. Override with OPENROUTER_MODEL.
const DEFAULT_MODEL = "openai/gpt-4o-mini"

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

/**
 * Calls the one LLM this app uses everywhere (gpt-4o-mini via OpenRouter). Returns null (never
 * throws past the caller) if no API key is configured or the call fails — every feature built on
 * this degrades to "no AI answer" rather than breaking.
 */
export async function callOpenRouter(messages: ChatMessage[], temperature = 0.3): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL, messages, temperature }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content?.trim() ?? null
  } catch {
    return null
  }
}

const RANKING_SYSTEM_PROMPT = `You help decision-makers compare plots of land for sale as data centre sites in the Netherlands.
You will be given a list of candidate plots that have already been scored by a deterministic model
(power grid access, isolation, telecom, water, roads, flood and seismic risk). Each plot also has a size,
an asking price and the business park it is in. Your job is to write a short, plain-language comparison
of the ranked list — not to re-score anything. The listings and prices are simulated demo data; refer to
them as listed or asking prices, never as verified market values.

Rules:
- Only use the facts given to you. Do not invent distances, place names, or numbers.
- Be honest about uncertainty: if two sites are close in score, say so instead of overstating the gap.
- Plain language for a non-technical decision-maker. No jargon, no bullet-point dump of raw numbers.
- 3-5 sentences total. Name the top plot by its business park and why it leads, then one notable
  trade-off among the rest (for example a cheaper or larger plot with a slightly lower score).`

/**
 * Asks an LLM (via OpenRouter) to summarise an already-ranked list of sites in plain language.
 * Returns null (never throws past the caller) if no API key is configured or the call fails —
 * the deterministic ranking and scores still stand on their own without this.
 */
export async function summariseRanking(query: string, sites: ScoreResult[]): Promise<string | null> {
  if (sites.length === 0) return null

  const payload = sites.map((s, i) => ({
    rank: i + 1,
    municipality: s.municipality,
    province: s.province,
    score: s.score,
    ...(s.plot?.listing && {
      plot: {
        businessPark: s.plot.listing.parkName,
        sizeHectares: Math.round(s.plot.listing.areaM2 / 100) / 100,
        askingPriceEurPerM2: s.plot.listing.perM2,
        askingPriceEur: s.plot.listing.total,
        status: s.plot.listing.status === "for_sale" ? "for sale" : "under offer",
      },
    }),
    factors: s.factors.map((f) => ({ key: f.key, score: Math.round(f.score * 100), evidence: f.evidence })),
    risks: s.risks.map((r) => ({ key: r.key, multiplier: r.multiplier, evidence: r.evidence })),
  }))

  return callOpenRouter([
    { role: "system", content: RANKING_SYSTEM_PROMPT },
    { role: "user", content: `Search: "${query}"\n\nRanked candidates (best first):\n${JSON.stringify(payload, null, 2)}` },
  ])
}
