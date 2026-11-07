"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Marker } from "@/lib/scoring/types";

type FactorResult = {
  key: string;
  title: string;
  score: number | null;
  summary: string;
  source: string;
  markers: Marker[];
};

export type ChatSiteContext = {
  displayName: string;
  lat: number;
  lon: number;
  country: string | null;
  score: { overallScore: number | null; factors: FactorResult[] };
};

type Message = { role: "user" | "assistant"; text: string; sources?: string[] };

export function SiteChat({ site }: { site?: ChatSiteContext }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const history = messages.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("model" as const),
      text: m.text,
    }));

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, site }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer, sources: data.sources },
      ]);
    } catch {
      setError("Could not reach the chat service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="size-4 text-primary" />
          {site ? `Ask about ${site.displayName}` : "Ask about the data"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {site
              ? "Ask why this site scored the way it did, or how a factor is calculated."
              : "Ask how scores are calculated or where the data comes from. Search a site above to ask about it specifically."}
          </p>
        )}

        {messages.length > 0 && (
          <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
                }
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.sources && message.sources.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Based on: {message.sources.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. Why did this score low on water?"
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
