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
    text: "Isolation measures how remote a site is from dense population centers, which matters for safety, security, and land availability. The app finds the nearest city or town (OpenStreetMap place=city/town) within an 80 km search radius. If none is found, the site scores 100 (maximally isolated). Otherwise the score is the nearest city's distance in km divided by 50 km, scaled to 0-100 and capped at 100 — so a city 50+ km away already scores near the isolation maximum, since being more remote than that stops adding practical value (you still need roads and workers within reach).",
  },
  {
    id: "water-methodology",
    title: "How the water availability score is calculated",
    text: "Water availability measures proximity to a river, canal, or lake, which is the usual cooling source for a data center. The app searches OpenStreetMap for the nearest river, canal, or natural water body within 30 km. No match within that radius scores 0. Otherwise the score is 100 minus (distance in km / 20 km) scaled to 0-100 — so water within 20 km scores well, and piping cooling water further than that is considered impractical.",
  },
  {
    id: "power-methodology",
    title: "How the power grid access score is calculated",
    text: "Power grid access measures proximity to grid infrastructure: substations, power plants, or transmission lines, tagged in OpenStreetMap. The app searches within a 40 km radius. No infrastructure found scores 0. Otherwise the score is 100 minus (distance in km / 30 km) scaled to 0-100 — beyond 30 km, the cost of a new grid connection spur gets steep.",
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
    text: "The overall score is the simple average of whichever factor scores were successfully computed (isolation, water, power, climate, risk). If a factor's underlying data source could not be reached, that factor is excluded from the average rather than counted as zero, so a missing data source doesn't unfairly tank a site's overall score. The overall score is null only if every factor failed.",
  },
  {
    id: "data-sources",
    title: "Data sources used, by factor",
    text: "Isolation, water, and power all use OpenStreetMap data queried live through the Overpass API — except for sites in the Netherlands, which use a pre-downloaded local extract (Geofabrik/OpenStreetMap) for speed and reliability instead of live Overpass queries. Climate uses the Open-Meteo Historical Weather API, which is backed by the ERA5 reanalysis dataset. Natural disaster risk uses the EMSC Seismic Portal for earthquake history and the Open-Meteo Elevation API for flood-risk elevation. All of these are free, no-signup-required (or free-registration) EU/open data sources — see API_LINKS.md for the full catalogue, including sources evaluated but not yet wired in (ENTSO-E generation mix, EEA Waterbase, JRC Risk Data Hub/EFAS/EFFIS, Eurostat crime stats, Digital Decade broadband coverage).",
  },
  {
    id: "netherlands-local-data",
    title: "Why the Netherlands uses local data instead of live queries",
    text: "For sites located in the Netherlands, the isolation, water, and power factors read from a pre-downloaded local OpenStreetMap extract (places, water, and power infrastructure) bundled with the app, instead of calling the live Overpass API. This avoids Overpass rate limits and timeouts for a region used heavily during development and demos, while every other European country still falls back to live Overpass queries.",
  },
  {
    id: "missing-data-honesty",
    title: "What it means when a factor score is missing or data could not be reached",
    text: "Every factor can fail independently if its underlying API is unreachable or times out — for example Overpass, Open-Meteo, or the EMSC seismic service. When that happens the factor's score is null and shown as N/A, with a summary explaining which service could not be reached, instead of guessing a number. A null factor is excluded from the overall score average. This is a deliberate design choice: the tool would rather show missing data honestly than present false precision.",
  },
  {
    id: "project-scope",
    title: "Project scope and principles",
    text: "This is a hackathon project (Corkathon 2026) covering all of Europe, built on free or free-tier data sources only. Its core principles are: evidence first (every score shows the data behind it and where it came from), plain language (explanations are written for decision-makers, not geospatial analysts), and honesty about uncertainty (showing ranges/confidence and flagging missing or weak data rather than false precision).",
  },
];
