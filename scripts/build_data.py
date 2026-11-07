"""Build the compact JSON layers the web app loads, from the CSVs in the repo root.

Usage:  python3 scripts/build_data.py
Output: web/public/data/*.json

Each source CSV is filtered down to the features the scoring algorithm uses
(see the "Scoring" section of web/README.md), so the app ships a few MB
instead of ~140 MB of raw OSM extracts.
"""
import csv
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "public", "data")
CACHE = os.path.join(ROOT, "scripts", ".cache")
PDOK_WFS = (
    "https://service.pdok.nl/kadaster/bestuurlijkegebieden/wfs/v1_0?service=WFS&version=2.0.0"
    "&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&typeName=bestuurlijkegebieden:"
)
MUNICIPALITIES_URL = PDOK_WFS + "Gemeentegebied"
COUNTRY_URL = PDOK_WFS + "Landgebied"
# IBIS business parks (Interprovinciaal Overleg, CC0): every Dutch business park with
# gross/net/available hectares, land prices and the maximum environmental category.
IBIS_URL = "https://data.overheid.nl/sites/default/files/dataset/02e09429-3d8a-4c87-82d4-201c181b9998/resources/ibis.zip"

csv.field_size_limit(sys.maxsize)


def osm_rows(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            yield row, json.loads(row["feature_tags"])


def r5(x):
    return round(float(x), 5)


def max_kv(tags):
    """Highest voltage in kV from an OSM voltage tag such as '380000;150000'."""
    vals = [int(v) for v in re.split(r"[;,]", str(tags.get("voltage", ""))) if v.strip().isdigit()]
    return max(vals) // 1000 if vals else None


def write(name, data):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    count = len(data["features"]) if isinstance(data, dict) and "features" in data else len(data)
    print(f"{name:<22} {count:>7} items  {os.path.getsize(path) / 1e6:6.2f} MB")


# ---------- power ----------
substations, lines, towers = [], [], []
for row, t in osm_rows("power.csv"):
    p = t.get("power")
    lat, lon, name = r5(row["latitude"]), r5(row["longitude"]), row["name"]
    if p == "substation":
        kv = max_kv(t)
        if kv and kv >= 110:
            substations.append({"lat": lat, "lon": lon, "kv": kv, "name": name or t.get("operator", "")})
    elif p == "line":
        kv = max_kv(t)
        if kv and kv >= 110:
            lines.append({"lat": lat, "lon": lon, "kv": kv, "name": name or t.get("operator", "")})
    elif p == "tower":
        # Pylons carry overhead high-voltage lines in NL; lower voltages run underground.
        towers.append({"lat": lat, "lon": lon})

# ---------- water ----------
WATERWAYS = {"river", "canal"}
WATER_BODIES = {"lake", "reservoir", "river", "canal"}
water = []
for row, t in osm_rows("water.csv"):
    kind = t.get("waterway") if t.get("waterway") in WATERWAYS else (
        t.get("water") if t.get("natural") == "water" and t.get("water") in WATER_BODIES else None)
    if kind:
        water.append({"lat": r5(row["latitude"]), "lon": r5(row["longitude"]), "type": kind, "name": row["name"]})

# ---------- roads ----------
junctions = [
    {"lat": r5(row["latitude"]), "lon": r5(row["longitude"]), "name": row["name"] or t.get("ref", "")}
    for row, t in osm_rows("roads.csv") if t.get("highway") == "motorway_junction"
]

# ---------- isolation ----------
PLACE_WEIGHT = {"city": 1.0, "town": 0.5, "suburb": 0.3, "village": 0.15, "hamlet": 0.03}
places = [
    {"lat": r5(row["latitude"]), "lon": r5(row["longitude"]), "type": t["place"],
     "w": PLACE_WEIGHT[t["place"]], "name": row["name"]}
    for row, t in osm_rows("isolation.csv") if t.get("place") in PLACE_WEIGHT
]

# ---------- telecom ----------
telecom = [
    {"lat": r5(row["latitude"]), "lon": r5(row["longitude"]), "type": t["telecom"],
     "name": row["name"] or t.get("operator", "")}
    for row, t in osm_rows("telecom.csv") if t.get("telecom") in ("data_center", "exchange")
]

# ---------- seismic ----------
seismic = []
with open(os.path.join(ROOT, "seismic.csv"), encoding="utf-8") as fh:
    for r in csv.DictReader(fh):
        try:
            seismic.append({"lat": r5(r["latitude"]), "lon": r5(r["longitude"]), "mag": float(r["magnitude"]),
                            "time": r["time"][:10], "depth": r["depth_km"], "place": r["eventlocationname"]})
        except ValueError:
            continue

# ---------- flood ----------
PROTECTION = {"B": "Protected (behind flood defences)", "D": "Unprotected"}
flood = {"type": "FeatureCollection", "features": []}
with open(os.path.join(ROOT, "flood.csv"), encoding="utf-8") as fh:
    for r in csv.DictReader(fh):
        coords = [[r5(x), r5(y)] for x, y in
                  (pair.split() for pair in r["wkt"].removeprefix("POLYGON((").removesuffix("))").split(","))]
        flood["features"].append({
            "type": "Feature",
            "properties": {"id": r["zone_id"], "basin": r["river_basin"], "type": r["protection_type_code"],
                           "label": PROTECTION.get(r["protection_type_code"], "Unclassified risk zone")},
            "geometry": {"type": "Polygon", "coordinates": [coords]},
        })


# ---------- Netherlands boundary (municipalities, simplified) ----------
def simplify(points, tol):
    """Douglas-Peucker on a ring of [lon, lat] points."""
    if len(points) < 4:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = points[a], points[b]
        dx, dy = x2 - x1, y2 - y1
        norm = (dx * dx + dy * dy) ** 0.5
        best, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            if norm < 1e-12:  # closed ring: start == end, use distance to that point
                d = ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
            else:
                d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm
            if d > best:
                best, idx = d, i
        if best > tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    out = [p for p, k in zip(points, keep) if k]
    return out if len(out) >= 4 else points


def cached(name, url):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        print(f"downloading {name} from PDOK ...")
        subprocess.run(["curl", "-s", "-m", "300", "-o", path, url], check=True)
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# ---------- Netherlands outline: drop every feature outside the country ----------
import numpy as np  # noqa: E402

country = cached("landgebied.json", COUNTRY_URL)["features"][0]["geometry"]
country_polys = country["coordinates"] if country["type"] == "MultiPolygon" else [country["coordinates"]]
outline = [[[[r5(x), r5(y)] for x, y in simplify(ring, 0.0003)] for ring in poly] for poly in country_polys]


def inside_nl(items):
    """Keep items whose lat/lon falls inside the Dutch national outline (vectorised ray casting)."""
    if not items:
        return items
    lon = np.array([it["lon"] for it in items])
    lat = np.array([it["lat"] for it in items])
    keep = np.zeros(len(items), dtype=bool)
    for poly in outline:
        for k, ring in enumerate(poly):
            r = np.array(ring)
            xi, yi = r[:, 0], r[:, 1]
            xj, yj = np.roll(xi, 1), np.roll(yi, 1)
            ring_in = np.zeros(len(items), dtype=bool)
            for a, b, c, d in zip(xi, yi, xj, yj):
                crosses = (b > lat) != (d > lat)
                with np.errstate(divide="ignore", invalid="ignore"):
                    x_at = (c - a) * (lat - b) / (d - b) + a
                ring_in ^= crosses & (lon < x_at)
            keep = keep | ring_in if k == 0 else keep & ~ring_in  # first ring is the outer edge, rest are holes
    return [it for it, k in zip(items, keep) if k]


before = {}
for name in ("substations", "lines", "towers", "water", "junctions", "places", "telecom", "seismic"):
    data = globals()[name]
    before[name] = len(data)
    globals()[name] = inside_nl(data)
    dropped = before[name] - len(globals()[name])
    if dropped:
        print(f"  {name}: dropped {dropped} outside the Netherlands")

gem = cached("gemeenten.json", MUNICIPALITIES_URL)
munis = {"type": "FeatureCollection", "features": []}
for f in gem["features"]:
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    out = [[[[r5(x), r5(y)] for x, y in simplify(ring, 0.0008)] for ring in poly] for poly in polys]
    munis["features"].append({
        "type": "Feature",
        "properties": {"name": f["properties"]["naam"], "province": f["properties"]["ligtInProvincieNaam"]},
        "geometry": {"type": "MultiPolygon", "coordinates": out},
    })

# ---------- IBIS business parks ----------
import struct  # noqa: E402
import zipfile  # noqa: E402


def rd_to_wgs84(x, y):
    """Dutch RD New (EPSG:28992) to WGS84 lat/lon. Standard polynomial approximation, error < 1 m."""
    dx, dy = (x - 155000) * 1e-5, (y - 463000) * 1e-5
    k = [(0, 1, 3235.65389), (2, 0, -32.58297), (0, 2, -0.24750), (2, 1, -0.84978), (0, 3, -0.06550), (2, 2, -0.01709),
         (1, 0, -0.00738), (4, 0, 0.00530), (2, 3, -0.00039), (4, 1, 0.00033), (1, 1, -0.00012)]
    l = [(1, 0, 5260.52916), (1, 1, 105.94684), (1, 2, 2.45656), (3, 0, -0.81885), (1, 3, 0.05594), (3, 1, -0.05607),
         (0, 1, 0.01199), (3, 2, -0.00256), (1, 4, 0.00128), (0, 2, 0.00022), (2, 0, -0.00022), (5, 0, 0.00026)]
    lat = 52.15517440 + sum(c * dx ** p * dy ** q for p, q, c in k) / 3600
    lon = 5.38720621 + sum(c * dx ** p * dy ** q for p, q, c in l) / 3600
    return lat, lon


def read_dbf(raw):
    n, hlen, rlen = struct.unpack("<IHH", raw[4:12])
    fields, off = [], 32
    while raw[off] != 0x0D:
        fields.append((raw[off:off + 11].split(b"\0")[0].decode("latin-1"), raw[off + 16]))
        off += 32
    rows = []
    for i in range(n):
        rec = raw[hlen + i * rlen: hlen + (i + 1) * rlen]
        o, row = 1, {}
        for name, ln in fields:
            row[name] = rec[o:o + ln].decode("latin-1").replace("\0", "").strip()
            o += ln
        rows.append(row if rec[:1] != b"*" else None)
    return rows


def read_shp_polygons(raw):
    """Yield a list of rings (each a list of (x, y)) per record of a polygon shapefile."""
    off = 100
    while off < len(raw):
        _, words = struct.unpack(">II", raw[off:off + 8])
        body = raw[off + 8: off + 8 + words * 2]
        off += 8 + words * 2
        if struct.unpack("<i", body[:4])[0] == 0:  # null shape
            yield []
            continue
        nparts, npts = struct.unpack("<ii", body[36:44])
        parts = list(struct.unpack(f"<{nparts}i", body[44:44 + 4 * nparts])) + [npts]
        pts = struct.unpack(f"<{2 * npts}d", body[44 + 4 * nparts: 44 + 4 * nparts + 16 * npts])
        yield [[(pts[2 * j], pts[2 * j + 1]) for j in range(parts[i], parts[i + 1])] for i in range(nparts)]


def num(v):
    try:
        f = float(v)
        return round(f, 2) if f >= 0 else None
    except ValueError:  # '****' = not filled in
        return None


def signed_area(ring):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1])) / 2


ibis_zip = os.path.join(CACHE, "ibis.zip")
if not os.path.exists(ibis_zip):
    print("downloading IBIS business parks ...")
    subprocess.run(["curl", "-s", "-L", "-m", "300", "-o", ibis_zip, IBIS_URL], check=True)
with zipfile.ZipFile(ibis_zip) as z:
    dbf_rows = read_dbf(z.read("ibis.dbf"))
    shapes = list(read_shp_polygons(z.read("ibis.shp")))

ibis = {"type": "FeatureCollection", "features": []}
for row, rings in zip(dbf_rows, shapes):
    if not row or not rings:
        continue
    polys = []
    for ring in rings:
        ll = [[r5(lon), r5(lat)] for lat, lon in (rd_to_wgs84(x, y) for x, y in ring)]
        ll = simplify(ll, 0.00008)
        # Shapefile outer rings run clockwise in RD (negative signed area); holes run counter-clockwise.
        if signed_area(ring) < 0 or not polys:
            polys.append([ll])
        else:
            polys[-1].append(ll)
    ibis["features"].append({
        "type": "Feature",
        "properties": {
            "id": row["RIN_NUMMER"],
            "name": row["PLAN_NAAM"].title(),
            "place": row["KERN_NAAM"].title(),
            "municipality": row["GEM_NAMEN"].title(),
            "year": int(num(row["JAAR"]) or 0),
            "haGross": num(row["HA_BRUTO"]),
            "haNet": num(row["HA_NETTO"]),
            "haAvailable": num(row["HA_TOTTUIT"]),  # immediately available to buy or lease
            "priceMin": num(row["MN_VPRIJS"]) or None,  # land sale price, EUR per m2
            "priceMax": num(row["MX_VPRIJS"]) or None,
            "maxEnvCategory": row["MAX_MILIEU"] if row["MAX_MILIEU"] not in ("", "X") else None,
        },
        "geometry": {"type": "MultiPolygon", "coordinates": polys},
    })

os.makedirs(OUT, exist_ok=True)
write("substations.json", substations)
write("lines.json", lines)
write("towers.json", towers)
write("water.json", water)
write("junctions.json", junctions)
write("places.json", places)
write("telecom.json", telecom)
write("seismic.json", seismic)
write("flood.json", flood)
write("municipalities.json", munis)
write("ibis.json", ibis)
write("nl_outline.json", {"type": "Feature", "properties": {"name": "Nederland"},
                          "geometry": {"type": "MultiPolygon", "coordinates": outline}})
