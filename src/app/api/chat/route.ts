import { NextRequest, NextResponse } from "next/server";
import { generateAnswer, type ChatTurn } from "@/lib/rag/gemini";
import { retrieve } from "@/lib/rag/store";

const SYSTEM_PROMPT = `You are an assistant embedded in a data-center site-selection tool covering Europe.
Answer using only the provided context (methodology notes and, if given, the evidence computed for the site the user is currently looking at).
Be concise and plain-language — the reader is a decision-maker, not a geospatial analyst.
Be honest about uncertainty: if the context doesn't cover something, say so rather than guessing.
When a claim comes from a specific factor or data source, name it.`;

type SiteContext = {
  displayName: string;
  lat: number;
  lon: number;
  country: string | null;
  score: {
    overallScore: number | null;
    factors: {
      title: string;
      score: number | null;
      summary: string;
      source: string;
    }[];
  };
};

type ChatRequestBody = {
  message: string;
  history?: ChatTurn[];
  site?: SiteContext;
};

function formatSiteContext(site: SiteContext): string {
  const lines = [
    `Current site being viewed: ${site.displayName} (${site.lat.toFixed(5)}, ${site.lon.toFixed(5)}${site.country ? `, ${site.country}` : ""}).`,
    `Overall score: ${site.score.overallScore != null ? Math.round(site.score.overallScore) : "N/A"}/100.`,
    ...site.score.factors.map(
      (factor) =>
        `- ${factor.title}: ${factor.score != null ? Math.round(factor.score) : "N/A"}/100. ${factor.summary} (Source: ${factor.source})`,
    ),
  ];
  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  try {
    const docs = await retrieve(message, 4);
    const knowledgeContext = docs
      .map((doc) => `### ${doc.title}\n${doc.text}`)
      .join("\n\n");
    const context = body.site
      ? `${formatSiteContext(body.site)}\n\n${knowledgeContext}`
      : knowledgeContext;

    const answer = await generateAnswer({
      systemPrompt: SYSTEM_PROMPT,
      context,
      question: message,
      history: body.history,
    });

    return NextResponse.json({
      answer,
      sources: docs.map((doc) => doc.title),
    });
  } catch (error) {
    console.error("Chat request failed", error);
    return NextResponse.json(
      { error: "Could not generate an answer right now. Give it another try." },
      { status: 502 },
    );
  }
}
