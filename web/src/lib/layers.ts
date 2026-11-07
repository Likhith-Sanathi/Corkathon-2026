import type { GlyphKind } from "./glyphs"
import type { FactorKey } from "./types"

export type LayerKey =
  | "heatmap"
  | "plots"
  | "flood"
  | "substations"
  | "hv"
  | "telecom"
  | "water"
  | "junctions"
  | "places"
  | "seismic"
  | "municipalities"
  | "parks"
  | "parcels"

export type LayerDef = {
  key: LayerKey
  label: string
  hint: string
  color: string
  files: string[]
  defaultOn: boolean
  /** Map glyph shown next to the toggle instead of a colour dot. */
  icon?: GlyphKind
  /** Sub-categories shown under the toggle, as a map glyph or a colour swatch. */
  legend?: { label: string; glyph?: GlyphKind; color?: string }[]
}

export const LISTING_COLORS: Record<"for_sale" | "under_offer", string> = { for_sale: "#06b6d4", under_offer: "#a855f7" }
export const LISTING_LABELS: Record<"for_sale" | "under_offer", string> = { for_sale: "For sale", under_offer: "Under offer" }
export const PARK_AVAILABLE = "#ec4899"
export const PARK_FULL = "#94a3b8"
export const POWER_380 = "#dc2626"
export const POWER_HV = "#f59e0b"
export const FLOOD_COLORS: Record<string, string> = { B: "#7dd3fc", D: "#3b82f6" }
export const FLOOD_FALLBACK = "#a5b4fc"

/** Viridis: perceptually even and colour-blind safe, readable on light and dark basemaps. */
export const HEAT_RAMP = ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"]

export const LAYERS: LayerDef[] = [
  {
    key: "heatmap",
    label: "Site score heatmap",
    hint: "~500 m grid",
    color: "#21918c",
    files: ["grid"],
    defaultOn: true,
  },
  {
    key: "plots",
    label: "Plots for sale",
    hint: "synthetic demo",
    color: LISTING_COLORS.for_sale,
    files: ["plots"],
    defaultOn: true,
    legend: [
      { color: LISTING_COLORS.for_sale, label: LISTING_LABELS.for_sale },
      { color: LISTING_COLORS.under_offer, label: LISTING_LABELS.under_offer },
    ],
  },
  {
    key: "substations",
    label: "Substations ≥110 kV",
    hint: "power.csv",
    color: POWER_HV,
    files: ["substations"],
    defaultOn: true,
    icon: "sub380",
    legend: [
      { glyph: "sub380", label: "380 kV" },
      { glyph: "sub", label: "110–220 kV" },
    ],
  },
  { key: "hv", label: "HV lines & pylons", hint: "power.csv", color: "#fbbf24", files: ["lines", "towers"], defaultOn: false },
  {
    key: "telecom",
    label: "Data centres & exchanges",
    hint: "telecom.csv",
    color: "#10b981",
    files: ["telecom"],
    defaultOn: true,
    icon: "dc",
    legend: [
      { glyph: "dc", label: "Data centre" },
      { glyph: "exchange", label: "Exchange" },
    ],
  },
  { key: "water", label: "Rivers, canals & lakes", hint: "water.csv", color: "#0ea5e9", files: ["water"], defaultOn: false },
  { key: "junctions", label: "Motorway junctions", hint: "roads.csv", color: "#7c3aed", files: ["junctions"], defaultOn: false, icon: "junction" },
  { key: "places", label: "Settlements", hint: "isolation.csv", color: "#64748b", files: ["places"], defaultOn: false },
  {
    key: "flood",
    label: "Flood risk zones",
    hint: "flood.csv",
    color: "#3b82f6",
    files: ["flood"],
    defaultOn: false,
    legend: [
      { color: "#3b82f6", label: "Unprotected" },
      { color: "#7dd3fc", label: "Protected" },
      { color: "#a5b4fc", label: "Other" },
    ],
  },
  { key: "seismic", label: "Earthquakes", hint: "seismic.csv", color: "#f87171", files: ["seismic"], defaultOn: false },
  {
    key: "parks",
    label: "Business parks",
    hint: "IBIS 2019 · zoom in",
    color: PARK_AVAILABLE,
    files: ["ibis"],
    defaultOn: true,
    legend: [
      { color: PARK_AVAILABLE, label: "Land available" },
      { color: PARK_FULL, label: "Fully taken" },
    ],
  },
  { key: "parcels", label: "Cadastral parcels", hint: "Kadaster · zoom in", color: "#a3a3a3", files: [], defaultOn: true },
  { key: "municipalities", label: "Municipal borders", hint: "PDOK", color: "#94a3b8", files: ["municipalities"], defaultOn: true },
]

export const FACTOR_COLORS: Record<FactorKey, string> = {
  power: "#f59e0b",
  isolation: "#64748b",
  telecom: "#10b981",
  water: "#0ea5e9",
  roads: "#8b5cf6",
}

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
