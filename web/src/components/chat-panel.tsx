"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MapPin, MessageCircle, Send, X } from "lucide-react"
import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ScoreResult, Weights } from "@/lib/types"
import { cn } from "@/lib/utils"

type SiteContext = Pick<ScoreResult, "municipality" | "province" | "lat" | "lon" | "score" | "factors" | "risks">

type Place = { lat: number; lon: number; displayName: string }

type Message = { role: "user" | "assistant"; content: string; sources?: string[]; place?: Place; error?: boolean }

const STARTER =
  'Ask how the score, weights, or land prices are calculated, ask about a place (e.g. "what about Eindhoven?"), ' +
  'or ask for the best option (e.g. "best plot near Groningen under €1M").'

// Keeps the LLM's markdown legible inside a small chat bubble: no big headings, tight list spacing.
const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
  h1: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
  h2: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
  h3: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b px-1.5 py-1 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b px-1.5 py-1 align-top">{children}</td>,
}

/** Chat content only — no floating button or positioning, so it can be dropped into any panel. */
export function ChatPanel({
  site,
  weights,
  onPlace,
}: {
  site?: ScoreResult | null
  weights?: Weights
  onPlace?: (lat: number, lon: number) => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    setInput("")
    const next: Message[] = [...messages, { role: "user", content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const siteContext: SiteContext | undefined = site
        ? { municipality: site.municipality, province: site.province, lat: site.lat, lon: site.lon, score: site.score, factors: site.factors, risks: site.risks }
        : undefined
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: next.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          site: siteContext,
          weights,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: body.error ?? "Something went wrong.", error: true }])
      } else {
        setMessages((m) => [...m, { role: "assistant", content: body.answer, sources: body.sources, place: body.place ?? undefined }])
        if (body.place) onPlace?.(body.place.lat, body.place.lon)
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Could not reach the chat service.", error: true }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
        {messages.length === 0 && <p className="text-sm text-muted-foreground">{STARTER}</p>}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : m.error
                    ? "border border-destructive/30 bg-destructive/5 text-destructive"
                    : "bg-muted",
              )}
            >
              {m.role === "assistant" ? (
                <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                  {m.content}
                </Markdown>
              ) : (
                m.content
              )}
              {m.place && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-foreground/80">
                  <MapPin className="size-3" /> Jumped to {m.place.displayName}
                </p>
              )}
              {!!m.sources?.length && (
                <p className="mt-1.5 text-[10px] text-muted-foreground/80">Sources: {m.sources.join(" · ")}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="How is the score calculated?"
          disabled={loading}
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Send">
          <Send />
        </Button>
      </form>
    </div>
  )
}

/** Standalone floating button + popover wrapping ChatPanel, for pages with no other panel to dock into. */
export function FloatingChat({
  site,
  weights,
  onPlace,
}: {
  site?: ScoreResult | null
  weights?: Weights
  onPlace?: (lat: number, lon: number) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed right-5 bottom-5 z-[1100] flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[32rem] w-80 flex-col overflow-hidden rounded-xl border bg-popover shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Ask about the scoring</p>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close chat">
              <X />
            </Button>
          </div>
          <ChatPanel site={site} weights={weights} onPlace={onPlace} />
        </div>
      )}

      <Button
        size="icon-lg"
        className="rounded-full shadow-lg"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? <X /> : <MessageCircle />}
      </Button>
    </div>
  )
}
