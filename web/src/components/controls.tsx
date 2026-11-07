"use client"

import { Moon, MoonStar, RotateCcw, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  BASEMAPS,
  FACTOR_COLORS,
  LAYERS,
  type Basemap,
  type Filters,
  type LayerKey,
  type PlaceFilter,
  type VoltageFilter,
} from "@/lib/layers"
import { FACTOR_LABELS, normaliseWeights } from "@/lib/scoring"
import type { Theme } from "@/lib/theme"
import type { FactorKey, Weights } from "@/lib/types"
import { cn } from "@/lib/utils"

const one = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number))

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex h-7 items-center justify-between">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function WeightControls({
  weights,
  onChange,
  onReset,
}: {
  weights: Weights
  onChange: (w: Weights) => void
  onReset: () => void
}) {
  const share = normaliseWeights(weights)
  return (
    <Section
      title="Factor weights"
      action={
        <Button variant="ghost" size="xs" onClick={onReset}>
          <RotateCcw /> Reset
        </Button>
      }
    >
      <div className="space-y-4">
        {(Object.keys(weights) as FactorKey[]).map((k) => (
          <div key={k} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: FACTOR_COLORS[k] }} />
                {FACTOR_LABELS[k]}
              </span>
              <span className="tabular-nums text-muted-foreground">{Math.round(share[k] * 100)}%</span>
            </div>
            <Slider
              value={[Math.round(weights[k] * 100)]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => onChange({ ...weights, [k]: one(v) / 100 })}
              aria-label={`${FACTOR_LABELS[k]} weight`}
            />
          </div>
        ))}
      </div>
    </Section>
  )
}

export function LayerControls({
  layers,
  onToggle,
}: {
  layers: Record<LayerKey, boolean>
  onToggle: (key: LayerKey, on: boolean) => void
}) {
  return (
    <Section title="Map layers">
      <div className="space-y-2.5">
        {LAYERS.map((l) => (
          <label key={l.key} className="flex cursor-pointer items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2.5 text-sm">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: l.color }} />
              <span className="truncate">{l.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{l.hint}</span>
            </span>
            <Switch checked={layers[l.key]} onCheckedChange={(on) => onToggle(l.key, on)} />
          </label>
        ))}
      </div>
    </Section>
  )
}

const VOLTAGE_ITEMS = [
  { value: "110", label: "110 kV and up" },
  { value: "220", label: "220 kV and up" },
  { value: "380", label: "380 kV only" },
]
const PLACE_ITEMS = [
  { value: "city", label: "Cities" },
  { value: "town", label: "Towns and up" },
  { value: "suburb", label: "Suburbs and up" },
  { value: "village", label: "Villages and up" },
  { value: "hamlet", label: "All settlements" },
]
const BASEMAP_ITEMS = (Object.keys(BASEMAPS) as Basemap[]).map((k) => ({ value: k, label: BASEMAPS[k].label }))

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function FilterControls({
  filters,
  basemap,
  onFilters,
  onBasemap,
}: {
  filters: Filters
  basemap: Basemap
  onFilters: (f: Filters) => void
  onBasemap: (b: Basemap) => void
}) {
  return (
    <Section title="Filters">
      <div className="space-y-3">
        <Row label="Power voltage">
          <Select
            items={VOLTAGE_ITEMS}
            value={filters.voltage}
            onValueChange={(v) => v && onFilters({ ...filters, voltage: v as VoltageFilter })}
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOLTAGE_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row label="Settlements">
          <Select
            items={PLACE_ITEMS}
            value={filters.minPlace}
            onValueChange={(v) => v && onFilters({ ...filters, minPlace: v as PlaceFilter })}
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLACE_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <div className="space-y-2">
          <Row label="Min. quake magnitude">
            <span className="tabular-nums">M{filters.minMagnitude.toFixed(1)}</span>
          </Row>
          <Slider
            value={[filters.minMagnitude * 10]}
            min={0}
            max={40}
            step={1}
            onValueChange={(v) => onFilters({ ...filters, minMagnitude: one(v) / 10 })}
            aria-label="Minimum earthquake magnitude"
          />
        </div>
        <Row label="Basemap">
          <Select items={BASEMAP_ITEMS} value={basemap} onValueChange={(v) => v && onBasemap(v as Basemap)}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASEMAP_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Filters change what the map shows. The score always uses every feature in the data.
        </p>
      </div>
    </Section>
  )
}

const THEME_ITEMS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "oled", label: "OLED", Icon: MoonStar },
]

export function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour theme" className="inline-flex gap-0.5 rounded-lg border p-0.5">
      {THEME_ITEMS.map(({ value, label, Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(value)}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
