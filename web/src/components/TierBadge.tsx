import { TIER_LABEL, tierVar, type Tier } from "@/lib/tiers";

/** Tier = colored dot + text label. Color never carries the meaning alone. */
export function TierBadge({ tier, lang = "en" }: { tier: Tier; lang?: "en" | "fil" }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: tierVar(tier) }}
      />
      {TIER_LABEL[tier][lang]}
    </span>
  );
}
