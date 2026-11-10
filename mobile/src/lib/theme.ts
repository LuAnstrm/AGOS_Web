import { Platform, useColorScheme, type ViewStyle } from "react-native";
import { TIER_COLOR } from "./tiers";

const LIGHT = {
  dark: false,
  page: "#f3f4f1",
  surface: "#ffffff",
  surface2: "#f6f6f3",
  ink: "#0b0b0b",
  ink2: "#4f4e4a",
  muted: "#6f6d68",
  border: "rgba(11,11,11,0.09)",
  hover: "rgba(11,11,11,0.05)",
  brand: "#0e5fa8",
  brandInk: "#ffffff",
  brandSoft: "rgba(14,95,168,0.10)",
  tiers: TIER_COLOR.light,
};
const DARK: typeof LIGHT = {
  dark: true,
  page: "#0b0c0c",
  surface: "#161716",
  surface2: "#1f201f",
  ink: "#f0efec",
  ink2: "#c3c2b7",
  muted: "#9a9892",
  border: "rgba(255,255,255,0.09)",
  hover: "rgba(255,255,255,0.06)",
  brand: "#4c9ff0",
  brandInk: "#06121f",
  brandSoft: "rgba(76,159,240,0.16)",
  tiers: TIER_COLOR.dark,
};

export type Theme = typeof LIGHT;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}

/** Soft card elevation that looks the same on iOS, Android and web. */
export function elevation(t: Theme): ViewStyle {
  if (t.dark) return {};
  return Platform.select<ViewStyle>({
    android: { elevation: 1 },
    default: {
      shadowColor: "#0b0b0b",
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
  })!;
}
