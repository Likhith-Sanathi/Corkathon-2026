/**
 * Data centre site score for a point in the Netherlands.
 *
 *   score = 100 × suitability × risk
 *   suitability = Σ wᵢ·sᵢ over power, isolation, telecom, water, roads (each sᵢ in 0..1)
 *   risk = flood multiplier × seismic multiplier (each 0..1)
 *
 * Distance-based factors use exponential decay s = e^(−d/λ): 1 at the feature,
 * 0.37 at d = λ. Every factor returns the evidence it was computed from.
 */
import { haversineKm, inPolygon, nearest, within } from "./geo"
import type {
  Dataset,
  EvidencePoint,
  FactorKey,
  FactorResult,
  RiskResult,
  ScoreResult,
  Weights,
} from "./types"

export const DEFAULT_WEIGHTS: Weights = {
  power: 0.35,
  isolation: 0.2,
  telecom: 0.2,
  water: 0.15,
  roads: 0.1,
}

export const FACTOR_LABELS: Record<FactorKey, string> = {
  power: "Power grid",
  isolation: "Isolation",
  telecom: "Telecom",
  water: "Water",
  roads: "Road access",
}

/** Decay lengths (km) and other tunables, kept together so they are easy to adjust. */
export const PARAMS = {
  substationLambda: 3,
  lineLambda: 2,
  extraHighVoltageKv: 380,
  extraHighVoltageBonus: 1.2,
  placeLambda: 2,
  placeRadius: 15,
  telecomLambda: 10,
  dataCentreRadius: 25,
  waterLambda: 3,
  roadLambda: 5,
  seismicRadius: 25,
  seismicLambda: 10,
  // An M4.5 event at the site gives H = 1 (multiplier 0.5). Each magnitude unit below
  // that counts 10× less, so swarms of small induced quakes barely move the score.
  seismicReferenceMagnitude: 4.5,
  flood: { B: 0.7, D: 0.2, other: 0.5 } as Record<string, number>,
}

const decay = (km: number, lambda: number) => Math.exp(-km / lambda)
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`)
const named = (name: string, fallback: string) => (name && name.trim() ? name : fallback)

export function normaliseWeights(w: Weights): Weights {
  const total = Object.values(w).reduce((a, b) => a + Math.max(0, b), 0)
  if (total <= 0) return { ...DEFAULT_WEIGHTS }
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, Math.max(0, v) / total])) as Weights
}

/** Municipality containing the point, or null when it is outside the Netherlands. */
export function locate(data: Dataset, lat: number, lon: number) {
  for (const m of data.municipalities.features) {
    for (const poly of m.geometry.coordinates) {
      if (inPolygon(lon, lat, poly)) return m.properties
    }
  }
  return null
}

export function scoreLocation(
  data: Dataset,
  lat: number,
  lon: number,
  weightsIn: Weights = DEFAULT_WEIGHTS,
): ScoreResult | null {
  const where = locate(data, lat, lon)
  if (!where) return null
  const weights = normaliseWeights(weightsIn)
  const points: EvidencePoint[] = []
  const factors: FactorResult[] = []

  // ---- Power: nearest ≥110 kV substation and nearest high-voltage line or pylon
  {
    const evidence: string[] = []
    const sub = nearest(data.substations, lat, lon)
    let sSub = 0
    if (sub) {
      const bonus = sub.item.kv >= PARAMS.extraHighVoltageKv ? PARAMS.extraHighVoltageBonus : 1
      sSub = clamp01(decay(sub.km, PARAMS.substationLambda) * bonus)
      evidence.push(`${sub.item.kv} kV substation ${fmtKm(sub.km)} away (${named(sub.item.name, "unnamed")})`)
      points.push({ lat: sub.item.lat, lon: sub.item.lon, factor: "power", label: `${sub.item.kv} kV substation` })
    }
    const line = nearest(data.lines, lat, lon)
    const tower = nearest(data.towers, lat, lon)
    let sLine = 0
    if (line || tower) {
      const useTower = tower && (!line || tower.km < line.km)
      const km = useTower ? tower!.km : line!.km
      const bonus = !useTower && line!.item.kv >= PARAMS.extraHighVoltageKv ? PARAMS.extraHighVoltageBonus : 1
      sLine = clamp01(decay(km, PARAMS.lineLambda) * bonus)
      evidence.push(useTower ? `High-voltage pylon ${fmtKm(km)} away` : `${line!.item.kv} kV line ${fmtKm(km)} away`)
      const p = useTower ? tower!.item : line!.item
      points.push({ lat: p.lat, lon: p.lon, factor: "power", label: useTower ? "HV pylon" : `${line!.item.kv} kV line` })
    }
    factors.push({ key: "power", score: 0.6 * sSub + 0.4 * sLine, weight: weights.power, evidence })
  }

  // ---- Isolation: population pressure from nearby settlements
  {
    const near = within(data.places, lat, lon, PARAMS.placeRadius)
    const pressure = near.reduce((acc, { item, km }) => acc + item.w * decay(km, PARAMS.placeLambda), 0)
    const evidence: string[] = []
    const big = near.filter(({ item }) => item.type === "city" || item.type === "town").sort((a, b) => a.km - b.km)
    if (big[0]) {
      evidence.push(`Nearest ${big[0].item.type}: ${named(big[0].item.name, "unnamed")}, ${fmtKm(big[0].km)}`)
      points.push({ lat: big[0].item.lat, lon: big[0].item.lon, factor: "isolation", label: big[0].item.name })
    } else {
      evidence.push(`No city or town within ${PARAMS.placeRadius} km`)
    }
    const counts = near.reduce<Record<string, number>>((acc, { item }) => ((acc[item.type] = (acc[item.type] ?? 0) + 1), acc), {})
    const plural: Record<string, string> = { city: "cities", town: "towns", suburb: "suburbs", village: "villages", hamlet: "hamlets" }
    const summary = ["city", "town", "suburb", "village", "hamlet"]
      .filter((t) => counts[t])
      .map((t) => `${counts[t]} ${counts[t] > 1 ? plural[t] : t}`)
      .join(", ")
    evidence.push(summary ? `Within ${PARAMS.placeRadius} km: ${summary}` : `No settlements within ${PARAMS.placeRadius} km`)
    factors.push({ key: "isolation", score: 1 / (1 + pressure), weight: weights.isolation, evidence })
  }

  // ---- Telecom: nearest data centre or exchange, plus a data-centre cluster bonus
  {
    const evidence: string[] = []
    const site = nearest(data.telecom, lat, lon)
    const dcs = within(data.telecom.filter((t) => t.type === "data_center"), lat, lon, PARAMS.dataCentreRadius)
    let s = 0
    if (site) {
      s = decay(site.km, PARAMS.telecomLambda)
      const kind = site.item.type === "data_center" ? "Data centre" : "Telecom exchange"
      evidence.push(`${kind} ${fmtKm(site.km)} away (${named(site.item.name, "unnamed")})`)
      points.push({ lat: site.item.lat, lon: site.item.lon, factor: "telecom", label: kind })
    }
    const bonus = Math.min(dcs.length / 10, 0.2)
    evidence.push(`${dcs.length} data centre${dcs.length === 1 ? "" : "s"} within ${PARAMS.dataCentreRadius} km`)
    factors.push({ key: "telecom", score: clamp01(s + bonus), weight: weights.telecom, evidence })
  }

  // ---- Water: nearest river, canal, lake or reservoir
  {
    const evidence: string[] = []
    const w = nearest(data.water, lat, lon)
    let s = 0
    if (w) {
      s = decay(w.km, PARAMS.waterLambda)
      evidence.push(`${w.item.type[0].toUpperCase()}${w.item.type.slice(1)} ${fmtKm(w.km)} away (${named(w.item.name, "unnamed")})`)
      points.push({ lat: w.item.lat, lon: w.item.lon, factor: "water", label: w.item.type })
    }
    factors.push({ key: "water", score: s, weight: weights.water, evidence })
  }

  // ---- Roads: nearest motorway junction
  {
    const evidence: string[] = []
    const j = nearest(data.junctions, lat, lon)
    let s = 0
    if (j) {
      s = decay(j.km, PARAMS.roadLambda)
      evidence.push(`Motorway junction ${fmtKm(j.km)} away (${named(j.item.name, "unnamed")})`)
      points.push({ lat: j.item.lat, lon: j.item.lon, factor: "roads", label: "Motorway junction" })
    }
    factors.push({ key: "roads", score: s, weight: weights.roads, evidence })
  }

  // ---- Risks
  const risks: RiskResult[] = []
  {
    const zones = data.flood.features.filter((f) => inPolygon(lon, lat, f.geometry.coordinates))
    let m = 1
    const evidence: string[] = []
    for (const z of zones) {
      const zm = PARAMS.flood[z.properties.type] ?? PARAMS.flood.other
      m = Math.min(m, zm)
      evidence.push(`${z.properties.basin} type ${z.properties.type}: ${z.properties.label}`)
    }
    if (!zones.length) evidence.push("Outside all mapped flood risk zones")
    risks.push({ key: "flood", multiplier: m, evidence })
  }
  {
    const quakes = within(data.seismic, lat, lon, PARAMS.seismicRadius)
    const hazard = quakes.reduce(
      (acc, { item, km }) => acc + 10 ** (item.mag - PARAMS.seismicReferenceMagnitude) * decay(km, PARAMS.seismicLambda),
      0,
    )
    const evidence: string[] = []
    if (quakes.length) {
      const max = quakes.reduce((a, b) => (b.item.mag > a.item.mag ? b : a))
      evidence.push(`${quakes.length} recorded event${quakes.length === 1 ? "" : "s"} within ${PARAMS.seismicRadius} km since 2000`)
      evidence.push(`Strongest: M${max.item.mag.toFixed(1)} on ${max.item.time}, ${fmtKm(max.km)} away`)
    } else {
      evidence.push(`No recorded events within ${PARAMS.seismicRadius} km since 2000`)
    }
    risks.push({ key: "seismic", multiplier: 1 / (1 + hazard), evidence })
  }

  const suitability = factors.reduce((acc, f) => acc + f.weight * f.score, 0)
  const risk = risks.reduce((acc, r) => acc * r.multiplier, 1)
  return {
    lat,
    lon,
    municipality: where.name,
    province: where.province,
    score: Math.round(100 * suitability * risk * 10) / 10,
    suitability,
    risk,
    factors,
    risks,
    points,
  }
}

export function grade(score: number): { label: string; tone: "great" | "good" | "fair" | "poor" } {
  if (score >= 70) return { label: "Excellent site", tone: "great" }
  if (score >= 50) return { label: "Good site", tone: "good" }
  if (score >= 30) return { label: "Fair site", tone: "fair" }
  return { label: "Poor site", tone: "poor" }
}

export { haversineKm }
