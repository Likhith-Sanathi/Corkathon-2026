import { Reveal } from "@/components/reveal";

const steps = [
  {
    number: "01",
    title: "Type a place",
    description:
      "Any city, town, or region in Europe. We resolve it to exact coordinates.",
  },
  {
    number: "02",
    title: "We pull the evidence",
    description:
      "Live queries to OpenStreetMap, Open-Meteo, and the EMSC seismic network — the actual underlying data, not a guess.",
  },
  {
    number: "03",
    title: "Get a transparent score",
    description:
      "Isolation, water, power, climate, and risk — each with its own score, source, and the nearby places that drove it.",
  },
];

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
              <span className="font-mono text-sm text-primary/60">
                {step.number}
              </span>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
