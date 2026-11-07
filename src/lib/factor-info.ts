export type FactorKey = "isolation" | "water" | "power" | "climate" | "risk";

export const FACTOR_INFO: {
  key: FactorKey;
  title: string;
  description: string;
  source: string;
}[] = [
  {
    key: "isolation",
    title: "Isolation",
    description:
      "How remote the site is from dense population centers — safety, security, and land availability.",
    source: "OpenStreetMap",
  },
  {
    key: "water",
    title: "Water availability",
    description:
      "Proximity to rivers and lakes, and regional water-stress levels for cooling.",
    source: "OpenStreetMap",
  },
  {
    key: "power",
    title: "Power grid access",
    description: "Proximity to grid capacity and generation data.",
    source: "OpenStreetMap",
  },
  {
    key: "climate",
    title: "Climate & cooling cost",
    description:
      "Ambient temperature and humidity as a proxy for free-air-cooling potential.",
    source: "Open-Meteo (ERA5 reanalysis)",
  },
  {
    key: "risk",
    title: "Natural disaster risk",
    description: "Seismic and flood risk for the site.",
    source: "EMSC Seismic Portal + Open-Meteo Elevation",
  },
];
