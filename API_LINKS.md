# Data Sources — Data Center Site Selection (Europe)

Each category has a free EU source. Most need no key, but ENTSO-E and Copernicus need a registration step.

| Category | Source | Access | Notes |
|---|---|---|---|
| Diverse power sources | **ENTSO-E Transparency Platform**: actual generation per production type | Free token, requested by email to transparency@entsoe.eu | Covers 60+ bidding zones. Compute a diversity index (e.g. Herfindahl) on the mix. Country-level, not site-level. |
| Water | **EEA Waterbase**: water quantity (1901–2025, released July 2026) and water quality (1900–2025) | Free CSV/SQLite download; Discodata endpoint for filtered queries | River flow, abstraction and water-scarcity indicators. Reporting varies by country, so check coverage per area. |
| Natural calamity risk | **JRC Risk Data Hub API** (since November 2023) | Free, no key listed in the sources found | Multi-hazard, with exposure, vulnerability and historical losses across EU, EFTA and IPA countries. Also **EFAS** flood hazard maps (free, no restrictions) and **EFFIS** for wildfire. Auth and rate limits not yet tested. |
| Crime | **Eurostat** `crim_gen` (national) and `crim_gen_reg` (NUTS 3) | Free, Eurostat API | Police-recorded offences by ICCS category. NUTS 3 regional coverage runs about 2008–2023. Coarse and not comparable everywhere: some countries are excluded from some offence types. |
| Broadband | **Digital Decade "Broadband Coverage in Europe"** (final dataset) | Free download, annual | Fixed, VHCN, NGA, mobile and rural coverage by country and NUTS 3. Static annual dataset, not a live API. The EU broadband-mapping.eu platform has QoS data; access not yet checked. |
| Temperature | **Copernicus Climate Data Store, ERA5** reanalysis (hourly, about 0.25°) | Free account, then the `cdsapi` Python client; accept each dataset's terms | Historical and gridded. Forecasts come from other sources. |
| Map data | **OpenStreetMap** (roads, buildings, power lines, amenities) | Free, Overpass API | ODbL licence, so check share-alike obligations for a commercial product. Coverage in rural areas varies. |

