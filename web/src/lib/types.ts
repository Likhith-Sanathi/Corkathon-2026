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
}
