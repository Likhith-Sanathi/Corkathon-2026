import type { Marker } from "./types";

export type Role = Marker["role"] | "site";

export const ROLE_COLOR: Record<Role, string> = {
  site: "#16a34a",
  isolation: "#7c3aed",
  water: "#0891b2",
  power: "#d97706",
  risk: "#dc2626",
};

export const ROLE_LABEL: Record<Role, string> = {
  site: "Candidate site",
  isolation: "Nearest city",
  water: "Nearest water",
  power: "Nearest grid infrastructure",
  risk: "Nearest significant earthquake",
};
