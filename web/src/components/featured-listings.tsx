"use client"

import { ReactLenis } from "lenis/react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useState } from "react"
import { BadgeEuro, Clock, Loader2, Maximize2, PanelRightClose, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LISTING_COLORS } from "@/lib/layers"
import { GRADE_HEX, grade } from "@/lib/scoring"
import type { FeaturedItem, FeaturedSection, Weights } from "@/lib/types"
import { cn } from "@/lib/utils"

const SECTION_ICON = { top: Trophy, value: BadgeEuro, large: Maximize2, new: Clock } as const

const fmtPrice = (eur: number) =>
  eur >= 1e6 ? `€${(eur / 1e6).toLocaleString("en-GB", { maximumFractionDigits: 1 })}M` : `€${Math.round(eur / 1000)}k`
const fmtArea = (m2: number) => (m2 >= 10_000 ? `${(m2 / 10_000).toFixed(1)} ha` : `${Math.round(m2).toLocaleString("en-GB")} m²`)
const TODAY = Date.parse("2026-11-07T00:00:00Z") // matches the synthetic listing dates
const listedAgo = (iso: string) => {
  const days = Math.round((TODAY - Date.parse(iso)) / 86_400_000)
  return days <= 1 ? "Listed today" : days < 30 ? `Listed ${days} days ago` : `Listed ${Math.round(days / 30)} mo ago`
}

/** The plot's real outline, scaled into a square thumbnail (equirectangular, corrected for latitude). */
function PlotShape({ outline, color }: { outline: [number, number][]; color: string }) {
  const d = useMemo(() => {
    const k = Math.cos(((outline[0]?.[1] ?? 52) * Math.PI) / 180)
    const xs = outline.map(([x]) => x * k)
    const ys = outline.map(([, y]) => -y)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const s = 40 / Math.max(x1 - x0, y1 - y0, 1e-9)
    const ox = (48 - (x1 - x0) * s) / 2
    const oy = (48 - (y1 - y0) * s) / 2
    return outline.map((_, i) => `${i ? "L" : "M"}${(ox + (xs[i] - x0) * s).toFixed(1)} ${(oy + (ys[i] - y0) * s).toFixed(1)}`).join("") + "Z"
  }, [outline])
  return (
    <svg viewBox="0 0 48 48" className="size-14 shrink-0 rounded-md bg-muted" aria-hidden>
      <path d={d} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  )
}

function Card({ item, selected, onSelect }: { item: FeaturedItem; selected: boolean; onSelect: () => void }) {
  const { listing: l, score } = item
  const tone = GRADE_HEX[grade(score).tone]
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full gap-3 rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected && "border-foreground/40 bg-muted/60",
      )}
    >
      <PlotShape outline={item.outline} color={LISTING_COLORS.for_sale} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-medium">{l.parkName}</span>
          <span
            className="shrink-0 rounded px-1.5 py-px text-xs font-semibold tabular-nums"
            style={{ color: tone, background: `${tone}1f` }}
            title="Site score for your weights"
          >
            {score.toFixed(0)}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {l.municipality} · {fmtArea(l.areaM2)}
        </p>
        <p className="flex items-baseline gap-1.5 text-sm">
          <span className="font-semibold tabular-nums">{fmtPrice(l.total)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">€{l.perM2}/m²</span>
        </p>
        <p className="text-[11px] text-muted-foreground">{listedAgo(l.listedOn)}</p>
      </div>
    </button>
  )
}

export function FeaturedListings({
  weights,
  selectedId,
  onSelect,
  onClose,
}: {
  weights: Weights
  selectedId: string | null
  onSelect: (lat: number, lon: number) => void
  onClose: () => void
}) {
  const [sections, setSections] = useState<FeaturedSection[] | null>(null)
  const [error, setError] = useState(false)

  // Refresh when the weights change (debounced for slider drags).
  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/featured", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weights }),
          signal: ctrl.signal,
        })
        const body = (await res.json()) as { sections: FeaturedSection[] }
        setSections(body.sections)
        setError(false)
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError(true)
      }
    }, 350)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [weights])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Featured listings</h2>
          <p className="text-[11px] text-muted-foreground">Plots for sale · synthetic demo data</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Hide featured listings">
          <PanelRightClose />
        </Button>
      </header>
      <ReactLenis className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-5 p-4">
          {!sections && !error && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Finding the best plots…
            </p>
          )}
          {error && <p className="text-xs text-destructive">Could not load featured listings.</p>}
          <AnimatePresence initial={false}>
            {sections?.map((section) => {
              const Icon = SECTION_ICON[section.key]
              return (
                <motion.section
                  key={section.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-2"
                >
                  <div>
                    <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                      <Icon className="size-3.5 text-muted-foreground" />
                      {section.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">{section.hint}</p>
                  </div>
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <Card
                        key={item.listing.id}
                        item={item}
                        selected={item.listing.id === selectedId}
                        onSelect={() => onSelect(item.listing.lat, item.listing.lon)}
                      />
                    ))}
                  </div>
                </motion.section>
              )
            })}
          </AnimatePresence>
        </div>
      </ReactLenis>
    </div>
  )
}
