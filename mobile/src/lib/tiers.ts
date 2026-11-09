export type Tier = "safe" | "advisory" | "watch" | "warning" | "critical";
export type RiskClass = "low" | "moderate" | "high";

export const TIERS: readonly Tier[] = ["safe", "advisory", "watch", "warning", "critical"];
export const tierRank = (t: Tier) => TIERS.indexOf(t);

/**
 * Same escalating sequence as the web dashboard. The tier is always shown
 * with its word too, never as color alone.
 */
export const TIER_COLOR: Record<"light" | "dark", Record<Tier, string>> = {
  light: {
    safe: "#0ca30c",
    advisory: "#fab219",
    watch: "#ec835a",
    warning: "#d03b3b",
    critical: "#8f1d1d",
  },
  dark: {
    safe: "#0ca30c",
    advisory: "#fab219",
    watch: "#ec835a",
    warning: "#d03b3b",
    critical: "#e0466f",
  },
};

/** Text that sits ON a tier-colored fill. Dark ink on yellow, white elsewhere. */
export const ON_TIER: Record<Tier, string> = {
  safe: "#ffffff",
  advisory: "#0b0b0b",
  watch: "#0b0b0b",
  warning: "#ffffff",
  critical: "#ffffff",
};
