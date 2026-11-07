# Corkathon 2026 — Project Context

## What we're building
A platform that helps identify the best locations in Europe to build a data center.

For a given region or candidate site, it shows:
1. **Isolation** — how remote the site is from dense population centers (safety/security, land availability).
2. **Water availability** — proximity to rivers/lakes and regional water-stress levels (cooling source viability).
3. **Power grid access** — proximity to grid capacity and generation data.
4. **Climate / cooling cost** — ambient temperature and humidity as a proxy for free-air-cooling potential.
5. **Natural disaster risk** — seismic and flood risk for the site.

The goal is to let decision-makers compare candidate sites on evidence instead of gut feel.

## Core principles
- **Evidence first.** Every score (isolation, water, power, climate, risk) should show the data behind it and where that data came from.
- **Plain language.** Decision-makers are not necessarily geospatial analysts. Explain scores and risks clearly.
- **Be honest about uncertainty.** Show ranges and confidence, not false precision. Flag missing or weak data.

## Scope
- Geography: all of Europe.
- Data sources: free/free-tier only (see `API_LINKS.md` for the full list).

## APIs in use
- Geocoding: Nominatim (OpenStreetMap)
- Isolation: GHSL population grid (Copernicus/JRC), Overpass API (OpenStreetMap)
- Water: EU-Hydro river/lake network (Copernicus Land Monitoring Service), WISE Waterbase (EEA)
- Power grid: ENTSO-E Transparency Platform
- Climate/cooling: Copernicus Climate Data Store (ERA5)
- Disaster risk: EMSC Seismic Portal, Copernicus EFAS

See `API_LINKS.md` for direct links and auth notes for every API above.

## Tech stack
See `TECH_STACK.md` for details. In short:
- **Next.js** (App Router) for frontend and backend
- **Tailwind CSS** + **shadcn/ui** for styling
- **Inter** (Google Fonts) for typography
- **Lenis** for smooth scrolling, **Motion** (`motion`) for animation
- **FastAPI** service for LLM work via **OpenRouter** (optional)

## Working conventions
- Keep the hackathon scope tight: a working end-to-end flow for a single candidate site beats broad, unfinished features.
- Keep API keys server-side. Never expose them with `NEXT_PUBLIC_`.
- Commit messages and PRs follow the attribution rules set in the user's environment.
