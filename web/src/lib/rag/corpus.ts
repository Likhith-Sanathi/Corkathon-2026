export type CorpusDoc = { id: string; title: string; text: string }

// Static knowledge base for the chatbot. Every entry is grounded in the actual code in
// src/lib/scoring.ts, src/lib/plot.ts and src/lib/pricing.ts — not marketing copy — so
// retrieved answers match what the app actually computes.
export const CORPUS: CorpusDoc[] = [
  {
    id: "overview",
    title: "What this tool does",
    text: "This tool scores candidate data centre sites in the Netherlands. Drop a pin or search a place, and it computes a 0-100 score from five weighted factors (power grid access, isolation, telecom, water, road access) combined with a flood and seismic risk multiplier. Every factor shows the evidence it was computed from — the nearest substation, river, motorway junction, etc. — and its distance, so the score is never a black box.",
  },
  {
    id: "overall-formula",
    title: "How the overall score is calculated",
    text: "The overall score is: 100 × suitability × risk. Suitability is the weighted sum of the five factor scores (each 0-1): power, isolation, telecom, water, roads. Risk is a multiplier between 0 and 1 from flood and seismic exposure — it discounts the score rather than being averaged into it, so a site with great infrastructure but sitting in a flood zone or seismic hotspot still gets pulled down.",
  },
  {
    id: "weights",
    title: "Factor weights",
    text: "The default weights are power 35%, isolation 20%, telecom 20%, water 15%, roads 10% — power and connectivity dominate because they're usually the hard constraints. These are adjustable with sliders in the app; whatever values are set get renormalised to sum to 100% before scoring, so the relative balance is what matters, not the raw slider numbers.",
  },
  {
    id: "power-methodology",
    title: "How the power score is calculated",
    text: "Power combines two signals: 60% from the nearest ≥110 kV substation and 40% from the nearest high-voltage line or pylon. Each uses exponential distance decay (score = e^(-distance/λ): 1 right at the feature, about 0.37 at distance λ) with λ = 3 km for substations and 2 km for lines. A substation or line at 380 kV or above gets a 1.2× bonus on top of the decay score.",
  },
  {
    id: "isolation-methodology",
    title: "How the isolation score is calculated",
    text: "Isolation measures population pressure within 15 km: every nearby settlement (hamlet to city) contributes weight × exponential decay (λ = 2 km) based on its size and distance, and those contributions sum into a 'pressure' value. The isolation score is 1 / (1 + pressure) — no nearby settlements means pressure ≈ 0 and a score near 1 (maximally isolated); being close to a city pushes the score toward 0.",
  },
  {
    id: "telecom-methodology",
    title: "How the telecom score is calculated",
    text: "Telecom scores the nearest telecom exchange or data centre with exponential decay, λ = 10 km (a much longer reach than power or water, since fibre routes further). On top of that there's a cluster bonus of up to +0.2 for being near other data centres: it's min(number of data centres within 25 km / 10, 0.2).",
  },
  {
    id: "water-methodology",
    title: "How the water score is calculated",
    text: "Water scores the nearest river, canal, lake or reservoir with exponential decay, λ = 3 km — a cooling-water source directly at the site scores close to 1, and the score falls off quickly beyond a few kilometres.",
  },
  {
    id: "roads-methodology",
    title: "How the road-access score is calculated",
    text: "Roads scores the nearest motorway junction with exponential decay, λ = 5 km, for construction and operational access.",
  },
  {
    id: "risk-methodology",
    title: "How flood and seismic risk are calculated",
    text: "Risk is a multiplier (0-1), not a weighted factor — it's multiplied onto the suitability score at the end. Flood risk comes from Rijkswaterstaat/PDOK flood zones: being inside a mapped zone applies a fixed multiplier depending on zone type (0.7 for type B, 0.2 for type D, 0.5 for other types); outside every zone the multiplier is 1 (no penalty). Seismic risk comes from EMSC earthquake records since 2000 within 25 km: each quake contributes 10^(magnitude - 4.5) × exponential decay (λ = 10 km) to a hazard total, and the multiplier is 1 / (1 + hazard) — so a single M4.5 event right at the site roughly halves the score, while smaller or more distant quakes barely move it.",
  },
  {
    id: "grade-labels",
    title: "What the score bands mean",
    text: "The overall 0-100 score maps to a label: 70 or above is 'Excellent site', 50-69 is 'Good site', 30-49 is 'Fair site', and below 30 is 'Poor site'.",
  },
  {
    id: "search-ranking",
    title: "How the 'Search a region' feature works",
    text: "Typing a place name geocodes it (Nominatim), then scans the precomputed score grid within the chosen radius for the best-scoring cells under the current weights — picking cells spaced apart so the results are distinct locations, not neighbouring pixels. The top 5 are then re-scored exactly (same formula as a single dropped pin) for full evidence. An LLM then writes a short plain-language summary comparing the ranked list, grounded only in those computed scores — it does not re-score anything itself.",
  },
  {
    id: "plot-and-pricing",
    title: "What the 'plot' information on a pinned site is",
    text: "Dropping a pin also looks up two things live: whether the point falls inside an IBIS 2019 business park, and the actual cadastral parcel at that point from Kadaster's open parcel map (via PDOK). From that it estimates a land price: inside a business park it uses that park's own IBIS 2019 price if listed (or an inverse-distance-weighted average of nearby priced parks otherwise), indexed up to 2026 (~32% growth assumed since 2019) with a small size discount for larger plots. Outside any business park, it's priced as farmland (~€7.50/m² nationally), scaled by how expensive the surrounding region's industrial land is. These are simulated demo prices, not real listings — there's no open per-parcel price dataset for the Netherlands.",
  },
  {
    id: "listings",
    title: "The 'for sale' / 'under offer' markers on the map",
    text: "Some plots on the map show as synthetic listings with a 'for sale' or 'under offer' status — these are simulated for the demo, not real estate listings, and use the same price-estimation logic as any other parcel.",
  },
  {
    id: "data-sources",
    title: "Data sources, by factor",
    text: "Power, isolation, telecom, water and road access all come from OpenStreetMap. Flood risk zones come from PDOK/Rijkswaterstaat. Seismic history comes from the EMSC Seismic Portal (earthquakes since 2000). Business parks come from IBIS (2019). Cadastral parcels come from Kadaster via PDOK, fetched live.",
  },
  {
    id: "scope-and-honesty",
    title: "Scope and limitations",
    text: "This tool currently covers the Netherlands only — the score grid, search, and all local datasets are built for that country, nothing else. It's a hackathon project (Corkathon 2026) built on free data sources. Its principles are evidence first (every score shows the data behind it), plain language, and honesty about uncertainty — there is no made-up precision: land prices are explicitly simulated, and factors are only ever computed from real nearby features, never guessed.",
  },
]
