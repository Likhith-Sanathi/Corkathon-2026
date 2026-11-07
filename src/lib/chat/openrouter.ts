const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// gpt-4o-mini via OpenRouter: cheap, fast, and reliable with OpenAI-style
// tool calling, which is what this chatbot's two tools are defined in.
// Override with OPENROUTER_MODEL to try a different model.
const DEFAULT_MODEL = "openai/gpt-4o-mini";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage = {
  role: ChatRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export async function callOpenRouter(
  messages: ChatMessage[],
  tools: ToolDefinition[],
): Promise<ChatMessage> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set on the server.");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
      messages,
      tools,
      tool_choice: "auto",
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenRouter responded ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: ChatMessage }[];
  };

  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("OpenRouter returned no message.");

  return message;
}
