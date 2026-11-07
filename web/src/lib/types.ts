/** Shapes of the JSON layers built by scripts/build_data.py (web/public/data). */

export type Substation = { lat: number; lon: number; kv: number; name: string }
export type PowerLine = { lat: number; lon: number; kv: number; name: string }
export type Tower = { lat: number; lon: number }
export type WaterFeature = { lat: number; lon: number; type: string; name: string }
export type Junction = { lat: number; lon: number; name: string }
export type Place = { lat: number; lon: number; type: string; w: number; name: string }
export type TelecomSite = { lat: number; lon: number; type: "data_center" | "exchange"; name: string }
export type SeismicEvent = { lat: number; lon: number; mag: number; time: string; depth: string; place: string }

export type Ring = [number, number][]
export type FloodZone = {
  type: "Feature"
  properties: { id: string; basin: string; type: string; label: string }
  geometry: { type: "Polygon"; coordinates: Ring[] }
}
export type Municipality = {
  type: "Feature"
  properties: { name: string; province: string }
  geometry: { type: "MultiPolygon"; coordinates: Ring[][] }
}
export type FeatureCollection<F> = { type: "FeatureCollection"; features: F[] }

/** A business park from IBIS (2019): available land, prices and the environmental category allowed. */
export type BusinessParkProps = {
  id: string
  name: string
  place: string
  municipality: string
  year: number
  haGross: number | null
  haNet: number | null
  haAvailable: number | null
  priceMin: number | null // land sale price, EUR per m²
  priceMax: number | null
  maxEnvCategory: string | null
}
export type BusinessPark = {
  type: "Feature"
  properties: BusinessParkProps
  geometry: { type: "MultiPolygon"; coordinates: Ring[][] }
}

/** The cadastral parcel under a point (Kadaster, live from PDOK). */
export type Parcel = {
  id: string // e.g. "Uithuizermeeden M 41"
  areaM2: number
  geometry: { type: "MultiPolygon"; coordinates: Ring[][] }
}

export type PlotInfo = {
  parcel: Parcel | null
  parcelError?: string
  businessPark: BusinessParkProps | null
  /** Closest business park edge when the point is not inside one (within 15 km). */
  nearestPark?: { park: BusinessParkProps; km: number } | null
}

export type Dataset = {
  substations: Substation[]
  lines: PowerLine[]
  towers: Tower[]
  water: WaterFeature[]
  junctions: Junction[]
  places: Place[]
  telecom: TelecomSite[]
  seismic: SeismicEvent[]
  flood: FeatureCollection<FloodZone>
  municipalities: FeatureCollection<Municipality>
  ibis?: FeatureCollection<BusinessPark>
}

export type FactorKey = "power" | "isolation" | "telecom" | "water" | "roads"
export type Weights = Record<FactorKey, number>

/** A feature the score depends on, drawn on the map as a line from the pin. */
export type EvidencePoint = { lat: number; lon: number; label: string; factor: FactorKey }

export type FactorResult = {
  key: FactorKey
  score: number // 0..1
  weight: number // normalised, sums to 1 across factors
  evidence: string[]
}

export type RiskResult = {
  key: "flood" | "seismic"
  multiplier: number // 0..1
  evidence: string[]
}

export type ScoreResult = {
  lat: number
  lon: number
  municipality: string
  province: string
  score: number // 0..100
  suitability: number // 0..1
  risk: number // 0..1
  factors: FactorResult[]
  risks: RiskResult[]
  points: EvidencePoint[]
  plot?: PlotInfo
}
