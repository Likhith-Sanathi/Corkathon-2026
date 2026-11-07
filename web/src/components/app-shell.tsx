"use client"

import dynamic from "next/dynamic"
import { ReactLenis } from "lenis/react"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { Loader2, PanelLeftClose, PanelLeftOpen, PanelRightOpen } from "lucide-react"
import { FilterControls, LayerControls, ThemeToggle, WeightControls } from "@/components/controls"
import { FeaturedListings } from "@/components/featured-listings"
import { Button } from "@/components/ui/button"
import { EmptyState, OutsideNotice, ScorePanel } from "@/components/score-panel"
import { SiteSearch } from "@/components/site-search"
import { Separator } from "@/components/ui/separator"
import { DEFAULT_FILTERS, HEAT_RAMP, LAYERS, type Basemap, type Filters, type LayerKey } from "@/lib/layers"
import { DEFAULT_WEIGHTS } from "@/lib/scoring"
import { applyTheme, useTheme, type Theme } from "@/lib/theme"
import type { ScoreResult, Weights } from "@/lib/types"

const SiteMap = dynamic(() => import("@/components/site-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" /> Loading map
    </div>
  ),
})

/** True on wide screens, where the featured bar docks beside the map instead of floating over it. */
const WIDE = "(min-width: 1280px)"
function useWideScreen() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(WIDE)
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  )
}

const initialLayers = Object.fromEntries(LAYERS.map((l) => [l.key, l.defaultOn])) as Record<LayerKey, boolean>

export function AppShell() {
  const [pin, setPin] = useState<{ lat: number; lon: number } | null>(null)
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)
  const [layers, setLayers] = useState(initialLayers)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  // null = follow the theme (light basemap in light mode, dark otherwise) until the user picks one
  const [basemapChoice, setBasemapChoice] = useState<Basemap | null>(null)
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [searchSites, setSearchSites] = useState<ScoreResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [heatDomain, setHeatDomain] = useState<[number, number] | null>(null)
  const theme = useTheme()
  const wide = useWideScreen()
  // null = default: open when docked (wide screens), closed when it would float over the map.
  const [featuredPref, setFeaturedPref] = useState<boolean | null>(null)
  const featuredOpen = featuredPref ?? wide
  const [panelOpen, setPanelOpen] = useState(true)
  const basemap: Basemap = basemapChoice ?? (theme === "light" ? "light" : "dark")

  const changeTheme = useCallback((t: Theme) => {
    applyTheme(t)
    // Light/dark tiles follow the theme again; an explicit PDOK or OSM choice is kept.
    setBasemapChoice((b) => (b === "light" || b === "dark" ? null : b))
  }, [])

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
    <main className="relative flex h-dvh flex-col md:flex-row">
      <AnimatePresence initial={false}>
        {panelOpen && (
          <motion.aside
            key="panel"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="order-2 h-[48dvh] shrink-0 border-t bg-background md:order-1 md:h-full md:w-[460px] xl:w-[520px] md:border-t-0 md:border-r"
          >
            <ReactLenis className="h-full overflow-y-auto overscroll-contain">
              <div className="space-y-6 p-5">
                <header className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Corkathon 2026</p>
                    <div className="flex items-center gap-1">
                      <ThemeToggle theme={theme} onChange={changeTheme} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPanelOpen(false)}
                        aria-label="Hide side panel"
                        className="hidden md:inline-flex"
                      >
                        <PanelLeftClose />
                      </Button>
                    </div>
                  </div>
                  <h1 className="text-xl font-semibold tracking-tight">Data centre site scorer</h1>
                  <p className="text-sm text-muted-foreground">
                    Drop a pin in the Netherlands to see how it scores on power, isolation, telecom, water and roads, after flood and
                    earthquake risk.
                  </p>
                </header>

                <SiteSearch weights={weights} onSelect={onPick} onResults={setSearchSites} />
                <Separator />

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
                <FilterControls filters={filters} basemap={basemap} onFilters={setFilters} onBasemap={setBasemapChoice} />
                <p className="pb-2 text-xs leading-relaxed text-muted-foreground">
                  Data: OpenStreetMap (power, water, roads, settlements, telecom), PDOK/Rijkswaterstaat flood risk zones, EMSC
                  earthquakes 2000–2024, IBIS business parks (2019), Kadaster parcels via PDOK.
                </p>
              </div>
            </ReactLenis>
          </motion.aside>
        )}
      </AnimatePresence>

      <section className="relative order-1 min-h-0 flex-1 md:order-2">
        <SiteMap
          theme={theme}
          weights={weights}
          onHeatDomain={setHeatDomain}
          layers={layers}
          filters={filters}
          basemap={basemap}
          pin={pin}
          result={shown}
          searchSites={searchSites}
          onPick={onPick}
        />
        {layers.heatmap && heatDomain && (
          <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] w-56 rounded-lg border bg-background/90 p-3 text-xs shadow-sm backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">Site score</span>
              <span className="text-muted-foreground">updates with weights</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${HEAT_RAMP.join(", ")})` }} />
            <div className="mt-1.5 flex justify-between text-muted-foreground tabular-nums">
              <span>{heatDomain[0].toFixed(0)}</span>
              <span>{heatDomain[1].toFixed(0)}</span>
            </div>
          </div>
        )}
        {!pin && (
          <div className="pointer-events-none absolute top-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full border bg-background/90 px-4 py-1.5 text-sm whitespace-nowrap shadow-sm backdrop-blur">
            Click the map to drop a pin
          </div>
        )}
        {!panelOpen && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPanelOpen(true)}
            className="absolute top-4 left-4 z-[1000] bg-background/90 shadow-sm backdrop-blur"
          >
            <PanelLeftOpen /> Show panel
          </Button>
        )}
        {!featuredOpen && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFeaturedPref(true)}
            className="absolute top-4 right-4 z-[1000] hidden bg-background/90 shadow-sm backdrop-blur md:inline-flex"
          >
            <PanelRightOpen /> Featured listings
          </Button>
        )}
      </section>

      <AnimatePresence initial={false}>
        {featuredOpen && (
          <motion.aside
            key="featured"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={
              wide
                ? "order-3 hidden h-full w-[340px] shrink-0 border-l bg-background md:block"
                : "absolute top-3 right-3 bottom-3 z-[1001] hidden w-[320px] overflow-hidden rounded-xl border bg-background shadow-xl md:block"
            }
          >
            <FeaturedListings
              weights={weights}
              selectedId={shown?.plot?.listing?.id ?? null}
              onSelect={onPick}
              onClose={() => setFeaturedPref(false)}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </main>
  )
}
