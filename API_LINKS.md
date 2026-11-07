# API Links — Data Center Site Selection (Europe)

Reference list of every data source used for site scoring. All are free or free-tier; two require registration before a key/token is issued — apply for those early.

## Geocoding (place name → coordinates)
- **Nominatim (OpenStreetMap)**
  Docs: https://nominatim.org/release-docs/latest/api/Search/
  Example: `https://nominatim.openstreetmap.org/search?q=<place>&format=json`
  Auth: none. Usage policy: max 1 req/sec, must set a descriptive User-Agent. https://operations.osmfoundation.org/policies/nominatim/

## Isolation
- **GHSL — Global Human Settlement Layer** (Copernicus / EC Joint Research Centre)
  Overview: https://human-settlement.emergency.copernicus.eu/dataToolsOverview.php
  Population grid: https://human-settlement.emergency.copernicus.eu/ghs_pop.php
  Auth: none.
- **Overpass API** (OpenStreetMap)
  Endpoint: https://overpass-api.de/api/interpreter
  Docs: https://wiki.openstreetmap.org/wiki/Overpass_API
  Auth: none. Use the `around:<meters>` filter; no built-in nearest-distance function, compute distance client-side.

## Water
- **EU-Hydro River & Lake Network** (Copernicus Land Monitoring Service)
  Product page: https://land.copernicus.eu/api/en/products/eu-hydro
  River network dataset: https://land.copernicus.eu/imagery-in-situ/eu-hydro/eu-hydro-river-network-database
  Auth: none (download API / WMS / REST).
- **WISE Waterbase — Water Quantity** (European Environment Agency)
  Dataset: https://www.eea.europa.eu/data-and-maps/data/waterbase-water-quantity-11
  Auth: none.

## Power grid access
- **ENTSO-E Transparency Platform**
  Platform: https://transparency.entsoe.eu/
  API endpoint: `https://web-api.tp.entsoe.eu/api`
  API guide: https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html
  Auth: **required** — register an account, then email `transparency@entsoe.eu` with subject "Restful API access" to request token approval (manual, ~3 business days). Apply early.

## Climate / cooling cost
- **Copernicus Climate Data Store (CDS) — ERA5 reanalysis**
  CDS: https://climate.copernicus.eu/the-climate-data-store
  Python client (`cdsapi`): https://github.com/ecmwf/cdsapi
  Auth: **required** — free Copernicus account, API key from your CDS profile page.

## Natural disaster risk
- **EMSC Seismic Portal (FDSN event API)**
  Portal: https://www.seismicportal.eu/
  Auth: none.
- **Copernicus EFAS (European Flood Awareness System)**, part of CEMS
  Project page: https://www.ecmwf.int/en/research/projects/efas
  CEMS data access: https://emergency.copernicus.eu/data/
  Auth: none for public flood maps/forecasts.

## Summary

| Factor | API | Auth |
|---|---|---|
| Geocoding | Nominatim | None (rate-limited) |
| Isolation | GHSL population grid, Overpass API | None |
| Water | EU-Hydro river/lake network, WISE Waterbase | None |
| Power grid | ENTSO-E Transparency Platform | Token (manual approval) |
| Climate/cooling | Copernicus CDS (ERA5) | Free account + key |
| Disaster risk | EMSC Seismic Portal, Copernicus EFAS | None |
