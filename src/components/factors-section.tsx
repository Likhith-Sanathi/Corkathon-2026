import { MapPinOff, Droplets, Zap, Thermometer, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/reveal";
import { FACTOR_INFO, type FactorKey } from "@/lib/factor-info";

const ICONS: Record<FactorKey, typeof MapPinOff> = {
  isolation: MapPinOff,
  water: Droplets,
  power: Zap,
  climate: Thermometer,
  risk: ShieldAlert,
};

export function FactorsSection() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20 sm:px-10">
      <Reveal>
        <h2 className="mb-10 text-center text-sm font-medium tracking-wide text-muted-foreground uppercase">
          What we check for every site
        </h2>
      </Reveal>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FACTOR_INFO.map((factor, index) => {
          const Icon = ICONS[factor.key];
          return (
            <Reveal key={factor.key} delay={(index % 3) * 0.08}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-4.5 text-primary" />
                  </div>
                  <CardTitle>{factor.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {factor.description}
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
