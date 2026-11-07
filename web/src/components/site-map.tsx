"use client"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  GeoJSON,
  MapContainer,
  Marker,
  Pane,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  WMSTileLayer,
  ZoomControl,
} from "react-leaflet"
import {
  BASEMAPS,
  FACTOR_COLORS,
  FLOOD_COLORS,
  FLOOD_FALLBACK,
  HEAT_RAMP,
  LISTING_COLORS,
  LISTING_LABELS,
  PARK_AVAILABLE,
  PARK_FULL,
  PLACE_RANK,
  POWER_380,
  POWER_HV,
  type Basemap,
  type Filters,
  type LayerKey,
} from "@/lib/layers"
import { GRID_NODATA, type GridMeta } from "@/lib/grid"
import { loadSprites, type GlyphKind, type Sprites } from "@/lib/glyphs"
import { GRADE_HEX, grade, normaliseWeights } from "@/lib/scoring"
import type { Theme } from "@/lib/theme"
import type {
  BusinessPark,
  Listing,
  ListingProps,
  FeatureCollection,
  FloodZone,
  Junction,
  Municipality,
  Place,
  PowerLine,
  ScoreResult,
  SeismicEvent,
  Substation,
  TelecomSite,
  Tower,
  WaterFeature,
  Weights,
} from "@/lib/types"

const NL_CENTER: [number, number] = [52.2, 5.3]
const NL_BOUNDS = L.latLngBounds([50.4, 2.8], [53.9, 7.6])

// ---------- data loading (each file fetched once, then cached) ----------
const fileCache = new Map<string, Promise<unknown>>()
function fetchLayer<T>(name: string): Promise<T> {
  if (!fileCache.has(name)) fileCache.set(name, fetch(`/data/${name}.json`).then((r) => r.json()))
  return fileCache.get(name) as Promise<T>
}
function useLayer<T>(name: string, enabled: boolean): T | null {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    if (!enabled || data) return
    let live = true
    fetchLayer<T>(name).then((d) => live && setData(d))
    return () => {
      live = false
    }
  }, [name, enabled, data])
  return enabled ? data : null
}

// ---------- canvas point layer ----------
type Pt = { lat: number; lon: number }
type GlyphOptions = L.CircleMarkerOptions & { sprite?: HTMLImageElement; dotSprite?: HTMLImageElement }
type PointStyle = GlyphOptions | null

/** Below this drawn size (px) a glyph's icon is unreadable, so draw its plain-dot version. */
const GLYPH_DETAIL_PX = 22

/**
 * A canvas circle marker that draws a sprite instead of a circle. It keeps the circle's hit area,
 * so hover tooltips, zoom animation and batching from Leaflet's canvas renderer all still work.
 */
const GlyphMarker = L.CircleMarker.extend({
  _updatePath(this: {
    _renderer: { _drawing: boolean; _ctx: CanvasRenderingContext2D }
    _point: L.Point
    _radius: number
    _empty: () => boolean
    options: GlyphOptions
  }) {
    if (!this._renderer._drawing || this._empty()) return
    const d = this._radius * 2
    const img = d < GLYPH_DETAIL_PX && this.options.dotSprite ? this.options.dotSprite : this.options.sprite!
    this._renderer._ctx.drawImage(img, this._point.x - d / 2, this._point.y - d / 2, d, d)
  },
}) as unknown as new (latlng: L.LatLngExpression, options: GlyphOptions) => L.CircleMarker
/** Marker size multiplier: about half size at country zoom, full size from street level. */
const zoomScale = (z: number) => Math.min(1.15, Math.max(0.5, 0.5 + (z - 7) * 0.15))

function PointLayer<T extends Pt>({
  items,
  styleFor,
  tooltipFor,
  maxZoom,
  onClick,
}: {
  items: T[] | null
  styleFor: (item: T) => PointStyle
  tooltipFor?: (item: T) => string | null
  /** Hide the layer when zoomed in past this level. */
  maxZoom?: number
  onClick?: (item: T) => void
}) {
  const map = useMap()
  useEffect(() => {
    if (!items) return
    const renderer = L.canvas({ padding: 0.5 })
    const group = L.layerGroup()
    const sized: [L.CircleMarker, number][] = []
    for (const it of items) {
      const style = styleFor(it)
      if (!style) continue
      const base = style.radius ?? 4
      const opts = { renderer, ...style, radius: base * zoomScale(map.getZoom()), bubblingMouseEvents: !onClick }
      const marker = style.sprite ? new GlyphMarker([it.lat, it.lon], opts) : L.circleMarker([it.lat, it.lon], opts)
      const tip = tooltipFor?.(it)
      if (tip) marker.bindTooltip(tip, { direction: "top", offset: [0, -4] })
      if (onClick) marker.on("click", () => onClick(it))
      group.addLayer(marker)
      sized.push([marker, base])
    }
    const sync = () => {
      const z = map.getZoom()
      const k = zoomScale(z)
      for (const [m, base] of sized) m.setRadius(Math.max(1, base * k))
      const visible = maxZoom === undefined || z <= maxZoom
      if (visible && !map.hasLayer(group)) group.addTo(map)
      if (!visible && map.hasLayer(group)) group.remove()
    }
    sync()
    map.on("zoomend", sync)
    return () => {
      map.off("zoomend", sync)
      group.remove()
    }
  }, [map, items, styleFor, tooltipFor, maxZoom, onClick])
  return null
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
const titled = (name: string, kind: string) => (name ? `<b>${esc(name)}</b><br/>${kind}` : kind)

// ---------- map behaviour ----------
function ClickToPin({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

function FitToEvidence({ result }: { result: ScoreResult | null }) {
  const map = useMap()
  const lastPin = useRef<string>("")
  useEffect(() => {
    if (!result) return
    const key = `${result.lat},${result.lon}`
    if (key === lastPin.current) return // weights changed, same pin: keep the view
    lastPin.current = key
    const bounds = L.latLngBounds([[result.lat, result.lon]])
    for (const p of result.points) bounds.extend([p.lat, p.lon])
    map.flyToBounds(bounds.pad(0.25), { maxZoom: 12, duration: 0.8 })
  }, [map, result])
  return null
}

/** Pans/zooms to fit every search result when a new search completes (same site list: keep the view). */
function FitToSearch({ sites }: { sites: ScoreResult[] }) {
  const map = useMap()
  const lastKey = useRef<string>("")
  useEffect(() => {
    if (!sites.length) return
    const key = sites.map((s) => `${s.lat},${s.lon}`).join("|")
    if (key === lastKey.current) return
    lastKey.current = key
    const bounds = L.latLngBounds(sites.map((s) => [s.lat, s.lon] as [number, number]))
    map.flyToBounds(bounds.pad(0.2), { maxZoom: 12, duration: 0.8 })
  }, [map, sites])
  return null
}

// ---------- live score heatmap ----------
type Grid = { meta: GridMeta; bytes: Uint8Array }
let gridPromise: Promise<Grid> | null = null
const loadGrid = () =>
  (gridPromise ??= Promise.all([
    fetch("/data/grid.json").then((r) => r.json() as Promise<GridMeta>),
    fetch("/data/grid.bin.gz").then((r) => new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()),
  ]).then(([meta, buf]) => ({ meta, bytes: new Uint8Array(buf) })))

/** 256-step lookup table for the colour ramp: [r, g, b] × 256. */
const RAMP_LUT = (() => {
  const stops = HEAT_RAMP.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))
  const lut = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * (stops.length - 1)
    const k = Math.min(stops.length - 2, Math.floor(x))
    const f = x - k
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f
  }
  return lut
})()
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const fromMercY = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI

/** Strong at country zoom, fading towards plot level so parcels and the basemap stay readable. */
const heatOpacity = (z: number) => Math.max(0.28, Math.min(0.72, 0.72 - (z - 11) * 0.11))

/** Output pixels per grid cell (horizontally). Scores are interpolated between cells. */
const HEAT_OVERSAMPLE = 2

/** An image overlay backed by a live <canvas>, so repaints skip PNG encoding entirely. */
const CanvasOverlay = L.ImageOverlay.extend({
  _initImage(this: { _url: HTMLCanvasElement; _image: HTMLCanvasElement; _zoomAnimated: boolean; options: L.ImageOverlayOptions }) {
    const el = (this._image = this._url)
    L.DomUtil.addClass(el, "leaflet-image-layer")
    if (this._zoomAnimated) L.DomUtil.addClass(el, "leaflet-zoom-animated")
    if (this.options.className) L.DomUtil.addClass(el, this.options.className)
    el.onselectstart = L.Util.falseFn
    el.onmousemove = L.Util.falseFn
  },
}) as unknown as new (canvas: HTMLCanvasElement, bounds: L.LatLngBounds, options: L.ImageOverlayOptions) => L.ImageOverlay

/**
 * Combine the precomputed factor scores with the weights and paint them into `canvas`,
 * bilinearly interpolating between cells in Web Mercator. Returns the colour range used.
 */
function paintHeatmap(canvas: HTMLCanvasElement, { meta, bytes }: Grid, weights: Weights): [number, number] {
  const { cols, rows, north, dLat, dLon } = meta
  const n = cols * rows
  const w = normaliseWeights(weights)
  // Planar layout: field k occupies bytes [k*n, (k+1)*n).
  const terms = meta.fields.flatMap((f, k) => (f in w ? [[k * n, w[f as keyof Weights]] as const] : []))
  const riskOff = meta.fields.indexOf("risk") * n

  // 1. Score every cell (NaN outside the Netherlands).
  const scores = new Float32Array(n)
  const valid = new Float32Array(meta.cellsInside)
  let nv = 0
  for (let i = 0; i < scores.length; i++) {
    if (bytes[i] === GRID_NODATA) {
      scores[i] = NaN
      continue
    }
    let s = 0
    for (const [off, wk] of terms) s += wk * bytes[off + i]
    scores[i] = (100 * s * bytes[riskOff + i]) / (254 * 254)
    if (nv < valid.length) valid[nv++] = scores[i]
  }
  // Stretch the colours over the 2nd–98th percentile so the gradient uses its full range.
  const sorted = valid.subarray(0, nv).sort()
  const lo = sorted[Math.floor(nv * 0.02)]
  const hi = sorted[Math.floor(nv * 0.98)]
  const scale = 255 / (hi - lo || 1)

  // 2. Output size: square pixels in Web Mercator.
  const yN = mercY(north)
  const yS = mercY(north - rows * dLat)
  const W = cols * HEAT_OVERSAMPLE
  const H = Math.round((W * (yN - yS)) / ((cols * dLon * Math.PI) / 180))
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W
    canvas.height = H
  }

  // Precompute the source cell and blend weight for every output column and row.
  const c0 = new Int32Array(W)
  const fx = new Float32Array(W)
  for (let i = 0; i < W; i++) {
    const gx = ((i + 0.5) / W) * cols - 0.5
    c0[i] = Math.floor(gx)
    fx[i] = gx - c0[i]
  }

  // 3. Bilinear sample, ignoring cells outside the country (their weight fades the edge out).
  const ctx = canvas.getContext("2d")!
  const img = ctx.createImageData(W, H)
  const px = img.data
  const at = (r: number, c: number) => (r < 0 || r >= rows || c < 0 || c >= cols ? NaN : scores[r * cols + c])
  for (let j = 0; j < H; j++) {
    const lat = fromMercY(yN + ((yS - yN) * (j + 0.5)) / H)
    const gy = (north - lat) / dLat - 0.5
    const r0 = Math.floor(gy)
    const fy = gy - r0
    for (let i = 0; i < W; i++) {
      const c = c0[i]
      const ax = fx[i]
      let acc = 0
      let ws = 0
      const v00 = at(r0, c), v01 = at(r0, c + 1), v10 = at(r0 + 1, c), v11 = at(r0 + 1, c + 1)
      // NaN !== NaN, so `v === v` skips cells outside the country.
      let q = (1 - ax) * (1 - fy)
      if (v00 === v00) {
        acc += q * v00
        ws += q
      }
      q = ax * (1 - fy)
      if (v01 === v01) {
        acc += q * v01
        ws += q
      }
      q = (1 - ax) * fy
      if (v10 === v10) {
        acc += q * v10
        ws += q
      }
      q = ax * fy
      if (v11 === v11) {
        acc += q * v11
        ws += q
      }
      if (ws < 0.02) continue // transparent
      const t = Math.max(0, Math.min(255, Math.round((acc / ws - lo) * scale))) * 3
      const p = (j * W + i) * 4
      px[p] = RAMP_LUT[t]
      px[p + 1] = RAMP_LUT[t + 1]
      px[p + 2] = RAMP_LUT[t + 2]
      px[p + 3] = Math.min(255, ws * 420)
    }
  }
  ctx.putImageData(img, 0, 0)
  return [lo, hi]
}

/** Live score heatmap. Repaints on the next animation frame after a weight change. */
function ScoreHeatmap({ weights, onDomain }: { weights: Weights; onDomain: (d: [number, number] | null) => void }) {
  const map = useMap()
  const [grid, setGrid] = useState<Grid | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let live = true
    loadGrid().then((g) => live && setGrid(g))
    return () => {
      live = false
    }
  }, [])

  // Create the overlay once the grid is known; remove it when the layer is switched off.
  useEffect(() => {
    if (!grid) return
    if (!map.getPane("score-heat")) map.createPane("score-heat").style.zIndex = "340"
    const { meta } = grid
    const bounds = L.latLngBounds([meta.north - meta.rows * meta.dLat, meta.west], [meta.north, meta.west + meta.cols * meta.dLon])
    const canvas = document.createElement("canvas")
    canvasRef.current = canvas
    const ov = new CanvasOverlay(canvas, bounds, { pane: "score-heat", opacity: heatOpacity(map.getZoom()), interactive: false }).addTo(map)
    const fade = () => ov.setOpacity(heatOpacity(map.getZoom()))
    map.on("zoomend", fade)
    return () => {
      map.off("zoomend", fade)
      ov.remove()
      canvasRef.current = null
      onDomain(null)
    }
  }, [grid, map, onDomain])

  // Repaint when the weights change; rapid slider moves collapse into one paint per frame.
  useEffect(() => {
    if (!grid || !canvasRef.current) return
    const canvas = canvasRef.current
    const frame = requestAnimationFrame(() => onDomain(paintHeatmap(canvas, grid, weights)))
    return () => cancelAnimationFrame(frame)
  }, [grid, weights, onDomain])

  return null
}

// ---------- dim everything outside the Netherlands ----------
type Outline = { geometry: { coordinates: [number, number][][][] } }
const WORLD: [number, number][] = [
  [85, -180],
  [85, 180],
  [-85, 180],
  [-85, -180],
]
const MASK: Record<Theme, { fill: string; opacity: number; border: string }> = {
  light: { fill: "#0f172a", opacity: 0.32, border: "#475569" },
  dark: { fill: "#000000", opacity: 0.55, border: "#cbd5e1" },
  oled: { fill: "#000000", opacity: 0.78, border: "#e5e5e5" },
}
function OutsideMask({ theme }: { theme: Theme }) {
  const outline = useLayer<Outline>("nl_outline", true)
  const rings = useMemo(
    () => (outline ? outline.geometry.coordinates.map((poly) => poly[0].map(([x, y]) => [y, x] as [number, number])) : null),
    [outline],
  )
  if (!rings) return null
  return (
    <Pane name="nl-mask" style={{ zIndex: 350 }}>
      <Polygon
        positions={[WORLD, ...rings]}
        interactive={false}
        pathOptions={{ stroke: false, fillColor: MASK[theme].fill, fillOpacity: MASK[theme].opacity, fillRule: "evenodd" }}
      />
      <Polygon
        positions={rings}
        interactive={false}
        pathOptions={{ color: MASK[theme].border, weight: 1.2, opacity: 0.7, fill: false }}
      />
    </Pane>
  )
}

const pinIcon = L.divIcon({
  className: "",
  html: '<div class="site-pin"><span></span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
})

/** Small numbered badge for a search result, colour-coded by its grade. */
function searchPinIcon(rank: number, color: string) {
  return L.divIcon({
    className: "",
    html: `<div class="search-pin" style="background:${color}">${rank}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

// ---------- component ----------
export type SiteMapProps = {
  theme: Theme
  weights: Weights
  onHeatDomain: (d: [number, number] | null) => void
  layers: Record<LayerKey, boolean>
  filters: Filters
  basemap: Basemap
  pin: { lat: number; lon: number } | null
  result: ScoreResult | null
  searchSites: ScoreResult[]
  onPick: (lat: number, lon: number) => void
}

export default function SiteMap({ theme, weights, onHeatDomain, layers, filters, basemap, pin, result, searchSites, onPick }: SiteMapProps) {
  const substations = useLayer<Substation[]>("substations", layers.substations)
  const lines = useLayer<PowerLine[]>("lines", layers.hv)
  const towers = useLayer<Tower[]>("towers", layers.hv)
  const telecom = useLayer<TelecomSite[]>("telecom", layers.telecom)
  const water = useLayer<WaterFeature[]>("water", layers.water)
  const junctions = useLayer<Junction[]>("junctions", layers.junctions)
  const places = useLayer<Place[]>("places", layers.places)
  const seismic = useLayer<SeismicEvent[]>("seismic", layers.seismic)
  const flood = useLayer<FeatureCollection<FloodZone>>("flood", layers.flood)
  const municipalities = useLayer<FeatureCollection<Municipality>>("municipalities", layers.municipalities)
  const parks = useLayer<FeatureCollection<BusinessPark>>("ibis", layers.parks)
  const listings = useLayer<FeatureCollection<Listing>>("plots", layers.plots)

  // Glyph sprites for the current theme (outline and shadow differ per theme).
  const [spriteSet, setSpriteSet] = useState<{ theme: Theme; sprites: Sprites } | null>(null)
  useEffect(() => {
    let live = true
    loadSprites(theme).then((sprites) => live && setSpriteSet({ theme, sprites }))
    return () => {
      live = false
    }
  }, [theme])
  const sprites = spriteSet?.theme === theme ? spriteSet.sprites : null
  const glyph = useCallback(
    (kind: GlyphKind, radius: number): PointStyle =>
      sprites ? { radius, sprite: sprites[kind].full, dotSprite: sprites[kind].dot } : null,
    [sprites],
  )

  const minKv = Number(filters.voltage)
  const placeFill = theme === "light" ? "#334155" : "#e4e4e7"

  const substationStyle = useCallback(
    (s: Substation): PointStyle => (s.kv < minKv ? null : s.kv >= 380 ? glyph("sub380", 15) : glyph("sub", 12)),
    [minKv, glyph],
  )
  const substationTip = useCallback((s: Substation) => titled(s.name, `${s.kv} kV substation`), [])

  const lineStyle = useCallback(
    (l: PowerLine): PointStyle =>
      l.kv < minKv ? null : { radius: 2.4, stroke: false, fillColor: l.kv >= 380 ? POWER_380 : POWER_HV, fillOpacity: 0.85 },
    [minKv],
  )
  const lineTip = useCallback((l: PowerLine) => titled(l.name, `${l.kv} kV line`), [])
  // Pylons carry no voltage tag, so they only show when the filter allows 110 kV+.
  const towerStyle = useCallback(
    (): PointStyle => (minKv > 110 ? null : { radius: 1.4, stroke: false, fillColor: POWER_HV, fillOpacity: 0.55 }),
    [minKv],
  )

  const telecomStyle = useCallback(
    (t: TelecomSite): PointStyle => (t.type === "data_center" ? glyph("dc", 15) : glyph("exchange", 9)),
    [glyph],
  )
  const telecomTip = useCallback(
    (t: TelecomSite) => titled(t.name, t.type === "data_center" ? "Data centre" : "Telecom exchange"),
    [],
  )

  const waterStyle = useCallback(
    (w: WaterFeature): PointStyle => ({ radius: w.type === "lake" || w.type === "reservoir" ? 2.6 : 1.5, stroke: false, fillColor: "#38bdf8", fillOpacity: 0.7 }),
    [],
  )
  const junctionStyle = useCallback((): PointStyle => glyph("junction", 7.5), [glyph])
  const junctionTip = useCallback((j: Junction) => titled(j.name, "Motorway junction"), [])

  const minRank = PLACE_RANK[filters.minPlace]
  const placeStyle = useCallback(
    (p: Place): PointStyle =>
      PLACE_RANK[p.type] < minRank
        ? null
        : { radius: 2.5 + p.w * 8, color: placeFill, weight: 1, opacity: 0.6, fillColor: placeFill, fillOpacity: 0.18 },
    [minRank, placeFill],
  )
  const placeTip = useCallback((p: Place) => titled(p.name, p.type), [])

  const minMag = filters.minMagnitude
  const seismicStyle = useCallback(
    (q: SeismicEvent): PointStyle =>
      q.mag < minMag ? null : { radius: 3 + Math.max(0, q.mag) * 2.4, color: "#f87171", weight: 1.5, fillColor: "#ef4444", fillOpacity: 0.12 },
    [minMag],
  )
  const seismicTip = useCallback((q: SeismicEvent) => `<b>M${q.mag.toFixed(1)}</b> · ${q.time}<br/>${esc(q.place)}`, [])

  const floodStyle = useCallback(
    (f?: GeoJSON.Feature) => {
      const t = (f?.properties as FloodZone["properties"] | undefined)?.type ?? ""
      const c = FLOOD_COLORS[t] ?? FLOOD_FALLBACK
      return { color: c, weight: 2, fillColor: c, fillOpacity: t === "D" ? 0.5 : 0.32 }
    },
    [],
  )
  const floodEach = useCallback((f: GeoJSON.Feature, layer: L.Layer) => {
    const p = f.properties as FloodZone["properties"]
    layer.bindTooltip(`<b>${esc(p.basin)} · type ${esc(p.type)}</b><br/>${esc(p.label)}`, { sticky: true })
  }, [])

  // At country zoom the 2 km zones are only a few pixels wide, so mark each one with a ring.
  const floodMarkers = useMemo(
    () =>
      flood?.features.map((f) => {
        const ring = f.geometry.coordinates[0]
        return {
          lat: ring.reduce((a, p) => a + p[1], 0) / ring.length,
          lon: ring.reduce((a, p) => a + p[0], 0) / ring.length,
          ...f.properties,
        }
      }) ?? null,
    [flood],
  )
  const floodMarkerStyle = useCallback((z: { type: string }): PointStyle => {
    const c = FLOOD_COLORS[z.type] ?? FLOOD_FALLBACK
    return { radius: 9, color: c, weight: 2, fillColor: c, fillOpacity: 0.25 }
  }, [])
  const floodMarkerTip = useCallback(
    (z: { basin: string; type: string; label: string }) => `<b>${esc(z.basin)} · type ${esc(z.type)}</b><br/>${esc(z.label)}`,
    [],
  )

  const parkStyle = useCallback((f?: GeoJSON.Feature) => {
    const available = ((f?.properties as BusinessPark["properties"] | undefined)?.haAvailable ?? 0) > 0
    const c = available ? PARK_AVAILABLE : PARK_FULL
    return { color: c, weight: 1.5, opacity: 0.9, fillColor: c, fillOpacity: available ? 0.22 : 0.08 }
  }, [])
  const parkEach = useCallback((f: GeoJSON.Feature, layer: L.Layer) => {
    const p = f.properties as BusinessPark["properties"]
    const lines = [`<b>${esc(p.name)}</b> · ${esc(p.municipality)}`]
    if (p.haNet) lines.push(`${p.haNet} ha net${p.haAvailable ? `, <b>${p.haAvailable} ha available</b>` : ", fully taken"}`)
    if (p.priceMin) lines.push(`Land €${p.priceMin}${p.priceMax && p.priceMax !== p.priceMin ? `–${p.priceMax}` : ""}/m²`)
    if (p.maxEnvCategory) lines.push(`Max environmental category ${esc(p.maxEnvCategory)}`)
    lines.push(`<span style="opacity:.7">IBIS ${p.year}</span>`)
    layer.bindTooltip(lines.join("<br/>"), { sticky: true })
  }, [])
  // Plots for sale (synthetic demo data): clicking one drops the pin on it and scores it.
  const listingTip = useCallback((p: ListingProps) => {
    const size = p.areaM2 >= 10_000 ? `${(p.areaM2 / 10_000).toFixed(1)} ha` : `${p.areaM2.toLocaleString("en-GB")} m²`
    return [
      `<b>${LISTING_LABELS[p.status]}</b> · ${size}`,
      `<b>€${p.perM2}/m²</b> · €${(p.total / 1e6).toFixed(2)}M`,
      esc(`${p.parkName}, ${p.municipality}`),
      `<span style="opacity:.7">Synthetic demo listing · click to score</span>`,
    ].join("<br/>")
  }, [])
  const listingStyle = useCallback((f?: GeoJSON.Feature) => {
    const c = LISTING_COLORS[(f?.properties as ListingProps | undefined)?.status ?? "for_sale"]
    return { color: c, weight: 2, opacity: 1, fillColor: c, fillOpacity: 0.35 }
  }, [])
  const listingEach = useCallback(
    (f: GeoJSON.Feature, layer: L.Layer) => {
      const p = f.properties as ListingProps
      layer.bindTooltip(listingTip(p), { sticky: true })
      layer.on("click", () => onPick(p.lat, p.lon))
    },
    [listingTip, onPick],
  )
  const listingMarkers = useMemo(() => listings?.features.map((f) => f.properties) ?? null, [listings])
  const listingMarkerStyle = useCallback(
    (p: ListingProps): PointStyle => ({ radius: 4, color: LISTING_COLORS[p.status], weight: 1.5, fillColor: LISTING_COLORS[p.status], fillOpacity: 0.55 }),
    [],
  )
  const pickListing = useCallback((p: ListingProps) => onPick(p.lat, p.lon), [onPick])

  const parcel = pin && result?.plot?.parcel ? result.plot.parcel : null
  const parcelRings = useMemo(
    () => parcel?.geometry.coordinates.map((poly) => poly.map((ring) => ring.map(([x, y]) => [y, x] as [number, number]))) ?? null,
    [parcel],
  )

  const tile = BASEMAPS[basemap]
  const evidence = useMemo(() => (result && pin ? result.points : []), [result, pin])

  return (
    <MapContainer
      center={NL_CENTER}
      zoom={8}
      minZoom={7}
      maxBounds={NL_BOUNDS.pad(0.3)}
      maxBoundsViscosity={0.8}
      preferCanvas
      zoomControl={false}
      className="h-full w-full"
    >
      <TileLayer key={basemap} url={tile.url} attribution={tile.attribution} maxNativeZoom={tile.maxNativeZoom} maxZoom={19} />
      {layers.heatmap && <ScoreHeatmap weights={weights} onDomain={onHeatDomain} />}
      <OutsideMask theme={theme} />
      <ZoomControl position="bottomright" />
      <ClickToPin onPick={onPick} />
      <FitToEvidence result={result} />
      <FitToSearch sites={searchSites} />

      {municipalities && (
        <GeoJSON
          data={municipalities as unknown as GeoJSON.FeatureCollection}
          interactive={false}
          style={{ color: "#94a3b8", weight: 0.6, fill: false }}
        />
      )}
      {flood && (
        <GeoJSON data={flood as unknown as GeoJSON.FeatureCollection} style={floodStyle} onEachFeature={floodEach} />
      )}
      {parks && (
        <GeoJSON data={parks as unknown as GeoJSON.FeatureCollection} style={parkStyle} onEachFeature={parkEach} />
      )}
      {listings && (
        <GeoJSON
          data={listings as unknown as GeoJSON.FeatureCollection}
          style={listingStyle}
          onEachFeature={listingEach}
          bubblingMouseEvents={false}
        />
      )}
      <PointLayer items={listingMarkers} styleFor={listingMarkerStyle} tooltipFor={listingTip} onClick={pickListing} maxZoom={11} />
      {layers.parcels && (
        <Pane name="parcels" style={{ zIndex: 345 }}>
          <WMSTileLayer
            url="https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0"
            params={{ layers: "Perceel", format: "image/png", transparent: true, version: "1.3.0" }}
            minZoom={15}
            maxZoom={19}
            className="parcel-wms"
            attribution="Kadaster"
          />
        </Pane>
      )}
      {parcelRings && (
        <Polygon
          positions={parcelRings}
          interactive={false}
          pathOptions={{ color: theme === "light" ? "#0f172a" : "#ffffff", weight: 2.5, dashArray: "6 4", fillColor: "#ffffff", fillOpacity: 0.12 }}
        />
      )}

      <PointLayer items={floodMarkers} styleFor={floodMarkerStyle} tooltipFor={floodMarkerTip} maxZoom={10} />
      <PointLayer items={water} styleFor={waterStyle} />
      <PointLayer items={towers} styleFor={towerStyle} />
      <PointLayer items={lines} styleFor={lineStyle} tooltipFor={lineTip} />
      <PointLayer items={places} styleFor={placeStyle} tooltipFor={placeTip} />
      <PointLayer items={junctions} styleFor={junctionStyle} tooltipFor={junctionTip} />
      <PointLayer items={seismic} styleFor={seismicStyle} tooltipFor={seismicTip} />
      <PointLayer items={substations} styleFor={substationStyle} tooltipFor={substationTip} />
      <PointLayer items={telecom} styleFor={telecomStyle} tooltipFor={telecomTip} />

      {pin &&
        evidence.map((p, i) => (
          <Polyline
            key={`${i}-${p.lat}-${p.lon}`}
            positions={[
              [pin.lat, pin.lon],
              [p.lat, p.lon],
            ]}
            pathOptions={{ color: FACTOR_COLORS[p.factor], weight: 2, dashArray: "4 6", opacity: 0.9 }}
          />
        ))}
      {pin && <Marker position={[pin.lat, pin.lon]} icon={pinIcon} />}

      {searchSites.map((s, i) => (
        <Marker
          key={`search-${s.lat}-${s.lon}`}
          position={[s.lat, s.lon]}
          icon={searchPinIcon(i + 1, GRADE_HEX[grade(s.score).tone])}
          eventHandlers={{ click: () => onPick(s.lat, s.lon) }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            <b>
              #{i + 1} · {s.score.toFixed(0)}/100
            </b>
            <br />
            {s.lat.toFixed(4)}, {s.lon.toFixed(4)}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  )
}
