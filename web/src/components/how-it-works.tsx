import { Reveal } from "@/components/reveal"

const steps = [
  {
    number: "01",
    title: "Drop a pin or search a place",
    description: "Click anywhere in the Netherlands on the map, or type a town or region name to jump there.",
  },
  {
    number: "02",
    title: "We pull the evidence",
    description:
      "Live distances to substations, telecom exchanges, rivers, and motorway junctions — from OpenStreetMap, PDOK and EMSC, not a guess.",
  },
  {
    number: "03",
    title: "Get a transparent, weighted score",
    description:
      "Every factor shows its own score and the evidence behind it. Adjust the weights to match what matters to you.",
  },
]

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20 sm:px-10">
      <Reveal>
        <h2 className="mb-12 text-center text-sm font-medium tracking-wide text-muted-foreground uppercase">
          How it works
        </h2>
      </Reveal>
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
        {steps.map((step, index) => (
          <Reveal key={step.number} delay={index * 0.1}>
            <div className="flex flex-col gap-3">
              <span className="font-mono text-sm text-primary/60">{step.number}</span>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
