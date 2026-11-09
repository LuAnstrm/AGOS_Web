import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { Card, LiveBar, styles, TierBadge } from "@/components/ui";
import { useApp, useMyArea } from "@/lib/app-state";
import { formatDistance } from "@/lib/geo";
import { advice, t, TIER_LABEL } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { ON_TIER } from "@/lib/tiers";

/** "My area": the nearest sensor's tier, what to do, depth and the 1-hour outlook. */
export default function Home() {
  const c = useTheme();
  const { locale, latest, live, refresh, location } = useApp();
  const { mine, others } = useMyArea();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <LiveBar />
      {live === "offline" && (
        <Card>
          <Text style={[styles.body, { color: c.ink }]}>{t(locale, "offlineCached")}</Text>
        </Card>
      )}
      {location.kind === "denied" && (
        <Text style={[styles.small, { color: c.ink2, marginBottom: 12 }]}>{t(locale, "locationDenied")}</Text>
      )}

      {!mine ? (
        <Card>
          <Text style={[styles.body, { color: c.ink2 }]}>{t(locale, "noSensors")}</Text>
        </Card>
      ) : (
        <MyAreaCard nodeId={mine.node.id} distanceM={mine.distanceM} />
      )}

      {others.length > 0 && (
        <Card>
          <Text style={[styles.h2, { color: c.ink }]}>{t(locale, "otherSensors")}</Text>
          {others.map(({ node, distanceM }, i) => {
            const p = latest[node.id];
            const depth = p?.filteredCm ?? p?.rawCm;
            return (
              <View
                key={node.id}
                style={[
                  styles.row,
                  {
                    justifyContent: "space-between",
                    paddingVertical: 10,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: c.border,
                  },
                ]}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.body, { color: c.ink, fontWeight: "600" }]} numberOfLines={1}>
                    {node.name ?? node.id}
                  </Text>
                  <Text style={[styles.small, { color: c.muted }]}>
                    {node.barangay ?? ""}
                    {distanceM != null ? ` · ${formatDistance(distanceM)}` : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <TierBadge tier={node.currentTier} />
                  {depth != null && <Text style={[styles.small, { color: c.ink2 }]}>{Math.round(depth)} cm</Text>}
                </View>
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

function MyAreaCard({ nodeId, distanceM }: { nodeId: string; distanceM: number | null }) {
  const c = useTheme();
  const { locale, latest, nodes } = useApp();
  const node = nodes.find((n) => n.id === nodeId)!;
  const p = latest[nodeId];
  const tier = node.currentTier;
  const fg = ON_TIER[tier];
  const depth = p?.filteredCm ?? p?.rawCm;
  const rate = p?.rateCmPerMin;
  const trend =
    rate == null ? null : rate > 0.2 ? t(locale, "rising") : rate < -0.2 ? t(locale, "falling") : t(locale, "steady");

  return (
    <View
      accessible
      accessibilityLabel={`${t(locale, "yourArea")}: ${TIER_LABEL[locale][tier]}. ${advice(locale, tier)}`}
      style={{ backgroundColor: c.tiers[tier], borderRadius: 16, padding: 20, marginBottom: 12 }}
    >
      <Text style={{ color: fg, fontSize: 14, fontWeight: "600", opacity: 0.9 }}>{t(locale, "yourArea")}</Text>
      <Text style={{ color: fg, fontSize: 40, fontWeight: "800", marginTop: 2 }}>{TIER_LABEL[locale][tier]}</Text>
      <Text style={{ color: fg, fontSize: 18, fontWeight: "600", marginTop: 6, lineHeight: 24 }}>{advice(locale, tier)}</Text>

      <View style={{ flexDirection: "row", marginTop: 18, gap: 12 }}>
        <Stat fg={fg} label={t(locale, "depthNow")} value={depth != null ? `${Math.round(depth)} cm` : "—"} />
        <Stat
          fg={fg}
          label={t(locale, "inOneHour")}
          value={p?.h1Cm != null ? `${Math.round(p.h1Cm)} cm` : "—"}
        />
        <Stat fg={fg} label={t(locale, "trend")} value={trend ?? "—"} />
      </View>

      <Text style={{ color: fg, fontSize: 13, marginTop: 16, opacity: 0.9 }}>
        {t(locale, "nearestSensor")}: {node.name ?? node.id}
        {distanceM != null ? ` · ${formatDistance(distanceM)} ${t(locale, "away")}` : ""}
      </Text>
    </View>
  );
}

function Stat({ fg, label, value }: { fg: string; label: string; value: string }) {
  // Filipino words are long ("bumababa"); shrink words rather than break them.
  const long = value.length > 7;
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: fg, fontSize: 12, opacity: 0.9 }}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ color: fg, fontSize: long ? 16 : 20, fontWeight: "700", marginTop: 2 }}
      >
        {value}
      </Text>
    </View>
  );
}
