import { Droplets, Radio, Route, ShieldAlert, Signpost, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Reveal } from "@/components/reveal"
import { FACTOR_COLORS } from "@/lib/layers"
import { FACTOR_LABELS } from "@/lib/scoring"
import type { FactorKey } from "@/lib/types"

const ICONS: Record<FactorKey, typeof Zap> = {
  power: Zap,
  isolation: Signpost,
  telecom: Radio,
  water: Droplets,
  roads: Route,
}

const DESCRIPTIONS: Record<FactorKey, string> = {
  power: "Distance to the nearest substation and high-voltage line, with a bonus for 380 kV capacity.",
  isolation: "How far the site sits from cities, towns and villages — for safety, security and land availability.",
  telecom: "Distance to the nearest telecom exchange or data centre, plus a bonus for nearby data-centre clusters.",
  water: "Distance to the nearest river, canal, lake or reservoir — a cooling source candidate.",
  roads: "Distance to the nearest motorway junction for construction and operational access.",
}

const RISK_COLOR = "#ef4444"

export function FactorsSection() {
  const factors = Object.keys(FACTOR_LABELS) as FactorKey[]
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20 sm:px-10">
      <Reveal>
        <h2 className="mb-10 text-center text-sm font-medium tracking-wide text-muted-foreground uppercase">
          What we check for every site
        </h2>
      </Reveal>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {factors.map((key, index) => {
          const Icon = ICONS[key]
          return (
            <Reveal key={key} delay={(index % 3) * 0.08}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="mb-1 flex size-9 items-center justify-center rounded-lg" style={{ background: `${FACTOR_COLORS[key]}1a` }}>
                    <Icon className="size-4.5" style={{ color: FACTOR_COLORS[key] }} />
                  </div>
                  <CardTitle>{FACTOR_LABELS[key]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{DESCRIPTIONS[key]}</p>
                </CardContent>
              </Card>
            </Reveal>
          )
        })}
        <Reveal delay={(factors.length % 3) * 0.08}>
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="mb-1 flex size-9 items-center justify-center rounded-lg" style={{ background: `${RISK_COLOR}1a` }}>
                <ShieldAlert className="size-4.5" style={{ color: RISK_COLOR }} />
              </div>
              <CardTitle>Flood & seismic risk</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                A multiplier that discounts the score inside mapped flood zones or near recorded earthquakes since 2000.
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </section>
  )
}
