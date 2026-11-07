import type { FactorKey } from "./types"

export type LayerKey =
  | "flood"
  | "substations"
  | "hv"
  | "telecom"
  | "water"
  | "junctions"
  | "places"
  | "seismic"
  | "municipalities"

export type LayerDef = {
  key: LayerKey
  label: string
  hint: string
  color: string
  files: string[]
  defaultOn: boolean
}

export const LAYERS: LayerDef[] = [
  { key: "substations", label: "Substations ≥110 kV", hint: "power.csv", color: "#f59e0b", files: ["substations"], defaultOn: true },
  { key: "hv", label: "HV lines & pylons", hint: "power.csv", color: "#fbbf24", files: ["lines", "towers"], defaultOn: false },
  { key: "telecom", label: "Data centres & exchanges", hint: "telecom.csv", color: "#10b981", files: ["telecom"], defaultOn: true },
  { key: "water", label: "Rivers, canals & lakes", hint: "water.csv", color: "#0ea5e9", files: ["water"], defaultOn: false },
  { key: "junctions", label: "Motorway junctions", hint: "roads.csv", color: "#8b5cf6", files: ["junctions"], defaultOn: false },
  { key: "places", label: "Settlements", hint: "isolation.csv", color: "#64748b", files: ["places"], defaultOn: false },
  { key: "flood", label: "Flood risk zones", hint: "flood.csv", color: "#3b82f6", files: ["flood"], defaultOn: true },
  { key: "seismic", label: "Earthquakes", hint: "seismic.csv", color: "#ef4444", files: ["seismic"], defaultOn: false },
  { key: "municipalities", label: "Municipal borders", hint: "PDOK", color: "#94a3b8", files: ["municipalities"], defaultOn: false },
]

export const FACTOR_COLORS: Record<FactorKey, string> = {
  power: "#f59e0b",
  isolation: "#64748b",
  telecom: "#10b981",
  water: "#0ea5e9",
  roads: "#8b5cf6",
}

export const FLOOD_COLORS: Record<string, string> = { B: "#60a5fa", D: "#1d4ed8" }
export const FLOOD_FALLBACK = "#93c5fd"

export type VoltageFilter = "110" | "220" | "380"
export type PlaceFilter = "hamlet" | "village" | "suburb" | "town" | "city"
export const PLACE_RANK: Record<string, number> = { hamlet: 0, village: 1, suburb: 2, town: 3, city: 4 }

export type Filters = { voltage: VoltageFilter; minPlace: PlaceFilter; minMagnitude: number }
export const DEFAULT_FILTERS: Filters = { voltage: "110", minPlace: "town", minMagnitude: 1.5 }

// All keyless. PDOK BRT Achtergrondkaart is the official Dutch basemap (Kadaster).
const PDOK = "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0"
const KADASTER = 'Kaartgegevens &copy; <a href="https://www.kadaster.nl">Kadaster</a>'
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas"
const ESRI_ATTR = "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
export type Basemap = "light" | "dark" | "color" | "osm"
export const BASEMAPS: Record<Basemap, { label: string; url: string; attribution: string; maxNativeZoom: number; dark?: boolean }> = {
  light: { label: "Light", url: `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, attribution: ESRI_ATTR, maxNativeZoom: 16 },
  dark: { label: "Dark", url: `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, attribution: ESRI_ATTR, maxNativeZoom: 16, dark: true },
  color: { label: "Dutch topo (PDOK)", url: `${PDOK}/standaard/EPSG:3857/{z}/{x}/{y}.png`, attribution: KADASTER, maxNativeZoom: 19 },
  osm: {
    label: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
}
