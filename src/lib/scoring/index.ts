import type { LatLon } from "./geo";
import { evaluateIsolation } from "./isolation";
import { evaluateWater } from "./water";
import { evaluatePower } from "./power";
import { evaluateClimate } from "./climate";
import { evaluateRisk } from "./risk";
import type { FactorResult, Marker } from "./types";

export type SiteScore = {
  overallScore: number | null;
  confidence: number;
  factors: FactorResult[];
  markers: Marker[];
};

// Relative importance of each factor in the overall score. These aren't
// arbitrary: power and water are the two things that can make a site
// physically infeasible (no connection point, no cooling source) or drive
// its lifetime operating cost the most, so they carry the most weight.
// Climate matters almost as much — it's a direct, continuous cooling-cost
// driver. Natural disaster risk is weighted on par with climate because an
// uninsurable or flood-prone site is a hard blocker, not just a cost
// adjustment. Isolation carries the least weight: it affects land cost and
// security, but a well-isolated site with no power or water nearby is
// still a bad site.
const FACTOR_WEIGHTS: Record<FactorResult["key"], number> = {
  power: 0.25,
  water: 0.2,
  climate: 0.2,
  risk: 0.2,
  isolation: 0.15,
};

/**
 * Weighted composite of the available factor scores. Missing factors
 * (a failed API call) are dropped and the remaining weights are
 * renormalized so they still sum to 1 — a site isn't penalized just
 * because one data source was unreachable, but `confidence` reports how
 * much of the weight was actually backed by data.
 */
function weightedOverallScore(factors: FactorResult[]): {
  overallScore: number | null;
  confidence: number;
} {
  const scored = factors.filter(
    (factor): factor is FactorResult & { score: number } =>
      factor.score != null,
  );

  const totalWeight = Object.values(FACTOR_WEIGHTS).reduce((a, b) => a + b, 0);
  const availableWeight = scored.reduce(
    (sum, factor) => sum + FACTOR_WEIGHTS[factor.key],
    0,
  );

  if (availableWeight === 0) {
    return { overallScore: null, confidence: 0 };
  }

  const overallScore = scored.reduce(
    (sum, factor) =>
      sum + factor.score * (FACTOR_WEIGHTS[factor.key] / availableWeight),
    0,
  );

  return { overallScore, confidence: availableWeight / totalWeight };
}

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
  const { overallScore, confidence } = weightedOverallScore(factors);

  const markers: Marker[] = factors.flatMap((factor) => factor.markers);

  return { overallScore, confidence, factors, markers };
}
