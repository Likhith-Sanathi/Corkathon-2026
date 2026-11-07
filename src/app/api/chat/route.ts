import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter, type ChatMessage } from "@/lib/chat/openrouter";
import { CHAT_TOOLS, executeTool } from "@/lib/chat/tools";

const SYSTEM_PROMPT = `You are the site-selection assistant for a tool that helps find the best places in Europe to build a data center, scored on isolation, water availability, power grid access, climate/cooling cost, and natural disaster risk.

Core rules:
- Evidence first: when you report a score, it must come from calling score_site or find_best_sites — never invent a number.
- Use score_site when the user names a specific place. Use find_best_sites when they ask for the best place(s) in a region.
- Explain scores in plain language for a decision-maker, not a geospatial analyst.
- Be honest about uncertainty: if confidence is below 1, say part of the score is missing data. If a tool returns an error, say so plainly instead of guessing.
- Keep answers concise — a short summary plus the key numbers, not a full dump of every field.`;

const MAX_TOOL_ITERATIONS = 4;

type ClientMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const clientMessages = body?.messages as ClientMessage[] | undefined;

  if (!Array.isArray(clientMessages) || clientMessages.length === 0) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...clientMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const toolActivity: { name: string; args: Record<string, unknown> }[] = [];

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const assistantMessage = await callOpenRouter(messages, CHAT_TOOLS);
      messages.push(assistantMessage);

      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return NextResponse.json({
          reply: assistantMessage.content ?? "",
          toolActivity,
        });
      }

      for (const call of assistantMessage.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          // leave args empty — executeTool reports what's missing
        }

        toolActivity.push({ name: call.function.name, args });

        const result = await executeTool({ name: call.function.name, arguments: args });

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: result.name,
          content: result.content,
        });
      }
    }

    return NextResponse.json(
      {
        error: "The assistant took too many steps without finishing. Try a simpler question.",
      },
      { status: 500 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 },
    );
  }
}
