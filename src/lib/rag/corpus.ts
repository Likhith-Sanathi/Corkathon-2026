export type CorpusDoc = {
  id: string;
  title: string;
  text: string;
};

// Static knowledge base for the site-selection chatbot. Each entry is grounded
// in the actual scoring logic in src/lib/scoring, not just the marketing copy,
// so retrieved answers match what the app actually computes.
export const CORPUS: CorpusDoc[] = [
  {
    id: "overview",
    title: "What this tool does",
    text: "This tool helps identify the best locations in Europe to build a data center. For a candidate site, it scores five factors — isolation, water availability, power grid access, climate/cooling cost, and natural disaster risk — each on a 0-100 scale, and averages the factors that have data into an overall score out of 100. Every score is shown with the evidence behind it and where that data came from, so decision-makers can compare sites on evidence instead of gut feel.",
  },
  {
    id: "isolation-methodology",
    title: "How the isolation score is calculated",
    text: "Isolation measures how remote a site is from dense population centers, which matters for safety, security, and land availability. This factor is currently only available for sites in the Netherlands, where the app finds the nearest city or town in a local OpenStreetMap extract within an 80 km search radius. If none is found, the site scores 100 (maximally isolated). Otherwise the score is the nearest city's distance in km divided by 50 km, scaled to 0-100 and capped at 100 — so a city 50+ km away already scores near the isolation maximum, since being more remote than that stops adding practical value (you still need roads and workers within reach). Outside the Netherlands, isolation returns no score (N/A) — there's no live fallback, since a prior live Overpass API fallback was removed for being unreachable/unreliable in this environment.",
  },
  {
    id: "water-methodology",
    title: "How the water availability score is calculated",
    text: "Water availability measures proximity to a river, canal, or lake, which is the usual cooling source for a data center. This factor is currently only available for sites in the Netherlands, using a local OpenStreetMap extract: the app searches for the nearest river, canal, or lake within 30 km. No match within that radius scores 0. Otherwise the score is 100 minus (distance in km / 20 km) scaled to 0-100 — so water within 20 km scores well, and piping cooling water further than that is considered impractical. Outside the Netherlands, water returns no score (N/A) — there's no live fallback, since a prior live Overpass API fallback was removed for being unreachable/unreliable in this environment.",
  },
  {
    id: "power-methodology",
    title: "How the power grid access score is calculated",
    text: "Power grid access combines two signals. Site-level proximity to grid infrastructure (substations, power plants, transmission lines) is only available for sites in the Netherlands, from a local OpenStreetMap extract within a 40 km search radius: no infrastructure found scores 0, otherwise the score is 100 minus (distance in km / 30 km) scaled to 0-100. Country-level grid mix comes from Ember's monthly generation data (trailing-12-month size, fuel diversity, clean-energy share, year-over-year growth) and is available for any European country, not just the Netherlands. For Netherlands sites the final score blends proximity (65% weight) with grid mix (35% weight). For sites elsewhere in Europe, there's no site-level proximity data, so the score is the country's grid-mix score alone (or N/A if the country isn't in the Ember dataset). This is why a non-Netherlands site can still get a real power score even though isolation and water can't.",
  },
  {
    id: "power-grid-mix",
    title: "What the Ember country-level grid mix measures",
    text: "The grid-mix signal scores a country's electricity grid on four things from Ember's monthly generation data: total generation size on a log scale (35% weight, bigger grids have more headroom for a new large load), fuel diversity via a Herfindahl-Hirschman index (30% weight, a less fuel-concentrated grid is more resilient to a shock in any one fuel), clean-energy share (20% weight), and year-over-year generation growth as a proxy for expanding vs. shrinking capacity (15% weight). It's a country-level signal — it doesn't know anything about a specific site's distance to a substation.",
  },
  {
    id: "climate-methodology",
    title: "How the climate / cooling-cost score is calculated",
    text: "Climate/cooling cost is a proxy for how much a site can rely on free-air cooling instead of mechanical chillers. The app pulls the prior calendar year's daily mean temperature for the site from the Open-Meteo Historical Weather API (ERA5 reanalysis) and averages it. An annual average of 0°C scores 100 (best possible free-air-cooling climate); 25°C scores 0 (worst). Below 10°C is described as cold enough for extensive free-air cooling, 10-18°C as moderate (mixed free-air and mechanical), and above 18°C as warm, relying heavily on mechanical chillers.",
  },
  {
    id: "risk-methodology",
    title: "How the natural disaster risk score is calculated",
    text: "Natural disaster risk combines seismic activity and flood exposure. Seismic data comes from the EMSC Seismic Portal: earthquakes of magnitude 4.5+ within 300 km over the last 20 years. Each quake subtracts up to 6 points (capped at a 70-point penalty), and a magnitude-6+ quake adds a further 20-point penalty. Flood exposure is approximated from elevation (Open-Meteo Elevation API): below 5 m loses 20 points, 5-15 m loses 10 points, above 15 m loses nothing. The final score is 100 minus these penalties, clamped to 0-100. Lower scores mean higher seismic or flood risk.",
  },
  {
    id: "overall-score",
    title: "How the overall site score is calculated",
    text: "The overall score is a weighted blend of whichever factor scores were successfully computed: power and water are weighted 25% and 20% because they can make a site physically infeasible or dominate its operating cost; climate and risk are weighted 20% each; isolation is weighted 15%, the least, since a well-isolated site with no power or water nearby is still a bad site. If a factor's underlying data source couldn't be reached or doesn't cover that location (N/A), its weight is dropped and the remaining weights are renormalized to still sum to 100% — a site isn't penalized just because one factor is missing. A `confidence` value (0-100%) reports how much of the total weight was actually backed by real data; below 100% confidence means part of the score is resting on fewer factors than usual. The overall score is null only if every factor came back N/A.",
  },
  {
    id: "data-sources",
    title: "Data sources used, by factor",
    text: "Isolation and water are only available for sites in the Netherlands, from a pre-downloaded local OpenStreetMap extract (Geofabrik/OpenStreetMap); elsewhere in Europe they return N/A. Power combines that same Netherlands-only local extract for site-level proximity with Ember's monthly electricity-generation data for a country-level grid-mix signal available anywhere in Europe. Climate uses the Open-Meteo Historical Weather API, backed by the ERA5 reanalysis dataset, and covers all of Europe. Natural disaster risk uses the EMSC Seismic Portal for earthquake history and the Open-Meteo Elevation API for flood-risk elevation, also covering all of Europe. All of these are free, no-signup-required (or free-registration) EU/open data sources — see API_LINKS.md for the full catalogue, including sources evaluated but not yet wired in (EEA Waterbase, JRC Risk Data Hub/EFAS/EFFIS, Eurostat crime stats, Digital Decade broadband coverage).",
  },
  {
    id: "netherlands-local-data",
    title: "Why isolation, water, and power are Netherlands-only right now",
    text: "Isolation, water, and site-level power proximity used to fall back to a live Overpass API call for any site outside the Netherlands, but Overpass turned out to be unreachable/flaky in this environment, so those factors silently returned N/A for most of Europe anyway — including the app's own homepage example cities. The live Overpass fallback was removed entirely rather than leaving a broken-feeling dependency in place: isolation and water are now honestly Netherlands-only (a local OpenStreetMap extract), and power's country-level Ember grid-mix signal was kept and extended to work everywhere, so power can still return a real (if coarser) score outside the Netherlands even though isolation and water can't.",
  },
  {
    id: "missing-data-honesty",
    title: "What it means when a factor score is missing (N/A)",
    text: "A factor shows N/A either because its underlying API is unreachable/times out (Open-Meteo, the EMSC seismic service) or because it simply has no coverage for that location (isolation and water outside the Netherlands). Either way, the tool reports N/A with a plain-language reason instead of guessing a number, and N/A factors are dropped from the overall score's weighting rather than counted as zero. This is a deliberate design choice: the tool would rather show missing data honestly, with a lower reported confidence, than present false precision.",
  },
  {
    id: "project-scope",
    title: "Project scope and principles",
    text: "This is a hackathon project (Corkathon 2026) covering all of Europe, built on free or free-tier data sources only. Its core principles are: evidence first (every score shows the data behind it and where it came from), plain language (explanations are written for decision-makers, not geospatial analysts), and honesty about uncertainty (showing ranges/confidence and flagging missing or weak data rather than false precision).",
  },
];
