export type Marker = {
  lat: number;
  lon: number;
  label: string;
  role: "site" | "isolation" | "water" | "power" | "risk";
};

export type FactorResult = {
  key: "isolation" | "water" | "power" | "climate" | "risk";
  title: string;
  score: number | null;
  summary: string;
  source: string;
  markers: Marker[];
};
