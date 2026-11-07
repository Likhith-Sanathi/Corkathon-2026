import { Reveal } from "@/components/reveal"

const sources = [
  { name: "OpenStreetMap", detail: "power, water, roads, settlements, telecom" },
  { name: "PDOK / Rijkswaterstaat", detail: "flood risk zones" },
  { name: "EMSC Seismic Portal", detail: "earthquakes since 2000" },
  { name: "Kadaster / IBIS", detail: "cadastral parcels & business parks" },
]

export function DataSources() {
  return (
    <section className="border-t">
      <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-10">
        <Reveal>
          <p className="mb-8 text-center text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Built on real, public data — not estimates
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {sources.map((source) => (
              <div key={source.name} className="text-center">
                <p className="font-medium">{source.name}</p>
                <p className="text-xs text-muted-foreground">{source.detail}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
