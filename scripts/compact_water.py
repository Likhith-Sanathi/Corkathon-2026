import json
import sys

from osm_compact_lib import (
    iter_geojsonseq,
    ring_area_m2,
    points_as_latlon,
)

IN_PATH = "data/netherlands/water.geojsonseq"
OUT_PATH = "src/lib/scoring/localdata/netherlands-water.json"
MIN_LAKE_AREA_M2 = 50_000  # ~5 hectares — drops garden ponds/farm ditches


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
        name = props.get("name")

        if gtype in ("Polygon", "MultiPolygon"):
            rings = (
                [p[0] for p in geom["coordinates"]]
                if gtype == "MultiPolygon"
                else [geom["coordinates"][0]]
            )
            outer = max(rings, key=len)
            if ring_area_m2(outer) < MIN_LAKE_AREA_M2:
                skipped += 1
                continue
            kept.append(
                {"points": points_as_latlon(outer), "name": name, "kind": "lake"}
            )
            seen_kinds["lake"] = seen_kinds.get("lake", 0) + 1

        elif gtype in ("LineString", "MultiLineString"):
            waterway = props.get("waterway")
            if waterway not in ("river", "canal"):
                skipped += 1
                continue
            line_groups = (
                geom["coordinates"]
                if gtype == "MultiLineString"
                else [geom["coordinates"]]
            )
            for coords in line_groups:
                kept.append(
                    {
                        "points": points_as_latlon(coords),
                        "name": name,
                        "kind": waterway,
                    }
                )
                seen_kinds[waterway] = seen_kinds.get(waterway, 0) + 1

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(kept, f, ensure_ascii=False, separators=(",", ":"))

    print(f"total: {total}  skipped: {skipped}  kept: {len(kept)}", file=sys.stderr)
    print(f"by kind: {seen_kinds}", file=sys.stderr)


if __name__ == "__main__":
    main()
