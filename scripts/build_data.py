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
write("nl_outline.json", {"type": "Feature", "properties": {"name": "Nederland"},
                          "geometry": {"type": "MultiPolygon", "coordinates": outline}})
