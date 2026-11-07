"""
Compacts the Ember monthly generation CSV into a per-country power-mix
summary used as a macro "grid strength" signal in the power scoring factor.

Input:  release_generation_monthly_lower.csv (Ember, country/month/source)
Output: src/lib/scoring/localdata/country-power-mix.json

For each country, over its own trailing 12 reported months, this computes:
  - totalGenerationTwh: trailing 12-month generation (grid size proxy)
  - yoyGrowthPct: growth vs. the prior 12-month window (capacity trend)
  - renewableSharePct / nuclearSharePct / fossilSharePct / cleanSharePct
  - hhi: Herfindahl-Hirschman index of the fuel mix (~0.11 for a very
    diverse mix across ~9 fuels, up to 1.0 for a single fuel doing
    everything) — lower means a more resilient grid, not dependent on one
    plant type or fuel.

This is a country-level modifier on top of the OSM-derived "nearest
substation/plant/line" proximity score, not a site-level measurement.
"""

import csv
import json
from collections import defaultdict
from datetime import date

IN_PATH = "release_generation_monthly_lower.csv"
OUT_PATH = "src/lib/scoring/localdata/country-power-mix.json"

# Primitive (non-aggregated) fuel categories used for the diversity index.
# "Hydro, bioenergy and other renewables" is itself flagged as an aggregate
# in the source data, but it's the fallback bucket Ember uses for countries
# that don't report hydro/bioenergy/other-renewables separately, so we treat
# it as its own fuel category rather than dropping that generation entirely.
FUEL_BUCKETS = {
    "Hard coal",
    "Lignite",
    "Gas",
    "Other fossil",
    "Nuclear",
    "Hydro",
    "Onshore wind",
    "Offshore wind",
    "Solar",
    "Bioenergy",
    "Other renewables",
    "Hydro, bioenergy and other renewables",
}

EXCLUDE_AREAS = {"EU"}

# Map alternate country-name spellings (e.g. from Nominatim reverse
# geocoding) to the exact "Area" string used in the Ember CSV.
NAME_ALIASES = {
    "czech republic": "Czechia",
    "turkey": "Türkiye",
    "bosnia and herzegovina": "Bosnia Herzegovina",
    "republic of north macedonia": "North Macedonia",
    "the netherlands": "Netherlands",
    "kingdom of the netherlands": "Netherlands",
}


def parse_date(s: str) -> date:
    y, m, d = s.split("-")
    return date(int(y), int(m), int(d))


def main():
    # rows[area][source] = sorted list of (date, twh)
    rows: dict[str, dict[str, list[tuple[date, float]]]] = defaultdict(
        lambda: defaultdict(list)
    )

    with open(IN_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            area = row["Area"]
            if area in EXCLUDE_AREAS:
                continue
            if row["Area type"] != "Country or economy":
                continue
            twh_raw = row["Generation (TWh)"]
            if not twh_raw:
                continue
            d = parse_date(row["Date"])
            source = row["Electricity source"]
            rows[area][source].append((d, float(twh_raw)))

    output = {}

    for area, by_source in rows.items():
        total_series = sorted(by_source.get("Total generation", []))
        if len(total_series) < 12:
            continue

        latest_date = total_series[-1][0]

        def sum_in_window(source: str, months: int, offset: int = 0) -> float:
            series = sorted(by_source.get(source, []))
            if not series:
                return 0.0
            end_idx = len(series) - offset
            start_idx = max(0, end_idx - months)
            return sum(v for _, v in series[start_idx:end_idx])

        total_twh = sum_in_window("Total generation", 12)
        if total_twh <= 0:
            continue

        prior_total_twh = (
            sum_in_window("Total generation", 12, offset=12)
            if len(total_series) >= 24
            else None
        )

        renewables_twh = sum_in_window("Renewables", 12)
        nuclear_twh = sum_in_window("Nuclear", 12)
        fossil_twh = sum_in_window("Fossil", 12)
        clean_twh = sum_in_window("Clean", 12)

        # Diversity index (HHI) over primitive fuel buckets actually
        # reported by this country in its trailing 12 months.
        fuel_totals: dict[str, float] = {}
        for source in FUEL_BUCKETS:
            v = sum_in_window(source, 12)
            if v > 0:
                fuel_totals[source] = v
        fuel_sum = sum(fuel_totals.values())
        hhi = (
            sum((v / fuel_sum) ** 2 for v in fuel_totals.values())
            if fuel_sum > 0
            else None
        )

        yoy_growth_pct = (
            ((total_twh - prior_total_twh) / prior_total_twh) * 100
            if prior_total_twh and prior_total_twh > 0
            else None
        )

        output[area] = {
            "asOf": latest_date.isoformat(),
            "totalGenerationTwh": round(total_twh, 2),
            "yoyGrowthPct": round(yoy_growth_pct, 1)
            if yoy_growth_pct is not None
            else None,
            "renewableSharePct": round((renewables_twh / total_twh) * 100, 1),
            "nuclearSharePct": round((nuclear_twh / total_twh) * 100, 1),
            "fossilSharePct": round((fossil_twh / total_twh) * 100, 1),
            "cleanSharePct": round((clean_twh / total_twh) * 100, 1),
            "hhi": round(hhi, 3) if hhi is not None else None,
        }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {"aliases": NAME_ALIASES, "countries": output},
            f,
            indent=2,
            ensure_ascii=False,
        )

    print(f"Wrote {len(output)} countries to {OUT_PATH}")


if __name__ == "__main__":
    main()
