export type FactorKey = "isolation" | "water" | "power" | "climate" | "risk";

export const FACTOR_INFO: {
  key: FactorKey;
  title: string;
  description: string;
  source: string;
  color: string;
}[] = [
  {
    key: "isolation",
    title: "Isolation",
    description:
      "How remote the site is from dense population centers — safety, security, and land availability.",
    source: "Local Netherlands OpenStreetMap extract",
    color: "#7c3aed",
  },
  {
    key: "water",
    title: "Water availability",
    description:
      "Proximity to rivers and lakes, and regional water-stress levels for cooling.",
    source: "Local Netherlands OpenStreetMap extract",
    color: "#0891b2",
  },
  {
    key: "power",
    title: "Power grid access",
    description: "Proximity to grid capacity and generation data.",
    source: "Local Netherlands OpenStreetMap extract",
    color: "#d97706",
  },
  {
    key: "climate",
    title: "Climate & cooling cost",
    description:
      "Ambient temperature and humidity as a proxy for free-air-cooling potential.",
    source: "Open-Meteo (ERA5 reanalysis)",
    color: "#2563eb",
  },
  {
    key: "risk",
    title: "Natural disaster risk",
    description: "Seismic and flood risk for the site.",
    source: "EMSC Seismic Portal + Open-Meteo Elevation",
    color: "#dc2626",
  },
];
