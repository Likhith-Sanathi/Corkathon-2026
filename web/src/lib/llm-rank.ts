import "server-only"
import type { ScoreResult } from "./types"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
// Cheap, fast OpenAI model via OpenRouter. Override with OPENROUTER_MODEL.
const DEFAULT_MODEL = "openai/gpt-4o-mini"

const SYSTEM_PROMPT = `You help decision-makers compare candidate data centre sites in the Netherlands.
You will be given a list of candidate sites that have already been scored by a deterministic model
(power grid access, isolation, telecom, water, roads, flood and seismic risk). Your job is to write a
short, plain-language comparison of the ranked list — not to re-score anything.

Rules:
- Only use the facts given to you. Do not invent distances, place names, or numbers.
- Be honest about uncertainty: if two sites are close in score, say so instead of overstating the gap.
- Plain language for a non-technical decision-maker. No jargon, no bullet-point dump of raw numbers.
- 3-5 sentences total. Mention the top pick by name and why it leads, then one notable trade-off
  among the rest.`

/**
 * Asks an LLM (via OpenRouter) to summarise an already-ranked list of sites in plain language.
 * Returns null (never throws past the caller) if no API key is configured or the call fails —
 * the deterministic ranking and scores still stand on their own without this.
 */
export async function summariseRanking(query: string, sites: ScoreResult[]): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || sites.length === 0) return null

  const payload = sites.map((s, i) => ({
    rank: i + 1,
    municipality: s.municipality,
    province: s.province,
    score: s.score,
    factors: s.factors.map((f) => ({ key: f.key, score: Math.round(f.score * 100), evidence: f.evidence })),
    risks: s.risks.map((r) => ({ key: r.key, multiplier: r.multiplier, evidence: r.evidence })),
  }))

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Search: "${query}"\n\nRanked candidates (best first):\n${JSON.stringify(payload, null, 2)}` },
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content?.trim() ?? null
  } catch {
    return null
  }
}
