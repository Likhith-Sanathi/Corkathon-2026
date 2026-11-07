import json
import sys

from osm_compact_lib import iter_geojsonseq, centroid, points_as_latlon

IN_PATH = "data/netherlands/power.geojsonseq"
OUT_PATH = "src/lib/scoring/localdata/netherlands-power.json"
KEEP_POWER_TAGS = {"substation", "plant", "line"}


def main():
    kept = []
    seen_kinds = {}
    skipped = 0
    total = 0

    for line in iter_geojsonseq(IN_PATH):
        total += 1
        try:
            feature = json.loads(line)
        except json.JSONDecodeError:
            continue

        props = feature.get("properties", {}) or {}
        geom = feature.get("geometry", {}) or {}
        gtype = geom.get("type")
        power = props.get("power")
        name = props.get("name")

        if power not in KEEP_POWER_TAGS:
            skipped += 1
            continue

        if gtype == "Point":
            lon, lat = geom["coordinates"]
            kept.append(
                {
                    "points": [[round(lat, 5), round(lon, 5)]],
                    "name": name,
                    "kind": power,
                }
            )
        elif gtype in ("Polygon", "MultiPolygon"):
            outer = (
                geom["coordinates"][0][0]
                if gtype == "MultiPolygon"
                else geom["coordinates"][0]
            )
            lat, lon = centroid(outer)
            kept.append({"points": [[lat, lon]], "name": name, "kind": power})
        elif gtype in ("LineString", "MultiLineString"):
            line_groups = (
                geom["coordinates"]
                if gtype == "MultiLineString"
                else [geom["coordinates"]]
            )
            for coords in line_groups:
                kept.append(
                    {"points": points_as_latlon(coords), "name": name, "kind": power}
                )
        else:
            skipped += 1
            continue

        seen_kinds[power] = seen_kinds.get(power, 0) + 1

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(kept, f, ensure_ascii=False, separators=(",", ":"))

    print(f"total: {total}  skipped: {skipped}  kept: {len(kept)}", file=sys.stderr)
    print(f"by kind: {seen_kinds}", file=sys.stderr)


if __name__ == "__main__":
    main()
