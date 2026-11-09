export type Tier = "safe" | "advisory" | "watch" | "warning" | "critical";
export type RiskClass = "low" | "moderate" | "high";

export const TIERS: readonly Tier[] = ["safe", "advisory", "watch", "warning", "critical"];

export const TIER_LABEL: Record<Tier, { en: string; fil: string }> = {
  safe: { en: "Safe", fil: "Ligtas" },
  advisory: { en: "Advisory", fil: "Abiso" },
  watch: { en: "Watch", fil: "Bantay" },
  warning: { en: "Warning", fil: "Babala" },
  critical: { en: "Critical", fil: "Kritikal" },
};

/** CSS variable holding the tier's color (see globals.css). */
export const tierVar = (t: Tier) => `var(--tier-${t})`;

export const tierRank = (t: Tier) => TIERS.indexOf(t);

export const RISK_LABEL: Record<RiskClass, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

/** Depth bands used by the baseline classifier (ml-service/app/models.py). */
export const MODERATE_FROM_CM = 45;
export const HIGH_FROM_CM = 90;
