"use client"

import dynamic from "next/dynamic"
import { ReactLenis } from "lenis/react"
import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { FilterControls, LayerControls, WeightControls } from "@/components/controls"
import { EmptyState, OutsideNotice, ScorePanel } from "@/components/score-panel"
import { Separator } from "@/components/ui/separator"
import { DEFAULT_FILTERS, LAYERS, type Basemap, type Filters, type LayerKey } from "@/lib/layers"
import { DEFAULT_WEIGHTS } from "@/lib/scoring"
import type { ScoreResult, Weights } from "@/lib/types"

const SiteMap = dynamic(() => import("@/components/site-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" /> Loading map
    </div>
  ),
})

const initialLayers = Object.fromEntries(LAYERS.map((l) => [l.key, l.defaultOn])) as Record<LayerKey, boolean>

export function AppShell() {
  const [pin, setPin] = useState<{ lat: number; lon: number } | null>(null)
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)
  const [layers, setLayers] = useState(initialLayers)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [basemap, setBasemap] = useState<Basemap>("light")
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Score the pin whenever it moves or the weights change (debounced for slider drags).
  useEffect(() => {
    if (!pin) return
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...pin, weights }),
          signal: ctrl.signal,
        })
        const body = await res.json()
        if (!res.ok) {
          setResult(null)
          setPin(null)
          setError(body.error ?? "Could not score this location.")
        } else {
          setError(null)
          setResult(body as ScoreResult)
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Could not reach the scoring service.")
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 120)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [pin, weights])

  const onPick = useCallback((lat: number, lon: number) => {
    setError(null)
    setPin({ lat, lon })
  }, [])
  const clear = useCallback(() => {
    setPin(null)
    setResult(null)
    setError(null)
  }, [])

  const shown = pin && result && result.lat === pin.lat && result.lon === pin.lon ? result : null

  return (
    <main className="flex h-dvh flex-col md:flex-row">
      <aside className="order-2 h-[48dvh] shrink-0 border-t bg-background md:order-1 md:h-full md:w-[400px] md:border-t-0 md:border-r">
        <ReactLenis className="h-full overflow-y-auto overscroll-contain">
          <div className="space-y-6 p-5">
            <header className="space-y-1">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Corkathon 2026</p>
              <h1 className="text-xl font-semibold tracking-tight">Data centre site scorer</h1>
              <p className="text-sm text-muted-foreground">
                Drop a pin in the Netherlands to see how it scores on power, isolation, telecom, water and roads, after flood and
                earthquake risk.
              </p>
            </header>

            {error && <OutsideNotice message={error} />}
            {shown ? (
              <ScorePanel result={shown} loading={loading} onClear={clear} />
            ) : pin ? (
              <div className="flex items-center gap-2 rounded-xl border px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Scoring location
              </div>
            ) : (
              <EmptyState />
            )}

            <Separator />
            <WeightControls weights={weights} onChange={setWeights} onReset={() => setWeights(DEFAULT_WEIGHTS)} />
            <Separator />
            <LayerControls layers={layers} onToggle={(k, on) => setLayers((s) => ({ ...s, [k]: on }))} />
            <Separator />
            <FilterControls filters={filters} basemap={basemap} onFilters={setFilters} onBasemap={setBasemap} />
            <p className="pb-2 text-xs leading-relaxed text-muted-foreground">
              Data: OpenStreetMap (power, water, roads, settlements, telecom), PDOK/Rijkswaterstaat flood risk zones, EMSC
              earthquakes 2000–2024.
            </p>
          </div>
        </ReactLenis>
      </aside>

      <section className="relative order-1 min-h-0 flex-1 md:order-2">
        <SiteMap layers={layers} filters={filters} basemap={basemap} pin={pin} result={shown} onPick={onPick} />
        {!pin && (
          <div className="pointer-events-none absolute top-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full border bg-background/90 px-4 py-1.5 text-sm whitespace-nowrap shadow-sm backdrop-blur">
            Click the map to drop a pin
          </div>
        )}
      </section>
    </main>
  )
}
