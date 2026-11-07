import fs from "node:fs";
import path from "node:path";
import { clamp } from "./geo";

type CountryMix = {
  asOf: string;
  totalGenerationTwh: number;
  yoyGrowthPct: number | null;
  renewableSharePct: number;
  nuclearSharePct: number;
  fossilSharePct: number;
  cleanSharePct: number;
  hhi: number | null;
};

type Dataset = {
  aliases: Record<string, string>;
  countries: Record<string, CountryMix>;
};

export type GridMixResult = {
  score: number;
  country: string;
  summary: string;
  mix: CountryMix;
};

let cached: Dataset | null = null;
let sizeRange: { minLog: number; maxLog: number } | null = null;

function loadDataset(): Dataset {
  if (cached) return cached;
  const filePath = path.join(
    process.cwd(),
    "src/lib/scoring/localdata/country-power-mix.json",
  );
  cached = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Dataset;

  const totals = Object.values(cached.countries).map((c) =>
    Math.log10(Math.max(c.totalGenerationTwh, 1)),
  );
  sizeRange = { minLog: Math.min(...totals), maxLog: Math.max(...totals) };

  return cached;
}

function resolveCountry(name: string, dataset: Dataset): CountryMix | null {
  if (dataset.countries[name]) return dataset.countries[name];
  const aliased = dataset.aliases[name.trim().toLowerCase()];
  if (aliased && dataset.countries[aliased]) return dataset.countries[aliased];
  return null;
}

// Grid generation size, on a log scale relative to the range of countries in
// the dataset (Malta's ~2 TWh/yr grid vs. Germany's ~500 TWh/yr grid aren't
// usefully compared on a linear scale) — bigger grids have more headroom to
// absorb a large new load without new generation coming online first.
function sizeScore(totalGenerationTwh: number): number {
  if (!sizeRange) return 50;
  const { minLog, maxLog } = sizeRange;
  const value = Math.log10(Math.max(totalGenerationTwh, 1));
  if (maxLog === minLog) return 50;
  return clamp(((value - minLog) / (maxLog - minLog)) * 100, 0, 100);
}

// Herfindahl-Hirschman index of the fuel mix: 0.11 would be a perfectly even
// split across ~9 fuels, 1.0 is a single fuel doing everything. A lower HHI
// means the grid isn't dependent on one plant type or fuel supply chain —
// more resilient to an outage, drought, or fuel-price shock in any one of
// them.
function diversityScore(hhi: number | null): number {
  if (hhi == null) return 50;
  return clamp(((1 - hhi) / 0.85) * 100, 0, 100);
}

// Year-over-year change in trailing-12-month generation, as a rough proxy
// for whether capacity is expanding or shrinking. 0% change reads as
// neutral (50); ±10% swings to the ends of the range.
function growthScore(yoyGrowthPct: number | null): number {
  if (yoyGrowthPct == null) return 50;
  return clamp(50 + yoyGrowthPct * 5, 0, 100);
}

const GRID_MIX_WEIGHTS = {
  size: 0.35,
  diversity: 0.3,
  clean: 0.2,
  growth: 0.15,
};

export function evaluateGridMix(countryName: string): GridMixResult | null {
  const dataset = loadDataset();
  const mix = resolveCountry(countryName, dataset);
  if (!mix) return null;

  const size = sizeScore(mix.totalGenerationTwh);
  const diversity = diversityScore(mix.hhi);
  const clean = clamp(mix.cleanSharePct, 0, 100);
  const growth = growthScore(mix.yoyGrowthPct);

  const score =
    size * GRID_MIX_WEIGHTS.size +
    diversity * GRID_MIX_WEIGHTS.diversity +
    clean * GRID_MIX_WEIGHTS.clean +
    growth * GRID_MIX_WEIGHTS.growth;

  const diversityNote =
    mix.hhi != null && mix.hhi > 0.5
      ? " a mix concentrated in one dominant fuel,"
      : "";

  const summary = `${countryName}'s grid generated ${mix.totalGenerationTwh.toFixed(0)} TWh over the trailing 12 months (through ${mix.asOf}), ${mix.cleanSharePct.toFixed(0)}% from clean sources,${diversityNote} source: Ember.`;

  return { score: clamp(score, 0, 100), country: countryName, summary, mix };
}
