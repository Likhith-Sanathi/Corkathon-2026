"use client"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { GeoJSON, MapContainer, Marker, Pane, Polygon, Polyline, TileLayer, useMap, useMapEvents, ZoomControl } from "react-leaflet"
import {
  BASEMAPS,
  FACTOR_COLORS,
  FLOOD_COLORS,
  FLOOD_FALLBACK,
  PLACE_RANK,
  type Basemap,
  type Filters,
  type LayerKey,
} from "@/lib/layers"
import type { Theme } from "@/lib/theme"
import type {
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
type PointStyle = L.CircleMarkerOptions | null
function PointLayer<T extends Pt>({
  items,
  styleFor,
  tooltipFor,
}: {
  items: T[] | null
  styleFor: (item: T) => PointStyle
  tooltipFor?: (item: T) => string | null
}) {
  const map = useMap()
  useEffect(() => {
    if (!items) return
    const renderer = L.canvas({ padding: 0.5 })
    const group = L.layerGroup()
    for (const it of items) {
      const style = styleFor(it)
      if (!style) continue
      const marker = L.circleMarker([it.lat, it.lon], { renderer, ...style })
      const tip = tooltipFor?.(it)
      if (tip) marker.bindTooltip(tip, { direction: "top", offset: [0, -4] })
      group.addLayer(marker)
    }
    group.addTo(map)
    return () => {
      group.remove()
    }
  }, [map, items, styleFor, tooltipFor])
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

const MARKER_RING: Record<Theme, string> = { light: "#ffffff", dark: "#1f1f22", oled: "#000000" }

const pinIcon = L.divIcon({
  className: "",
  html: '<div class="site-pin"><span></span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
})

// ---------- component ----------
export type SiteMapProps = {
  theme: Theme
  layers: Record<LayerKey, boolean>
  filters: Filters
  basemap: Basemap
  pin: { lat: number; lon: number } | null
  result: ScoreResult | null
  onPick: (lat: number, lon: number) => void
}

export default function SiteMap({ theme, layers, filters, basemap, pin, result, onPick }: SiteMapProps) {
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

  const minKv = Number(filters.voltage)
  // Marker outline matches the map background, so markers read as cut-outs in every theme.
  const ring = MARKER_RING[theme]
  const placeFill = theme === "light" ? "#475569" : "#a1a1aa"

  const substationStyle = useCallback(
    (s: Substation): PointStyle =>
      s.kv < minKv
        ? null
        : { radius: s.kv >= 380 ? 6 : 4, color: ring, weight: 1, fillColor: s.kv >= 380 ? "#ea580c" : "#f59e0b", fillOpacity: 0.95 },
    [minKv, ring],
  )
  const substationTip = useCallback((s: Substation) => titled(s.name, `${s.kv} kV substation`), [])

  const lineStyle = useCallback(
    (l: PowerLine): PointStyle =>
      l.kv < minKv ? null : { radius: 3, stroke: false, fillColor: l.kv >= 380 ? "#ea580c" : "#fbbf24", fillOpacity: 0.9 },
    [minKv],
  )
  const lineTip = useCallback((l: PowerLine) => titled(l.name, `${l.kv} kV line`), [])
  // Pylons carry no voltage tag, so they only show when the filter allows 110 kV+.
  const towerStyle = useCallback(
    (): PointStyle => (minKv > 110 ? null : { radius: 1.5, stroke: false, fillColor: "#d97706", fillOpacity: 0.6 }),
    [minKv],
  )

  const telecomStyle = useCallback(
    (t: TelecomSite): PointStyle => ({
      radius: t.type === "data_center" ? 6 : 3.5,
      color: ring,
      weight: 1,
      fillColor: t.type === "data_center" ? "#059669" : "#34d399",
      fillOpacity: 0.95,
    }),
    [ring],
  )
  const telecomTip = useCallback(
    (t: TelecomSite) => titled(t.name, t.type === "data_center" ? "Data centre" : "Telecom exchange"),
    [],
  )

  const waterStyle = useCallback(
    (w: WaterFeature): PointStyle => ({ radius: w.type === "lake" || w.type === "reservoir" ? 3 : 1.6, stroke: false, fillColor: "#0ea5e9", fillOpacity: 0.55 }),
    [],
  )
  const junctionStyle = useCallback((): PointStyle => ({ radius: 3.5, color: ring, weight: 1, fillColor: "#8b5cf6", fillOpacity: 0.95 }), [ring])
  const junctionTip = useCallback((j: Junction) => titled(j.name, "Motorway junction"), [])

  const minRank = PLACE_RANK[filters.minPlace]
  const placeStyle = useCallback(
    (p: Place): PointStyle =>
      PLACE_RANK[p.type] < minRank ? null : { radius: 2 + p.w * 7, color: ring, weight: 1, fillColor: placeFill, fillOpacity: 0.75 },
    [minRank, ring, placeFill],
  )
  const placeTip = useCallback((p: Place) => titled(p.name, p.type), [])

  const minMag = filters.minMagnitude
  const seismicStyle = useCallback(
    (q: SeismicEvent): PointStyle =>
      q.mag < minMag ? null : { radius: 2 + Math.max(0, q.mag) * 2.2, color: "#b91c1c", weight: 1, fillColor: "#ef4444", fillOpacity: 0.35 },
    [minMag],
  )
  const seismicTip = useCallback((q: SeismicEvent) => `<b>M${q.mag.toFixed(1)}</b> · ${q.time}<br/>${esc(q.place)}`, [])

  const floodStyle = useCallback(
    (f?: GeoJSON.Feature) => {
      const t = (f?.properties as FloodZone["properties"] | undefined)?.type ?? ""
      const c = FLOOD_COLORS[t] ?? FLOOD_FALLBACK
      return { color: c, weight: 1, fillColor: c, fillOpacity: t === "D" ? 0.35 : 0.18 }
    },
    [],
  )
  const floodEach = useCallback((f: GeoJSON.Feature, layer: L.Layer) => {
    const p = f.properties as FloodZone["properties"]
    layer.bindTooltip(`<b>${esc(p.basin)} · type ${esc(p.type)}</b><br/>${esc(p.label)}`, { sticky: true })
  }, [])

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
      <OutsideMask theme={theme} />
      <ZoomControl position="bottomright" />
      <ClickToPin onPick={onPick} />
      <FitToEvidence result={result} />

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
    </MapContainer>
  )
}
