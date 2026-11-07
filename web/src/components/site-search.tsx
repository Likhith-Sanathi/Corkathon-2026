"use client"

import { useState } from "react"
import { Loader2, Search, SearchX, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FACTOR_COLORS } from "@/lib/layers"
import { FACTOR_LABELS, grade } from "@/lib/scoring"
import type { FactorKey, ScoreResult, Weights } from "@/lib/types"
import { cn } from "@/lib/utils"

const RADIUS_ITEMS = [
  { value: "15", label: "± 15 km" },
  { value: "30", label: "± 30 km" },
  { value: "60", label: "± 60 km" },
]

const FACTOR_COLUMNS: { key: FactorKey; abbr: string }[] = [
  { key: "power", abbr: "Pwr" },
  { key: "isolation", abbr: "Iso" },
  { key: "telecom", abbr: "Tel" },
  { key: "water", abbr: "Wtr" },
  { key: "roads", abbr: "Rds" },
]

type RankResponse = {
  resolved: { lat: number; lon: number; displayName: string }
  radiusKm: number
  sites: ScoreResult[]
  summary: string | null
}

type Status =
  | { state: "idle" }
  | { state: "loading"; query: string }
  | { state: "error"; message: string }
  | { state: "success"; result: RankResponse }

const TONE: Record<string, string> = {
  great: "text-emerald-600 dark:text-emerald-400",
  good: "text-lime-600 dark:text-lime-400",
  fair: "text-amber-600 dark:text-amber-400",
  poor: "text-rose-600 dark:text-rose-400",
}

export function SiteSearch({
  weights,
  onSelect,
  onResults,
}: {
  weights: Weights
  onSelect: (lat: number, lon: number) => void
  onResults?: (sites: ScoreResult[]) => void
}) {
  const [query, setQuery] = useState("")
  const [radiusKm, setRadiusKm] = useState("30")
  const [status, setStatus] = useState<Status>({ state: "idle" })

  async function runSearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setStatus({ state: "loading", query: trimmed })
    try {
      const res = await fetch("/api/rank-sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, weights, radiusKm: Number(radiusKm) }),
      })
      const body = await res.json()
      if (!res.ok) {
        setStatus({ state: "error", message: body.error ?? "Search failed." })
        return
      }
      const result = body as RankResponse
      setStatus({ state: "success", result })
      onResults?.(result.sites)
    } catch {
      setStatus({ state: "error", message: "Could not reach the scoring service." })
    }
  }

  const isLoading = status.state === "loading"

  return (
    <section className="space-y-3">
      <div className="flex h-7 items-center justify-between">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Search a region</h3>
      </div>

      <form onSubmit={runSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="A place, e.g. Groningen"
            className="pl-8"
          />
        </div>
        <Select items={RADIUS_ITEMS} value={radiusKm} onValueChange={(v) => v && setRadiusKm(v)}>
          <SelectTrigger size="sm" className="w-24 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RADIUS_ITEMS.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" disabled={isLoading}>
          {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : "Search"}
        </Button>
      </form>

      {status.state === "error" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <SearchX className="size-3.5 shrink-0" />
          {status.message}
        </div>
      )}

      {status.state === "loading" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Ranking sites near {status.query}…
        </p>
      )}

      {status.state === "success" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Top {status.result.sites.length} near <span className="font-medium text-foreground">{status.result.resolved.displayName}</span>
          </p>

          {status.result.summary && (
            <p className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">{status.result.summary}</p>
          )}

          {status.result.sites.length === 0 ? (
            <p className="text-xs text-muted-foreground">No scoreable land found in that radius. Try a larger radius.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[360px] text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="w-6 px-2 py-1.5 text-center font-medium">#</th>
                    <th className="px-2 py-1.5 text-left font-medium">Site</th>
                    {FACTOR_COLUMNS.map(({ key, abbr }) => (
                      <th key={key} className="w-9 px-1 py-1.5 font-medium" title={FACTOR_LABELS[key]}>
                        <span className="flex items-center justify-center gap-1">
                          <span className="size-1.5 shrink-0 rounded-full" style={{ background: FACTOR_COLORS[key] }} />
                          {abbr}
                        </span>
                      </th>
                    ))}
                    <th className="px-2 py-1.5 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {status.result.sites.map((site, i) => {
                    const g = grade(site.score)
                    const byKey = Object.fromEntries(site.factors.map((f) => [f.key, f]))
                    return (
                      <tr
                        key={`${site.lat},${site.lon}`}
                        onClick={() => onSelect(site.lat, site.lon)}
                        className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted"
                      >
                        <td className="px-2 py-1.5 text-center">
                          {i === 0 ? <Trophy className="mx-auto size-3.5 text-amber-500" /> : <span className="text-muted-foreground">{i + 1}</span>}
                        </td>
                        <td className="max-w-32 px-2 py-1.5">
                          <span className="block truncate">
                            <span className="font-medium">{site.municipality}</span>
                            <span className="text-muted-foreground"> · {site.province}</span>
                          </span>
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            {site.lat.toFixed(4)}, {site.lon.toFixed(4)}
                          </span>
                        </td>
                        {FACTOR_COLUMNS.map(({ key }) => (
                          <td key={key} className="px-1 py-1.5 text-center text-muted-foreground tabular-nums">
                            {Math.round((byKey[key]?.score ?? 0) * 100)}
                          </td>
                        ))}
                        <td className={cn("px-2 py-1.5 text-right font-semibold tabular-nums", TONE[g.tone])}>{site.score.toFixed(0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
