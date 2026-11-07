import type { LatLon } from "./geo";
import { evaluateIsolation } from "./isolation";
import { evaluateWater } from "./water";
import { evaluatePower } from "./power";
import { evaluateClimate } from "./climate";
import { evaluateRisk } from "./risk";
import type { FactorResult, Marker } from "./types";

export type SiteScore = {
  overallScore: number | null;
  factors: FactorResult[];
  markers: Marker[];
};

export async function scoreSite(
  origin: LatLon,
  country?: string | null,
): Promise<SiteScore> {
  const [isolation, water, power, climate, risk] = await Promise.all([
    evaluateIsolation(origin, country),
    evaluateWater(origin, country),
    evaluatePower(origin, country),
    evaluateClimate(origin),
    evaluateRisk(origin),
  ]);

  const factors = [isolation, water, power, climate, risk];
  const scored = factors.filter(
    (factor): factor is FactorResult & { score: number } =>
      factor.score != null,
  );

  const overallScore =
    scored.length > 0
      ? scored.reduce((sum, factor) => sum + factor.score, 0) / scored.length
      : null;

  const markers: Marker[] = factors.flatMap((factor) => factor.markers);

  return { overallScore, factors, markers };
}
