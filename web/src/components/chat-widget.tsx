"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MessageCircle, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ScoreResult } from "@/lib/types"
import { cn } from "@/lib/utils"

type SiteContext = Pick<ScoreResult, "municipality" | "province" | "lat" | "lon" | "score" | "factors" | "risks">

type Message = { role: "user" | "assistant"; content: string; sources?: string[]; error?: boolean }

const STARTER = "Ask how the score, weights, or land prices are calculated."

export function ChatWidget({ site }: { site?: ScoreResult | null }) {
  const [open, setOpen] = useState(false)
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
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: body.error ?? "Something went wrong.", error: true }])
      } else {
        setMessages((m) => [...m, { role: "assistant", content: body.answer, sources: body.sources }])
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Could not reach the chat service.", error: true }])
    } finally {
      setLoading(false)
    }
  }

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

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
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
                  {m.content}
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
