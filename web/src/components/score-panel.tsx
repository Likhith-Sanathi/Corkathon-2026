"use client"

import { animate, AnimatePresence, motion } from "motion/react"
import { useEffect, useRef } from "react"
import { MapPin, ShieldAlert, Waves, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FACTOR_COLORS } from "@/lib/layers"
import { FACTOR_LABELS, grade } from "@/lib/scoring"
import type { ScoreResult } from "@/lib/types"
import { cn } from "@/lib/utils"

const TONE: Record<string, string> = {
  great: "text-emerald-600 dark:text-emerald-400",
  good: "text-lime-600 dark:text-lime-400",
  fair: "text-amber-600 dark:text-amber-400",
  poor: "text-rose-600 dark:text-rose-400",
}
const RING: Record<string, string> = { great: "#10b981", good: "#84cc16", fair: "#f59e0b", poor: "#f43f5e" }

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const last = useRef(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const controls = animate(last.current, value, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (node.textContent = v.toFixed(decimals)),
    })
    last.current = value
    return () => controls.stop()
  }, [value, decimals])
  return <span ref={ref}>{(0).toFixed(decimals)}</span>
}

function ScoreRing({ score, tone }: { score: number; tone: string }) {
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 100 100" className="size-28 -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
      <motion.circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        stroke={RING[tone]}
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - score / 100) }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  )
}

export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted">
        <MapPin className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Drop a pin to score a site</p>
        <p className="text-sm text-muted-foreground">Click anywhere in the Netherlands on the map.</p>
      </div>
    </div>
  )
}

export function ScorePanel({
  result,
  loading,
  onClear,
}: {
  result: ScoreResult
  loading: boolean
  onClear: () => void
}) {
  const g = grade(result.score)
  return (
    <motion.div
      key={`${result.lat},${result.lon}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn("space-y-5 transition-opacity", loading && "opacity-60")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {result.municipality}
            <span className="text-muted-foreground"> · {result.province}</span>
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {result.lat.toFixed(5)}, {result.lon.toFixed(5)}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Remove pin">
          <X />
        </Button>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative">
          <ScoreRing score={result.score} tone={g.tone} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tabular-nums tracking-tight">
              <AnimatedNumber value={result.score} />
            </span>
            <span className="text-[11px] text-muted-foreground">/ 100</span>
          </div>
        </div>
        <div className="space-y-2">
          <p className={cn("text-lg font-semibold tracking-tight", TONE[g.tone])}>{g.label}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Suitability <span className="font-medium text-foreground tabular-nums">{(result.suitability * 100).toFixed(0)}</span>
            {" × "}risk <span className="font-medium text-foreground tabular-nums">{result.risk.toFixed(2)}</span>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Factors</h3>
        {result.factors.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium">
                <span className="size-2 rounded-full" style={{ background: FACTOR_COLORS[f.key] }} />
                {FACTOR_LABELS[f.key]}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {(f.score * 100).toFixed(0)}
                <span className="text-xs"> · {(f.weight * 100).toFixed(0)}% weight</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full"
                style={{ background: FACTOR_COLORS[f.key] }}
                initial={{ width: 0 }}
                animate={{ width: `${f.score * 100}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {f.evidence.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Risk</h3>
        {result.risks.map((r) => (
          <div key={r.key} className="flex gap-3 rounded-lg border p-3">
            <div className="mt-0.5 text-muted-foreground">
              {r.key === "flood" ? <Waves className="size-4" /> : <ShieldAlert className="size-4" />}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{r.key === "flood" ? "Flood" : "Seismic"}</span>
                <Badge variant={r.multiplier < 0.6 ? "destructive" : r.multiplier < 0.95 ? "secondary" : "outline"}>
                  ×{r.multiplier.toFixed(2)}
                </Badge>
              </div>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {r.evidence.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export function OutsideNotice({ message }: { message: string }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {message}
      </motion.div>
    </AnimatePresence>
  )
}
