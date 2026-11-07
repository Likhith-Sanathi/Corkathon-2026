# Data Sources — Data Centre Site Scorer (Netherlands)

Every source below is free. None needs an API key or an account. The app only keeps features inside the Netherlands (PDOK national outline).

| Used for | Source | Access | Licence | In the repo |
|---|---|---|---|---|
| Power, water, roads, isolation, telecom | **OpenStreetMap**, Geofabrik Netherlands extract | One-off download (`.osm.pbf`), filtered with `osmium` | ODbL | `power.csv`, `water.csv`, `roads.csv`, `isolation.csv`, `telecom.csv` |
| Earthquake risk | **EMSC Seismic Portal**, FDSN event service | Free API, no key | See EMSC terms of use | `seismic.csv` |
| Flood risk | **PDOK / Rijkswaterstaat**, natural risk zones: flooding (INSPIRE) | Free WFS / GML download, no key | CC0 | `flood.csv` |
| Business parks: available land and prices | **IBIS Bedrijventerreinen** (Interprovinciaal Overleg) | Free download (`ibis.zip`, shapefile) | CC0 | `web/public/data/ibis.json` |
| Plots: the parcel under a pin | **Kadaster BRK Kadastrale Kaart** via PDOK | Free API, no key, queried live | Open data | Not stored; fetched per pin |
| Netherlands outline and municipalities | **PDOK Bestuurlijke Gebieden** (Kadaster) | Free WFS, no key | Open data | `web/public/data/nl_outline.json`, `municipalities.json` |
| Basemaps | **Esri** Light/Dark Gray Canvas, **PDOK BRT Achtergrondkaart**, **OpenStreetMap** tiles | Free tile services, no key | Per provider's terms | Not stored |

## Details

### OpenStreetMap (Geofabrik extract)
- Download: https://download.geofabrik.de/europe/netherlands-latest.osm.pbf
- Filtered by tag into the five CSVs: `power=*`, `waterway=*` / `natural=water`, `highway=motorway/trunk`, `place=*`, and `telecom=*` / `man_made=mast`.
- ODbL is share-alike, so check the attribution and share-alike obligations before commercial use.

### EMSC Seismic Portal
- API: `https://www.seismicportal.eu/fdsnws/event/1/query?starttime=2000-01-01&endtime=2024-12-31&minlatitude=50.5&maxlatitude=53.8&minlongitude=2.9&maxlongitude=7.5&format=text`
- Covers every magnitude, 2000–2024. Events outside the Netherlands are dropped when the app's data is built.

### PDOK flood risk zones
- WFS: https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0 (layer `overstromingen-risicogebied:risk_zone`, 82,822 zones, 2018 version)
- Dataset page: https://data.overheid.nl/dataset/52349-natuurlijke-risico-zones---overstroming---risicogebied---ror--inspire-geharmoniseerd-
- **Limitation:** `flood.csv` was made from a GML file holding only 20 sample zones (identical 2 km circles), not the full map. Rebuild it from the WFS before relying on the flood factor.

### IBIS Bedrijventerreinen
- Dataset: https://data.overheid.nl/dataset/ibis-bedrijventerreinen
- Download: https://data.overheid.nl/sites/default/files/dataset/02e09429-3d8a-4c87-82d4-201c181b9998/resources/ibis.zip
- Covers 3,881 business parks: gross, net and available hectares, land price range (€/m²) and maximum environmental category. Coordinates are in RD New (EPSG:28992), and `scripts/build_data.py` converts them.
- **Limitation:** the national file is the **2019** edition.

### Kadaster cadastral map (plots)
- Parcel API (OGC API Features): `https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/collections/perceel/items?bbox=<lon1>,<lat1>,<lon2>,<lat2>&f=json`
- Parcel lines overlay (WMS): https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0 (layer `Perceel`)
- Gives every parcel's outline, ID (municipality, section and number) and area. CORS is open, so it can be called from the browser.
- **Limitation:** ownership, sale prices and for-sale status are not open data. They're paid per lookup from Kadaster.

### PDOK Bestuurlijke Gebieden
- WFS: https://service.pdok.nl/kadaster/bestuurlijkegebieden/wfs/v1_0 (layers `Landgebied` for the national outline and `Gemeentegebied` for municipalities)
- Used to check that a pin is inside the Netherlands, to name its municipality, and to dim everything outside the country.

### Basemaps
- Esri: `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}` (and `World_Dark_Gray_Base`)
- PDOK BRT Achtergrondkaart: `https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png`
- OpenStreetMap: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`

## Synthetic data (demo only)
- **Plots for sale and their prices** (`web/public/data/plots.json`, the "Plots for sale" layer, and the "Estimated land value" card) are **simulated**. The parcel shapes are real Kadaster parcels and the price levels are anchored on IBIS 2019 park prices, but which plots are for sale, their asking prices, sellers and dates are generated. See "Plots for sale" in `web/README.md`.

## Tried and not in use
- **Ember monthly electricity generation:** country-level only. Removed from the repo.
- **Digital Decade broadband coverage:** country-level only. Removed.
- **EEA Waterbase** (water quantity and abstraction): national-only data for the Netherlands. Files no longer in the repo.
- **Open-Meteo historical temperature:** a single point near Amsterdam. Temperature was dropped as a factor.
- **CARTO basemaps:** now require an API key, so they were replaced by Esri and PDOK.
