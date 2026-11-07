// All Gemini-specific API calls live in this one file. Swapping to a
// different embedding/chat provider later means rewriting just this module —
// callers (store.ts, the chat route) only depend on the functions below.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";
const EMBEDDING_DIMENSIONS = 768;

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

type EmbedContentResponse = {
  embeddings?: { values: number[] }[];
};

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const url = `${API_BASE}/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey()}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Gemini embedding request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as EmbedContentResponse;
  if (!data.embeddings || data.embeddings.length !== texts.length) {
    throw new Error("Gemini embedding response did not match the number of inputs");
  }

  return data.embeddings.map((embedding) => embedding.values);
}

export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}

type GenerateContentResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

export type ChatTurn = { role: "user" | "model"; text: string };

export async function generateAnswer(args: {
  systemPrompt: string;
  context: string;
  question: string;
  history?: ChatTurn[];
}): Promise<string> {
  const { systemPrompt, context, question, history = [] } = args;

  const url = `${API_BASE}/models/${CHAT_MODEL}:generateContent?key=${apiKey()}`;
  const contents = [
    ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    {
      role: "user",
      parts: [{ text: `Context:\n${context}\n\nQuestion: ${question}` }],
    },
  ];

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Gemini generation request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as GenerateContentResponse;
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");

  if (!text) throw new Error("Gemini returned no answer text");
  return text;
}
