"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Marker } from "@/lib/scoring/types";
import { ROLE_COLOR, ROLE_LABEL } from "@/lib/scoring/roles";
import { SiteChat } from "@/components/site-chat";

const SiteMap = dynamic(
  () => import("@/components/site-map").then((mod) => mod.SiteMap),
  { ssr: false },
);

const EXAMPLE_PLACES = ["Eindhoven, Netherlands", "Groningen, Netherlands", "Assen, Netherlands"];

type GeocodeResult = {
  displayName: string;
  lat: number;
  lon: number;
  country: string | null;
};

type FactorResult = {
  key: string;
  title: string;
  score: number | null;
  summary: string;
  source: string;
  markers: Marker[];
};

type SiteScore = {
  overallScore: number | null;
  confidence: number;
  factors: FactorResult[];
  markers: Marker[];
};

type Status =
  | { state: "idle" }
  | { state: "geocoding" }
  | { state: "scoring"; site: GeocodeResult }
  | { state: "error"; message: string }
  | { state: "success"; site: GeocodeResult; score: SiteScore };

function scoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBarColor(score: number | null): string {
  if (score == null) return "bg-muted";
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export function SiteSearch() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function runSearch(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;

    setStatus({ state: "geocoding" });

    let site: GeocodeResult;
    try {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(trimmed)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        setStatus({
          state: "error",
          message:
            data.error === "No match found"
              ? 'Couldn\'t find that place — try being more specific, e.g. "city, country".'
              : "Something went wrong. Give it another try.",
        });
        return;
      }

      site = data as GeocodeResult;
    } catch {
      setStatus({
        state: "error",
        message: "Could not reach the geocoding service. Check your connection and try again.",
      });
      return;
    }

    setStatus({ state: "scoring", site });

    try {
      const countryParam = site.country
        ? `&country=${encodeURIComponent(site.country)}`
        : "";
      const response = await fetch(
        `/api/score?lat=${site.lat}&lon=${site.lon}${countryParam}`,
      );
      const score = (await response.json()) as SiteScore;
      setStatus({ state: "success", site, score });
    } catch {
      setStatus({
        state: "error",
        message: "Found the location, but scoring it failed. Give it another try.",
      });
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(query);
  }

  function handleExampleClick(place: string) {
    setQuery(place);
    runSearch(place);
  }

  const isLoading = status.state === "geocoding" || status.state === "scoring";

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a place in Europe, e.g. Vantaa, Finland"
            className="h-12 pl-10 text-base"
          />
        </div>
        <Button type="submit" size="lg" className="h-12 px-6" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {status.state === "geocoding" ? "Finding…" : "Scoring…"}
            </>
          ) : (
            "Score this site"
          )}
        </Button>
      </form>

      {status.state === "idle" && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Try:</span>
          {EXAMPLE_PLACES.map((place) => (
            <button
              key={place}
              type="button"
              onClick={() => handleExampleClick(place)}
              className="rounded-full border px-3 py-1 transition-colors hover:bg-muted hover:text-foreground"
            >
              {place}
            </button>
          ))}
        </div>
      )}

      {status.state === "error" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <SearchX className="size-4 shrink-0" />
          {status.message}
        </div>
      )}

      {(status.state === "scoring" || status.state === "success") && (
        <Card className="overflow-hidden py-0">
          <SiteMap
            center={{ lat: status.site.lat, lon: status.site.lon }}
            pins={[
              {
                lat: status.site.lat,
                lon: status.site.lon,
                label: `${ROLE_LABEL.site}: ${status.site.displayName}`,
                color: ROLE_COLOR.site,
              },
              ...(status.state === "success"
                ? status.score.markers.map((marker) => ({
                    lat: marker.lat,
                    lon: marker.lon,
                    label: marker.label,
                    color: ROLE_COLOR[marker.role],
                  }))
                : []),
            ]}
          />

          {status.state === "success" && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b px-5 py-3 text-xs text-muted-foreground">
              {(
                ["site", ...new Set(status.score.markers.map((m) => m.role))] as (
                  | Marker["role"]
                  | "site"
                )[]
              ).map((role) => (
                <span key={role} className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: ROLE_COLOR[role] }}
                  />
                  {ROLE_LABEL[role]}
                </span>
              ))}
            </div>
          )}

          <CardHeader className="pt-5">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-4 text-primary" />
                {status.site.displayName}
              </CardTitle>
              {status.state === "success" && (
                <div className="text-right">
                  <div className={`text-2xl font-semibold ${scoreColor(status.score.overallScore)}`}>
                    {status.score.overallScore != null
                      ? Math.round(status.score.overallScore)
                      : "—"}
                    <span className="text-sm font-normal text-muted-foreground">/100</span>
                  </div>
                  {status.score.confidence < 1 && (
                    <p className="text-[11px] text-muted-foreground">
                      {Math.round(status.score.confidence * 100)}% of weighted factors scored
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pb-5">
            <p className="text-sm text-muted-foreground">
              {status.site.lat.toFixed(5)}, {status.site.lon.toFixed(5)}
              {status.site.country ? ` · ${status.site.country}` : ""}
            </p>

            {status.state === "scoring" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Checking isolation, water, power, climate, and disaster risk…
              </p>
            )}

            {status.state === "success" && (
              <div className="flex flex-col gap-3">
                {status.score.factors.map((factor) => (
                  <div key={factor.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-1.5 font-medium">
                        {factor.key in ROLE_COLOR && (
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{
                              backgroundColor:
                                ROLE_COLOR[factor.key as Marker["role"]],
                            }}
                          />
                        )}
                        {factor.title}
                      </span>
                      <span className={`font-medium ${scoreColor(factor.score)}`}>
                        {factor.score != null ? Math.round(factor.score) : "N/A"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${scoreBarColor(factor.score)}`}
                        style={{ width: `${factor.score ?? 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {factor.summary}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">
                      Source: {factor.source}
                    </p>
                    {factor.markers.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1.5">
                        {factor.markers.map((marker, index) => (
                          <span
                            key={`${marker.lat}-${marker.lon}-${index}`}
                            className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {marker.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(status.state === "success" || status.state === "error") && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setStatus({ state: "idle" });
          }}
          className="self-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Search another site
        </button>
      )}

      <SiteChat
        site={
          status.state === "success"
            ? {
                displayName: status.site.displayName,
                lat: status.site.lat,
                lon: status.site.lon,
                country: status.site.country,
                score: status.score,
              }
            : undefined
        }
      />
    </div>
  );
}
