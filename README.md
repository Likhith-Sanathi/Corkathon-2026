# Parcel

**Find the best place in the Netherlands to build a data centre, on evidence instead of gut feel.**

Drop a pin anywhere in the Netherlands and Parcel scores that spot as a data centre site. The score is built from public data: distance to the power grid, fibre, water and motorways, how isolated the site is from towns, and whether it sits in a flood zone or near recorded earthquakes. Every number shows where it came from, you decide how much each factor matters, and you can jump straight to plots for sale nearby.

Built for **Corkathon 2026**.

---

## Contents

- [Why Parcel](#why-parcel)
- [Features](#features)
- [How to use it](#how-to-use-it)
  - [1. The landing page](#1-the-landing-page)
  - [2. Score a site](#2-score-a-site)
  - [3. Read the score](#3-read-the-score)
  - [4. Change what matters](#4-change-what-matters)
  - [5. Explore the map layers](#5-explore-the-map-layers)
  - [6. Find plots for sale](#6-find-plots-for-sale)
  - [7. Ask the assistant](#7-ask-the-assistant)
  - [Tips](#tips)
- [Getting started (run it yourself)](#getting-started-run-it-yourself)
- [How the score works](#how-the-score-works)
- [Data sources](#data-sources)
- [Architecture](#architecture)
- [API reference](#api-reference)
- [Rebuilding the data](#rebuilding-the-data)
- [Testing and CI](#testing-and-ci)
- [Project structure](#project-structure)
- [Tech stack](#tech-stack)
- [Known limits](#known-limits)
- [Roadmap](#roadmap)
- [Original brief and long-term vision](#original-brief-and-long-term-vision)

---

## Why Parcel

Data centres are being built faster than ever, but the Netherlands is short of grid capacity, space and safe ground. Sites are still often shortlisted on gut feel and a few phone calls.

A good site needs **power**, **fibre**, **water** and **road access**. It also needs to be **away from people**, **out of the flood zone** and **off the fault line**. All of that data is public, but it's scattered across a dozen sources and formats. Parcel puts it on one map, turns it into one score you can check, and is honest about where the data is thin.

Three principles guide the tool:

1. **Evidence first.** Every score shows the data behind it and where it came from.
2. **Plain language.** It's written for decision-makers, not geospatial analysts.
3. **Honest about uncertainty.** Simulated or weak data is labelled as such, never hidden.

---

## Features

| | |
|---|---|
| **Score any spot** | Click anywhere in the Netherlands for a 0–100 site score with five factor scores and a risk multiplier. |
| **Evidence for every number** | Each factor lists what it measured (for example "3.2 km to a 380 kV substation") and the source dataset. |
| **Adjustable weights** | Sliders for power, isolation, telecom, water and roads. The score and the national heatmap update instantly. |
| **National heatmap** | The whole country pre-scored on a ~500 m grid (about 146,000 cells), recoloured live as you change the weights. |
| **Risk built in** | Flood zones and earthquakes since 2000 discount the score, and the panel says why. |
| **Plot lookup** | Every pin returns the Kadaster cadastral parcel it falls on and the nearest business park (IBIS). |
| **Plots for sale** | 5,686 demo listings on real parcels in business parks with land available, filterable by area, radius and price. |
| **Featured listings** | Top rated, best value, large plots and newest listings, ranked by your current weights. |
| **Chat assistant** | Ask questions about the method or a site, or ask it to find the best plot. It only quotes scores the app has computed. |
| **Themes** | Light, dark and OLED colour themes, with a choice of basemap. |

---

## How to use it

Open the app (locally at **http://localhost:3000**, see [Getting started](#getting-started-run-it-yourself)).

### 1. The landing page

The home page explains the method as you scroll: the map draws itself with every substation, telecom exchange and earthquake, then walks through the six factors, the three-step method and the datasets. Click **Explore** (top right) or **Pick a site** (bottom) to open the tool.

### 2. Score a site

On the **Explore** page you can:

- **Click anywhere on the map** to drop a pin. The site is scored straight away.
- **Search a place** (for example "Eemshaven" or "Groningen") to jump there, then click to drop a pin.
- **Click a plot for sale** on the map to score that plot.

Points outside the Netherlands are rejected with a message, because the data only covers the Netherlands. Use **Remove pin** to clear the site.

### 3. Read the score

The side panel shows:

- **Site score (0–100)** for your current weights.
- **Five factor scores** (Power grid, Isolation, Telecom, Water, Road access), each with its weight and the evidence behind it, such as distances and the name of the nearest feature.
- **Risk:** the flood and seismic multiplier, with the reason when it applies (for example "inside a protected flood zone" or "near recorded M3.4 earthquake").
- **Plot:** the Kadaster parcel ID and area, the business park it's in (or the nearest one), the land available and the price range.
- **Estimated land value:** a modelled price range for the parcel, marked **Simulated**.
- **How is the score calculated?** A plain-language explanation of the method.

### 4. Change what matters

Open **Factor weights** and drag the sliders. A hyperscaler might weight power heavily, while an edge operator might care more about telecom and roads. The weights are normalised to 100%, and the pin score, the heatmap and the featured listings all update immediately.

### 5. Explore the map layers

Open **Map layers** to toggle what's drawn. On by default:

- **Site score heatmap** (~500 m grid, coloured by your weights)
- **Plots for sale** (for sale / under offer)
- **Substations ≥110 kV** (380 kV in red, 110–220 kV in amber)
- **Data centres & exchanges**
- **Business parks** (IBIS 2019, appears when you zoom in; pink means land available)
- **Cadastral parcels** (Kadaster, appears from zoom 15)
- **Municipal borders** (PDOK)

Off by default, but worth turning on to explain a score: **HV lines & pylons**, **Rivers, canals & lakes**, **Motorway junctions**, **Settlements**, **Flood risk zones** and **Earthquakes**.

Use **Filters** to narrow layers, for example power voltage (110 / 220 / 380 kV), settlement size and minimum earthquake magnitude.

### 6. Find plots for sale

Use **Find plots for sale** in the panel:

1. Enter a place or municipality (for example "Near a place, e.g. Groningen"). Typos get a "did you mean" suggestion.
2. Pick a **search radius** (shown as a circle on the map).
3. Optionally set a **maximum plot price** (Up to €1M, €2.5M, €5M or €10M, or Any price).
4. Results are ranked by site score under your current weights. Click one to fly to it and see its full breakdown.

If a search returns nothing, Parcel suggests the nearest municipality that does have plots within your price cap.

The **Featured listings** bar shows the best current options at a glance: top rated, best value, large plots and newly listed.

> The plots for sale are **synthetic demo data**. They sit on real Kadaster parcels in real business parks, but the listings and prices are generated, because no open dataset says which Dutch plots are for sale. See [Known limits](#known-limits).

### 7. Ask the assistant

Click the chat button (bottom right) and ask in plain language, for example:

- "Why did this site score lower on isolation?"
- "How is the flood risk calculated?"
- "Find the best plot near Rotterdam under €2M."
- "Show me Eindhoven."

The assistant can move the map: it either shows a named place, or searches and ranks real plots for sale with your current weights. It only states scores, prices and places that came from the app's own calculations, and it says when something isn't covered.

The assistant needs an OpenRouter API key (see below). Without one, the rest of the app still works and the chat says it's unavailable.

### Tips

- Compare two pins: drop one near a 380 kV substation and one near Groningen with the **Earthquakes** layer on to see the risk discount at work.
- Turn on the layer that matches a factor (for example **Rivers, canals & lakes** for Water) to see exactly what the distance was measured to.
- Weights change the heatmap across the whole country, so slide one and watch the best regions move.

---

## Getting started (run it yourself)

### Requirements

- **Node.js 20 or newer** (CI tests 20, 22 and 24)
- **npm**
- Optional: an **[OpenRouter](https://openrouter.ai) API key** for the chat assistant
- Optional: **Python 3.12** only if you want to rebuild the map data from the raw CSVs

The processed data is already committed in `web/public/data/`, so you don't need to rebuild anything to run the app.

### 1. Install

```bash
git clone https://github.com/Likhith-Sanathi/Corkathon-2026.git
cd Corkathon-2026/web
npm install
```

### 2. Configure (optional, for the chat)

Create `web/.env.local`:

```bash
OPENROUTER_API_KEY=sk-or-...
# optional, defaults to openai/gpt-4o-mini
OPENROUTER_MODEL=openai/gpt-4o-mini
```

Keys stay on the server. Never prefix them with `NEXT_PUBLIC_`. `.env*` files are git-ignored.

### 3. Run

**Development** (reloads as you edit):

```bash
npm run dev
```

**Production** (faster, what you'd demo or deploy):

```bash
npm run build
npm run start
```

Then open **http://localhost:3000**. To use another port: `npm run start -- -p 3001`.

### 4. Deploy

The app is a standard Next.js app and deploys to Vercel as is:

1. Import the GitHub repo in Vercel.
2. Set the **root directory** to `web`.
3. Add `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`) as environment variables.

Every push to `main` then redeploys.

### npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Unit, API and data tests (Vitest, about 1 s) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Tests with coverage thresholds |
| `npm run test:e2e` | End-to-end tests (Playwright, needs `npm run build` first) |
| `npm run build:grid` | Recompute the national score heatmap (about 1 min) |
| `npm run build:plots` | Regenerate the synthetic plots for sale (about 30 s first run) |

---

## How the score works

```
score = 100 × suitability × risk
```

**Suitability** is the weighted average of five factor scores, each between 0 and 1. Distance-based factors decay exponentially with distance: `e^(−d/λ)`, so a feature right next to the site scores 1 and the score halves roughly every 0.7 λ.

| Factor | Default weight | What is measured |
|---|---|---|
| **Power grid** | 35% | Nearest ≥110 kV substation (λ = 3 km, 60% of the factor) and nearest ≥110 kV line or pylon (λ = 2 km, 40%). 380 kV substations get a ×1.2 bonus. |
| **Isolation** | 20% | `1 / (1 + Σ wᵢ · e^(−d/2 km))` over settlements within 15 km. Weights: city 1, town 0.5, suburb 0.3, village 0.15, hamlet 0.03. |
| **Telecom** | 20% | Nearest data centre or telecom exchange (λ = 10 km), plus up to 0.2 bonus for data centres within 25 km (clusters mean fibre). |
| **Water** | 15% | Nearest river, canal, lake or reservoir (λ = 3 km), as a candidate cooling source. |
| **Road access** | 10% | Nearest motorway junction (λ = 5 km), for construction and operations. |

**Risk** multiplies the result:

- **Flood:** ×0.2 in an unprotected flood zone (type D), ×0.7 in a protected zone (type B), ×0.5 in other zone types, ×1 outside all zones.
- **Seismic:** `1 / (1 + Σ 10^(M−4.5) · e^(−d/10 km))` over earthquakes within 25 km since 2000. A magnitude 4.5 quake at the site halves the score; small induced quakes barely count.

All tunables (decay lengths, weights, flood and seismic settings) are in `PARAMS` and `DEFAULT_WEIGHTS` at the top of `web/src/lib/scoring.ts`, one function per factor.

### Land value model

There is no open per-parcel price data in the Netherlands, so prices are **simulated from real anchors** (`web/src/lib/pricing.ts`):

- **Inside a business park:** the park's own IBIS 2019 land price, or an inverse-distance-weighted average of the 8 nearest priced parks within 40 km, indexed ×1.32 to 2026 (about 4% a year), with a discount for large plots and a stable ±7% per-parcel variation.
- **Outside business parks:** average Dutch farmland (about €75,000 per hectare), scaled by how expensive the region is.
- Prices are shown as a ±12% range and labelled **Simulated**.

---

## Data sources

All data is free and public.

| Data | Source | Used for |
|---|---|---|
| Substations, HV lines and pylons | OpenStreetMap | Power grid factor |
| Telecom exchanges and data centres | OpenStreetMap | Telecom factor |
| Rivers, canals, lakes, reservoirs | OpenStreetMap | Water factor |
| Motorway junctions | OpenStreetMap | Road access factor |
| Cities, towns, villages, hamlets | OpenStreetMap | Isolation factor |
| Flood risk zones | PDOK / Rijkswaterstaat | Flood risk multiplier |
| Earthquakes since 2000 | EMSC Seismic Portal | Seismic risk multiplier |
| Cadastral parcels | Kadaster (BRK via PDOK, live) | Plot lookup, parcel outlines |
| Business parks | IBIS 2019 (Interprovinciaal Overleg, CC0) | Plot lookup, land prices, synthetic listings |
| Municipal and national borders | PDOK (Bestuurlijke gebieden) | Inside-the-Netherlands check, borders layer |
| Place search | Nominatim (OpenStreetMap) | Geocoding place names |
| Basemap | PDOK BRT | Map background |

Dataset sizes shipped with the app: 1,091 substations, 4,495 HV line segments, 13,012 pylons, 433 telecom exchanges and data centres, 31,836 water features, 1,912 motorway junctions, 6,555 settlements, 144 earthquakes, 3,881 business parks and 5,686 synthetic listings.

---

## Architecture

```
Browser (Next.js App Router, React)
 ├─ Landing page        scroll-driven explainer (Motion, Lenis)
 ├─ Explore page        Leaflet map + side panel + featured bar + chat
 │    ├─ static layers   /data/*.json, drawn to canvas for speed
 │    └─ heatmap         /data/grid.bin.gz → recoloured per weight change (~30 ms)
 │
Next.js route handlers (server)
 ├─ POST /api/score       scoreLocation() + Kadaster parcel + nearest IBIS park + price estimate
 ├─ POST /api/rank-sites  rank plots for sale around a place (radius, price cap, "did you mean")
 ├─ POST /api/featured    top rated / best value / large / newest listings for the weights
 └─ POST /api/chat        retrieval over method notes + tool calls (show place, find best plot)
                          → OpenRouter (gpt-4o-mini)
```

- **Scoring** (`src/lib/scoring.ts`) is a pure function shared by the API, the heatmap build script and the tests, so every score in the app comes from the same code.
- **Heatmap:** `scripts/build-grid.ts` scores every ~500 m cell and stores the five factor scores and the risk multiplier per cell (`grid.bin.gz`, about 0.5 MB). The browser combines them with the current weights and repaints a canvas overlay with smooth interpolation. Colours stretch over the 2nd–98th percentile of the current scores.
- **Map:** Leaflet on the PDOK BRT basemap. Large point layers render to a canvas with SVG-defined glyph sprites, so tens of thousands of points stay fast.
- **Chat:** the assistant retrieves relevant method notes (`src/lib/rag/`), sees the evidence for the pinned site, and can call two tools: `show_place_on_map` and `find_best_plot`. Answers may only quote numbers that came from these results.

---

## API reference

All endpoints accept and return JSON. `weights` is optional everywhere and defaults to the weights above; it's an object like `{ "power": 35, "isolation": 20, "telecom": 20, "water": 15, "roads": 10 }` and is normalised automatically.

### `POST /api/score`

Score a single location.

```bash
curl -X POST http://localhost:3000/api/score \
  -H "Content-Type: application/json" \
  -d '{ "lat": 53.43, "lon": 6.83 }'
```

Returns the total score, every factor score with its weight and evidence, the risk multiplier and reasons, and a `plot` object (Kadaster parcel, nearest IBIS business park, estimated land value).

| Status | Meaning |
|---|---|
| 200 | Scored |
| 400 | Body is not JSON, or `lat`/`lon` are invalid |
| 422 | The point is outside the Netherlands |
| 502 | An upstream service failed (the score still returns if only the parcel lookup is down) |

### `POST /api/rank-sites`

Rank plots for sale around a place, by your weights. Takes a place or municipality, a radius and an optional price cap. Returns ranked listings, plus a "did you mean" suggestion for typos or the nearest municipality with plots when nothing matches.

### `POST /api/featured`

Featured listings for the current weights: top rated, best value, large plots and just listed.

### `POST /api/chat`

Chat with the assistant. Takes the conversation, the current weights and the pinned site's evidence. Returns the reply and, when a tool was used, a map action (fly to a place, or show the best plot). Requires `OPENROUTER_API_KEY`.

---

## Rebuilding the data

You only need this if you change the source data or the scoring model.

```bash
# 1. From the repo root: CSVs → compact JSON layers in web/public/data/
python3 scripts/build_data.py

# 2. From web/: recompute the heatmap (after any scoring or data change, about 1 min)
npm run build:grid

# 3. From web/: regenerate the synthetic plots for sale (about 30 s first run, then cached)
npm run build:plots
```

- `scripts/build_data.py` reads `power.csv`, `water.csv`, `roads.csv`, `isolation.csv`, `telecom.csv`, `seismic.csv` and `flood.csv` from the repo root, keeps only the features the scoring uses, and writes a few MB of JSON instead of about 140 MB of raw OSM extracts. It downloads municipality and national borders from PDOK and the IBIS business parks once, caching them in `scripts/.cache/`. Features outside the Dutch national outline are dropped.
- `web/scripts/build-plots.ts` creates listings only in business parks that IBIS reports as having land available, up to roughly that park's available hectares. Every listing is a real Kadaster parcel (cached in `scripts/.cache/parcels/`). Status, seller and listing date are seeded from the parcel ID, so rebuilds produce the same listings.

---

## Testing and CI

```bash
cd web
npm test                              # unit, API and data-integrity tests (Vitest)
npm run test:coverage                 # with coverage thresholds on the scoring, pricing and geometry core
npm run build && npm run test:e2e     # end-to-end tests against the production build (Playwright)
```

- `test/unit/`: geometry, the scoring model, the pricing model, plot and park lookups, the score grid.
- `test/api/`: every route handler called directly, with Nominatim, PDOK and OpenRouter mocked (no network). Covers success paths, validation errors (400), outside-the-Netherlands (422), degraded upstreams (502), "did you mean" suggestions and the chat's tool calls.
- `test/data/`: integrity of every generated file in `public/data` (schemas, value ranges, coordinates inside the Netherlands, grid size, every listing's label point inside its own parcel).
- `e2e/`: landing page, map and heatmap, dropping a pin, outside-NL rejection, live reweighting, themes, panel toggles, featured listings and plot search, at desktop and laptop widths.

**CI** (`.github/workflows/ci.yml`) runs on every push and pull request touching `web/` or `scripts/`, plus nightly: lint, typecheck, tests on Node 20, 22 and 24 (coverage on 22), the end-to-end suite, a production build, a compile check of the Python data script and a production dependency audit. The **CI passed** job is the single check to require in branch protection.

---

## Project structure

```
.
├─ README.md               this file
├─ CLAUDE.md               project context and principles
├─ TECH_STACK.md           stack notes
├─ API_LINKS.md            links and auth notes for public APIs
├─ *.csv                   raw source data (OSM extracts, flood, seismic)
├─ scripts/
│  └─ build_data.py        CSV → web/public/data/*.json
├─ .github/workflows/ci.yml
└─ web/                    the Next.js app
   ├─ public/data/         processed layers, heatmap grid, synthetic plots
   ├─ scripts/             build-grid.ts, build-plots.ts
   ├─ src/
   │  ├─ app/
   │  │  ├─ page.tsx       landing page
   │  │  ├─ explore/       the scoring tool
   │  │  └─ api/           score, rank-sites, featured, chat
   │  ├─ components/
   │  │  ├─ landing/       landing page sections and animation primitives
   │  │  ├─ app-shell.tsx  explore page layout and state
   │  │  ├─ site-map.tsx   Leaflet map, layers, heatmap
   │  │  ├─ score-panel.tsx, controls.tsx, site-search.tsx,
   │  │  │  featured-listings.tsx, chat-panel.tsx
   │  │  └─ ui/            shadcn/ui components
   │  └─ lib/
   │     ├─ scoring.ts     the scoring model
   │     ├─ pricing.ts     the land value model
   │     ├─ grid*.ts       heatmap grid and search
   │     ├─ layers.ts      map layer definitions and defaults
   │     ├─ llm-rank.ts    OpenRouter client
   │     └─ rag/           retrieval for the chat assistant
   ├─ test/                Vitest suites
   └─ e2e/                 Playwright suites
```

---

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui (Base UI), Inter
- **Map:** Leaflet, react-leaflet, PDOK basemap, canvas-rendered layers
- **Animation:** Motion, Lenis smooth scrolling
- **AI:** OpenRouter (GPT-4o-mini by default) with tool calling and retrieval
- **Data pipeline:** Python 3 (`build_data.py`), TypeScript build scripts (`tsx`)
- **Testing:** Vitest, Playwright
- **CI:** GitHub Actions

---

## Known limits

We'd rather you know these than discover them:

- **Netherlands only.** The data and the inside-the-country check cover the Netherlands. Features across the border (German and Belgian substations or earthquakes) are dropped, so sites near the border are scored without them.
- **Flood data is a placeholder.** `flood.csv` currently holds 20 identical 2 km circles, not the real flood risk map, so the flood factor rarely triggers. Replace it with the full PDOK flood risk zones before relying on it.
- **Approximate distances to long features.** Lines, rivers and roads are stored as one point per OSM way (the average of its vertices).
- **Isolation uses place points,** not population counts.
- **Business park data is from 2019** (IBIS). Availability and prices will have changed.
- **Plots for sale are synthetic** and land values are simulated. No open dataset says which Dutch plots are for sale or what they cost.
- **No grid capacity data yet.** Distance to a substation doesn't mean it has spare capacity.

---

## Roadmap

- Expand from the Netherlands to the rest of Europe.
- Add real grid capacity and congestion data (for example ENTSO-E and Netbeheer Nederland congestion maps).
- Add climate data (ERA5) to estimate free-air cooling potential.
- Replace the flood placeholder with the full national flood risk zones.
- Replace synthetic listings with real plots for sale.
- Compare several candidate sites side by side and export a report.

---

## Original brief and long-term vision

This is the project brief we started from. Parcel currently covers the Netherlands with the data listed in [Data sources](#data-sources); the Europe-wide scope and the extra APIs below (GHSL, EU-Hydro, WISE, ENTSO-E, ERA5, EFAS, a FastAPI service) are where we want to take it, not what the app uses today.

### What we're building
A platform that helps identify the best locations in Europe to build a data center.

For a given region or candidate site, it shows:
1. **Isolation** — how remote the site is from dense population centers (safety/security, land availability).
2. **Water availability** — proximity to rivers/lakes and regional water-stress levels (cooling source viability).
3. **Power grid access** — proximity to grid capacity and generation data.
4. **Climate / cooling cost** — ambient temperature and humidity as a proxy for free-air-cooling potential.
5. **Natural disaster risk** — seismic and flood risk for the site.

The goal is to let decision-makers compare candidate sites on evidence instead of gut feel.

### Core principles
- **Evidence first.** Every score (isolation, water, power, climate, risk) should show the data behind it and where that data came from.
- **Plain language.** Decision-makers are not necessarily geospatial analysts. Explain scores and risks clearly.
- **Be honest about uncertainty.** Show ranges and confidence, not false precision. Flag missing or weak data.

### Scope
- Geography: all of Europe.
- Data sources: free/free-tier only (see `API_LINKS.md` for the full list).

### APIs in use
- Geocoding: Nominatim (OpenStreetMap)
- Isolation: GHSL population grid (Copernicus/JRC), Overpass API (OpenStreetMap)
- Water: EU-Hydro river/lake network (Copernicus Land Monitoring Service), WISE Waterbase (EEA)
- Power grid: ENTSO-E Transparency Platform
- Climate/cooling: Copernicus Climate Data Store (ERA5)
- Disaster risk: EMSC Seismic Portal, Copernicus EFAS

See `API_LINKS.md` for direct links and auth notes for every API above.

### Tech stack
See `TECH_STACK.md` for details. In short:
- **Next.js** (App Router) for frontend and backend
- **Tailwind CSS** + **shadcn/ui** for styling
- **Inter** (Google Fonts) for typography
- **Lenis** for smooth scrolling, **Motion** (`motion`) for animation
- **FastAPI** service for LLM work via **OpenRouter** (optional)

### Working conventions
- Keep the hackathon scope tight: a working end-to-end flow for a single candidate site beats broad, unfinished features.
- Keep API keys server-side. Never expose them with `NEXT_PUBLIC_`.
- Commit messages and PRs follow the attribution rules set in the user's environment.
