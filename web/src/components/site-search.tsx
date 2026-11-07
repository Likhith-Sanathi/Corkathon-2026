"use client"

import { useEffect, useState } from "react"
import { Loader2, Search, SearchX, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FACTOR_COLORS, LISTING_COLORS } from "@/lib/layers"
import { FACTOR_LABELS, grade } from "@/lib/scoring"
import type { FactorKey, ScoreResult, Weights } from "@/lib/types"
import { cn } from "@/lib/utils"

const RADIUS_ITEMS = [
  { value: "10", label: "± 10 km" },
  { value: "20", label: "± 20 km" },
  { value: "30", label: "± 30 km" },
]

const PRICE_ITEMS = [
  { value: "0", label: "Any price" },
  { value: "1000000", label: "Up to €1M" },
  { value: "2500000", label: "Up to €2.5M" },
  { value: "5000000", label: "Up to €5M" },
  { value: "10000000", label: "Up to €10M" },
]

const fmtPrice = (eur: number) =>
  eur >= 1e6 ? `€${(eur / 1e6).toLocaleString("en-GB", { maximumFractionDigits: 1 })}M` : `€${Math.round(eur / 1000)}k`

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
  plotsInRange: number
  maxPrice: number | null
  sites: ScoreResult[]
}

type Status =
  | { state: "idle" }
  | { state: "loading"; query: string }
  | { state: "error"; message: string; suggestion?: string | null }
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
  onSearchArea,
}: {
  weights: Weights
  onSelect: (lat: number, lon: number) => void
  onResults?: (sites: ScoreResult[]) => void
  onSearchArea?: (area: { lat: number; lon: number; radiusKm: number } | null) => void
}) {
  const [query, setQuery] = useState("")
  const [radiusKm, setRadiusKm] = useState("30")
  const [maxPrice, setMaxPrice] = useState("0")
  // The query actually being searched for — separate from the input's `query` so that changing
  // the radius/price dropdowns re-runs the search for it without needing to hit Search again.
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({ state: "idle" })

  useEffect(() => {
    if (!submittedQuery) return
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setStatus({ state: "loading", query: submittedQuery })
      try {
        const res = await fetch("/api/rank-sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: submittedQuery, weights, radiusKm: Number(radiusKm), maxPrice: Number(maxPrice) || undefined }),
          signal: ctrl.signal,
        })
        const body = await res.json()
        if (!res.ok) {
          setStatus({ state: "error", message: body.error ?? "Search failed.", suggestion: body.suggestion })
          return
        }
        const result = body as RankResponse
        setStatus({ state: "success", result })
        onResults?.(result.sites)
        onSearchArea?.({ lat: result.resolved.lat, lon: result.resolved.lon, radiusKm: result.radiusKm })
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error("Plot search failed:", e)
          setStatus({ state: "error", message: "Could not reach the scoring service." })
        }
      }
    }, 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [submittedQuery, radiusKm, maxPrice, weights, onResults, onSearchArea])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) setSubmittedQuery(trimmed)
  }

  function applySuggestion(name: string) {
    setQuery(name)
    setSubmittedQuery(name)
  }

  const isLoading = status.state === "loading"

  return (
    <section className="space-y-3">
      <div className="flex h-7 items-center justify-between">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Find plots for sale</h3>
        <span className="text-[10px] text-muted-foreground">synthetic demo listings</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Near a place, e.g. Groningen"
              className="pl-8"
            />
          </div>
          <Button type="submit" size="sm" disabled={isLoading}>
            {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : "Search"}
          </Button>
        </div>
        <div className="flex gap-2">
          <Select items={RADIUS_ITEMS} value={radiusKm} onValueChange={(v) => v && setRadiusKm(v)}>
            <SelectTrigger size="sm" className="flex-1" aria-label="Search radius">
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
          <Select items={PRICE_ITEMS} value={maxPrice} onValueChange={(v) => v && setMaxPrice(v)}>
            <SelectTrigger size="sm" className="flex-1" aria-label="Maximum plot price">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICE_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </form>

      {status.state === "error" && (
        <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <SearchX className="size-3.5 shrink-0" />
            {status.message}
          </div>
          {status.suggestion && (
            <button
              type="button"
              onClick={() => applySuggestion(status.suggestion!)}
              className="pl-5.5 text-left underline underline-offset-2 hover:text-foreground"
            >
              Did you mean <span className="font-medium">{status.suggestion}</span>?
            </button>
          )}
        </div>
      )}

      {status.state === "loading" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Ranking plots for sale near {status.query}…
        </p>
      )}

      {status.state === "success" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Best {status.result.sites.length} of {status.result.plotsInRange} plots for sale
            {status.result.maxPrice ? ` up to ${fmtPrice(status.result.maxPrice)}` : ""} within {status.result.radiusKm} km of{" "}
            <span className="font-medium text-foreground">{status.result.resolved.displayName}</span>
          </p>

          {status.result.sites.length === 0 ? (
            <p className="text-xs text-muted-foreground">No plots for sale in that radius. Try a larger radius.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full table-fixed text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="w-6 px-1 py-1.5 text-center font-medium">#</th>
                    <th className="px-2 py-1.5 text-left font-medium">Plot</th>
                    {FACTOR_COLUMNS.map(({ key, abbr }) => (
                      <th key={key} className="w-7 px-0 py-1.5 font-medium" title={`${FACTOR_LABELS[key]} (${abbr})`}>
                        <span className="mx-auto block size-2 rounded-full" style={{ background: FACTOR_COLORS[key] }} />
                      </th>
                    ))}
                    <th className="w-14 px-1 py-1.5 text-right font-medium">Price</th>
                    <th className="w-11 px-2 py-1.5 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {status.result.sites.map((site, i) => {
                    const g = grade(site.score)
                    const byKey = Object.fromEntries(site.factors.map((f) => [f.key, f]))
                    const listing = site.plot?.listing
                    return (
                      <tr
                        key={`${site.lat},${site.lon}`}
                        onClick={() => onSelect(site.lat, site.lon)}
                        className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted"
                      >
                        <td className="px-1 py-1.5 text-center">
                          {i === 0 ? <Trophy className="mx-auto size-3.5 text-amber-500" /> : <span className="text-muted-foreground">{i + 1}</span>}
                        </td>
                        <td className="min-w-0 px-2 py-1.5">
                          <span className="flex items-center gap-1.5 truncate">
                            {listing && (
                              <span
                                className="size-1.5 shrink-0 rounded-full"
                                style={{ background: LISTING_COLORS[listing.status] }}
                                title={listing.status === "for_sale" ? "For sale" : "Under offer"}
                              />
                            )}
                            <span className="truncate font-medium">{listing?.parkName ?? site.municipality}</span>
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground tabular-nums">
                            {listing
                              ? `${(listing.areaM2 / 10_000).toFixed(1)} ha · €${listing.perM2}/m² · ${site.municipality}`
                              : `${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}`}
                          </span>
                        </td>
                        {FACTOR_COLUMNS.map(({ key }) => (
                          <td key={key} className="px-0 py-1.5 text-center text-[11px] text-muted-foreground tabular-nums">
                            {Math.round((byKey[key]?.score ?? 0) * 100)}
                          </td>
                        ))}
                        <td className="px-1 py-1.5 text-right font-medium tabular-nums">{listing ? fmtPrice(listing.total) : "–"}</td>
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
