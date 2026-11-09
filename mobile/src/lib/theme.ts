import { useColorScheme } from "react-native";
import { TIER_COLOR } from "./tiers";

const LIGHT = {
  page: "#f9f9f7",
  surface: "#fcfcfb",
  ink: "#0b0b0b",
  ink2: "#52514e",
  muted: "#6f6d68",
  border: "rgba(11,11,11,0.12)",
  hover: "rgba(11,11,11,0.05)",
  tiers: TIER_COLOR.light,
};
const DARK = {
  page: "#0d0d0d",
  surface: "#1a1a19",
  ink: "#f0efec",
  ink2: "#c3c2b7",
  muted: "#9a9892",
  border: "rgba(255,255,255,0.12)",
  hover: "rgba(255,255,255,0.06)",
  tiers: TIER_COLOR.dark,
};

export type Theme = typeof LIGHT;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}
