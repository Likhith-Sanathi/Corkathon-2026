import { describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/chat/route"
import { json, mockFetch, post } from "../helpers/fetch"

type ChatBody = { answer?: string; sources?: string[]; place?: { lat: number; lon: number } | null; error?: string }
const chat = async (body: unknown) => {
  const res = await POST(post(body))
  return { status: res.status, body: (await res.json()) as ChatBody }
}
const reply = (message: Record<string, unknown>) => json({ choices: [{ message }] })

describe("POST /api/chat", () => {
  it("rejects a missing message", async () => {
    mockFetch({})
    expect((await chat({})).status).toBe(400)
    expect((await chat({ message: "   " })).status).toBe(400)
  })

  it("degrades gracefully without an API key (no network call)", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "")
    const f = mockFetch({})
    const { status, body } = await chat({ message: "How is the score calculated?" })
    expect(status).toBe(502)
    expect(body.error).toMatch(/chat service/)
    expect(f).not.toHaveBeenCalled()
  })

  it("answers from the knowledge base and cites sources", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    const f = mockFetch({ "openrouter.ai": () => reply({ content: "Power has the highest weight." }) })
    const { status, body } = await chat({ message: "How is the power score calculated?" })
    expect(status).toBe(200)
    expect(body.answer).toBe("Power has the highest weight.")
    expect(body.sources!.length).toBeGreaterThan(0)
    // the request carried the retrieved context
    const sent = JSON.parse(String(f.mock.calls[0][1]!.body)) as { messages: { content: string }[] }
    expect(sent.messages.some((m) => m.content.startsWith("Context:"))).toBe(true)
  })

  it("runs find_best_plot with real scores and returns the best plot as the place", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    let call = 0
    mockFetch({
      "openrouter.ai": (_url, init) => {
        call++
        if (call === 1)
          return reply({
            content: null,
            tool_calls: [{ id: "t1", type: "function", function: { name: "find_best_plot", arguments: JSON.stringify({ maxPriceEur: 2_000_000 }) } }],
          })
        // second call: the tool result must contain real computed scores and respect the budget
        const msgs = JSON.parse(String(init!.body)).messages as { role: string; content: string }[]
        const tool = JSON.parse(msgs.find((m) => m.role === "tool")!.content) as { results?: { score: number; askingPriceEur: number }[] }
        expect(tool.results!.length).toBeGreaterThan(0)
        for (const r of tool.results!) expect(r.askingPriceEur).toBeLessThanOrEqual(2_000_000)
        return reply({ content: "The best plot under €2M is shown on the map." })
      },
    })
    const { status, body } = await chat({ message: "Best plot under 2 million?" })
    expect(status).toBe(200)
    expect(call).toBe(2)
    expect(body.place).toMatchObject({ lat: expect.any(Number), lon: expect.any(Number) })
  })

  it("survives malformed tool arguments", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    let call = 0
    mockFetch({
      "openrouter.ai": () =>
        ++call === 1
          ? reply({ content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "show_place_on_map", arguments: "{bad" } }] })
          : reply({ content: "I couldn't tell which place you meant." }),
    })
    const { status, body } = await chat({ message: "show me" })
    expect(status).toBe(200)
    expect(body.answer).toMatch(/couldn't/)
  })
})
