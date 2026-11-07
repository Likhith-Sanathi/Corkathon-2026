import { MapPinOff, Droplets, Zap, Thermometer, ShieldAlert, Info } from "lucide-react";
import { FACTOR_INFO, type FactorKey } from "@/lib/factor-info";

const ICONS: Record<FactorKey, typeof MapPinOff> = {
  isolation: MapPinOff,
  water: Droplets,
  power: Zap,
  climate: Thermometer,
  risk: ShieldAlert,
};

export function ExploreSidebar() {
  return (
    <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          What goes into the score
        </h2>
        <ul className="flex flex-col gap-4">
          {FACTOR_INFO.map((factor) => {
            const Icon = ICONS[factor.key];
            return (
              <li key={factor.key} className="flex gap-3">
                <div
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${factor.color}1a` }}
                >
                  <Icon className="size-4" style={{ color: factor.color }} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{factor.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {factor.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70">
                    {factor.source}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex gap-2.5 rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0 translate-y-0.5" />
        <p>
          The overall score is a weighted blend of the five factors above
          (power and water count most, isolation least). Isolation, water,
          and power are scored from a local Netherlands dataset extract —
          power also folds in the host country&apos;s generation mix from
          Ember everywhere else; climate and risk are pulled live across all
          of Europe. Treat it as a starting point for comparison, not a
          final verdict — a factor marked{" "}
          <span className="font-medium">N/A</span> means that data source
          didn&apos;t respond or doesn&apos;t cover this location yet, not
          that the risk is zero, and a score shown below 100% confidence
          means part of the weight is missing data.
        </p>
      </div>
    </aside>
  );
}
