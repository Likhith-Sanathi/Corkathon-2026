"use client";

import { useRef, useState, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = { role: "user" | "assistant"; content: string };

type ToolActivity = { name: string; args: Record<string, unknown> };

function toolLabel(activity: ToolActivity): string {
  if (activity.name === "score_site") return `Scored ${activity.args.place ?? "a site"}`;
  if (activity.name === "find_best_sites")
    return `Searched around ${activity.args.region ?? "a region"}`;
  return activity.name;
}

const WELCOME: Message = {
  role: "assistant",
  content:
    "Ask me about a specific place (\"How does Galway score?\") or a region (\"Best spots in Sweden?\") and I'll pull the live evidence.",
};

const TEASER_DELAY_MS = 2000;

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [activityByTurn, setActivityByTurn] = useState<Record<number, ToolActivity[]>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowTeaser(true), TEASER_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function openChat() {
    setShowTeaser(false);
    setOpen(true);
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setMessages((prev) => {
        const turnIndex = prev.length;
        if (data.toolActivity?.length > 0) {
          setActivityByTurn((activity) => ({ ...activity, [turnIndex]: data.toolActivity }));
        }
        return [...prev, { role: "assistant", content: data.reply }];
      });
    } catch {
      setError("Could not reach the chat service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[32rem] w-80 flex-col overflow-hidden rounded-xl border bg-background shadow-xl sm:w-96">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
            <Sparkles className="size-4 text-primary" />
            <p className="text-sm font-medium">Site-selection assistant</p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            <div className="flex flex-col gap-3">
              {messages.map((message, index) => (
                <div key={index} className="flex flex-col gap-1">
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      message.role === "user"
                        ? "self-end bg-primary text-primary-foreground"
                        : "self-start bg-muted text-foreground"
                    }`}
                  >
                    {message.content}
                  </div>
                  {activityByTurn[index] && (
                    <div className="flex flex-wrap gap-1 self-start">
                      {activityByTurn[index].map((activity, i) => (
                        <span
                          key={i}
                          className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {toolLabel(activity)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Thinking…
                </div>
              )}

              {error && (
                <p className="self-start text-xs text-destructive">{error}</p>
              )}
            </div>
          </div>

          <form onSubmit={sendMessage} className="flex items-center gap-2 border-t p-3">
            <Input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about a place or region…"
              className="h-9 flex-1"
              disabled={loading}
            />
            <Button type="submit" size="icon" className="size-9" disabled={loading}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}

      {!open && showTeaser && (
        <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <button
            type="button"
            onClick={openChat}
            className="text-left text-foreground hover:underline"
          >
            Need help picking a site? Ask me!
          </button>
          <button
            type="button"
            onClick={() => setShowTeaser(false)}
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <Button
        type="button"
        size="icon"
        className="size-12 rounded-full shadow-lg"
        onClick={() => (open ? setOpen(false) : openChat())}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </Button>
    </div>
  );
}
