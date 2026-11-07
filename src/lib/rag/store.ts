import { CORPUS, type CorpusDoc } from "./corpus";
import { embedText, embedTexts } from "./gemini";

type IndexedDoc = CorpusDoc & { vector: number[] };

let indexPromise: Promise<IndexedDoc[]> | null = null;

// Embeddings are computed once per server process and cached in memory — the
// corpus is small and static, so there's no need for a persisted vector DB.
function buildIndex(): Promise<IndexedDoc[]> {
  if (!indexPromise) {
    indexPromise = embedTexts(CORPUS.map((doc) => `${doc.title}\n${doc.text}`))
      .then((vectors) => CORPUS.map((doc, i) => ({ ...doc, vector: vectors[i] })))
      .catch((error) => {
        indexPromise = null; // allow retry on next request instead of caching a failure
        throw error;
      });
  }
  return indexPromise;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function retrieve(query: string, k = 4): Promise<CorpusDoc[]> {
  const [index, queryVector] = await Promise.all([buildIndex(), embedText(query)]);

  return [...index]
    .sort((a, b) => cosineSimilarity(b.vector, queryVector) - cosineSimilarity(a.vector, queryVector))
    .slice(0, k)
    .map(({ id, title, text }) => ({ id, title, text }));
}
