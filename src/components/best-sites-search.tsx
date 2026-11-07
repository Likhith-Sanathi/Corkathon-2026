"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Search, SearchX, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const SiteMap = dynamic(
  () => import("@/components/site-map").then((mod) => mod.SiteMap),
  { ssr: false },
);

const KM_PER_DEGREE_LAT = 111;

const RADIUS_OPTIONS = [
  { label: "50 km", km: 50 },
  { label: "100 km", km: 100 },
  { label: "200 km", km: 200 },
];

type Candidate = {
  lat: number;
  lon: number;
  country: string | null;
  overallScore: number;
  confidence: number;
  factors: { key: string; title: string; score: number | null }[];
};

type BestSitesResponse = {
  candidates: Candidate[];
  gridPoints: number;
  scoredOnLand: number;
};

type Status =
  | { state: "idle" }
  | { state: "loading"; label: string }
  | { state: "error"; message: string }
  | { state: "success"; label: string; result: BestSitesResponse };

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function BestSitesSearch() {
  const [query, setQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(100);
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function runSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setStatus({ state: "loading", label: trimmed });

    try {
      const geocodeResponse = await fetch(
        `/api/geocode?q=${encodeURIComponent(trimmed)}`,
      );
      const geocodeData = await geocodeResponse.json();

      if (!geocodeResponse.ok) {
        setStatus({
          state: "error",
          message:
            geocodeData.error === "No match found"
              ? 'Couldn\'t find that place — try being more specific, e.g. "region, country".'
              : "Something went wrong finding that place.",
        });
        return;
      }

      const center = { lat: geocodeData.lat as number, lon: geocodeData.lon as number };
      const latDelta = radiusKm / KM_PER_DEGREE_LAT;
      const lonDelta =
        radiusKm / (KM_PER_DEGREE_LAT * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.1));

      const bbox = {
        minLat: center.lat - latDelta,
        maxLat: center.lat + latDelta,
        minLon: center.lon - lonDelta,
        maxLon: center.lon + lonDelta,
      };

      const params = new URLSearchParams({
        minLat: bbox.minLat.toString(),
        maxLat: bbox.maxLat.toString(),
        minLon: bbox.minLon.toString(),
        maxLon: bbox.maxLon.toString(),
        stepKm: "25",
        topN: "6",
      });

      const response = await fetch(`/api/best-sites?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setStatus({ state: "error", message: data.error ?? "Search failed." });
        return;
      }

      setStatus({ state: "success", label: trimmed, result: data as BestSitesResponse });
    } catch {
      setStatus({
        state: "error",
        message: "Could not complete the search. Give it another try.",
      });
    }
  }

  const isLoading = status.state === "loading";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4 text-primary" />
          Find the best sites in a region
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Scans a grid around a place and ranks the highest-scoring candidate
          coordinates nearby.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={runSearch} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="A region or country, e.g. Sweden"
              className="h-11 pl-10"
            />
          </div>
          <select
            value={radiusKm}
            onChange={(event) => setRadiusKm(Number(event.target.value))}
            className="h-11 rounded-md border bg-background px-3 text-sm"
          >
            {RADIUS_OPTIONS.map((option) => (
              <option key={option.km} value={option.km}>
                ±{option.label}
              </option>
            ))}
          </select>
          <Button type="submit" className="h-11" disabled={isLoading}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Search"}
          </Button>
        </form>

        {status.state === "error" && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <SearchX className="size-4 shrink-0" />
            {status.message}
          </div>
        )}

        {status.state === "loading" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Scanning the grid around {status.label}, scoring each land point
            in turn — this can take a minute…
          </p>
        )}

        {status.state === "success" && (
          <div className="flex flex-col gap-4">
            <SiteMap
              center={
                status.result.candidates[0] ?? { lat: 54, lon: 15 }
              }
              pins={status.result.candidates.map((candidate, index) => ({
                lat: candidate.lat,
                lon: candidate.lon,
                label: `#${index + 1} · ${Math.round(candidate.overallScore)}/100${candidate.country ? ` · ${candidate.country}` : ""}`,
                color:
                  index === 0
                    ? "#16a34a"
                    : candidate.overallScore >= 70
                      ? "#16a34a"
                      : candidate.overallScore >= 40
                        ? "#d97706"
                        : "#dc2626",
              }))}
            />

            {status.result.candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No land points scored in that area ({status.result.gridPoints}{" "}
                grid points checked, {status.result.scoredOnLand} on land).
                Try a larger radius.
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {status.result.candidates.map((candidate, index) => (
                  <li
                    key={`${candidate.lat}-${candidate.lon}`}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-mono text-xs">
                          {candidate.lat.toFixed(4)}, {candidate.lon.toFixed(4)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {candidate.country ?? "Unknown country"}
                        </p>
                      </div>
                    </div>
                    <span className={`font-semibold ${scoreColor(candidate.overallScore)}`}>
                      {Math.round(candidate.overallScore)}/100
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
