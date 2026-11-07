import json
import sys

IN_PATH = "data/netherlands/places.geojson"
OUT_PATH = "src/lib/scoring/localdata/netherlands-places.json"


def main():
    with open(IN_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    kept = []
    for feature in data["features"]:
        props = feature.get("properties", {}) or {}
        geom = feature.get("geometry", {}) or {}
        if geom.get("type") != "Point":
            continue
        lon, lat = geom["coordinates"]
        kept.append(
            {
                "points": [[round(lat, 5), round(lon, 5)]],
                "name": props.get("name"),
                "kind": props.get("place"),
            }
        )

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(kept, f, ensure_ascii=False, separators=(",", ":"))

    print(f"kept: {len(kept)}", file=sys.stderr)


if __name__ == "__main__":
    main()
