import "server-only"
import { CORPUS, type CorpusDoc } from "./corpus"

// Lexical (TF-IDF) retrieval over a small, static corpus — no embedding API needed. The corpus
// is short and curated enough that term overlap is a reliable relevance signal, and this keeps
// the chatbot on the one model this app already uses (OpenRouter) rather than adding a second
// provider just for embeddings.
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "of", "to", "in", "on", "for", "and", "or", "how", "what", "does",
  "do", "this", "that", "it", "its", "with", "by", "as", "be", "was", "were", "has", "have", "can",
  "i", "you", "we", "your", "my", "me", "about", "would", "will", "did", "if",
])

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g)?.filter((t) => t.length > 1 && !STOPWORDS.has(t)) ?? []
}

const docTokens = CORPUS.map((doc) => tokenize(`${doc.title} ${doc.text}`))

const documentFrequency = new Map<string, number>()
for (const tokens of docTokens) {
  for (const t of new Set(tokens)) documentFrequency.set(t, (documentFrequency.get(t) ?? 0) + 1)
}
const idf = (term: string) => Math.log((CORPUS.length + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1

/** Top-k most relevant corpus docs for a query, ranked by TF-IDF term overlap. */
export function retrieve(query: string, k = 4): CorpusDoc[] {
  const queryTerms = tokenize(query)
  if (queryTerms.length === 0) return []

  const scored = CORPUS.map((doc, i) => {
    const counts = new Map<string, number>()
    for (const t of docTokens[i]) counts.set(t, (counts.get(t) ?? 0) + 1)
    let score = 0
    for (const term of queryTerms) {
      const count = counts.get(term)
      if (count) score += count * idf(term)
    }
    return { doc, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.doc)
}
