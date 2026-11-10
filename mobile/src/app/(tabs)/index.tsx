import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { DepthGauge } from "@/components/gauge";
import { Card, LiveBar, SectionTitle, styles, TierBadge } from "@/components/ui";
import { useApp, useMyArea } from "@/lib/app-state";
import { formatDistance } from "@/lib/geo";
import { actions, advice, t, TIER_LABEL } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { ON_TIER } from "@/lib/tiers";

/** "My area": the nearest sensor's tier, what to do, depth and the outlook. */
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
      contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <LiveBar />

      {live === "offline" && (
        <Notice icon="cloud-offline-outline" text={t(locale, "offlineCached")} />
      )}
      {location.kind === "denied" && <Notice icon="location-outline" text={t(locale, "locationDenied")} />}

      {!mine ? (
        <Card>
          <Text style={[styles.body, { color: c.ink2 }]}>{t(locale, "noSensors")}</Text>
        </Card>
      ) : (
        <>
          <Hero nodeId={mine.node.id} distanceM={mine.distanceM} />
          <WhatToDo tier={mine.node.currentTier} />
        </>
      )}

      {others.length > 0 && (
        <>
          <SectionTitle icon="pulse-outline">{t(locale, "nearby")}</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {others.map(({ node, distanceM }, i) => {
              const p = latest[node.id];
              const depth = p?.filteredCm ?? p?.rawCm;
              return (
                <View
                  key={node.id}
                  style={[
                    styles.row,
                    {
                      paddingVertical: 12,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: c.border,
                    },
                  ]}
                >
                  <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: c.tiers[node.currentTier], marginRight: 12 }} />
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.body, { color: c.ink, fontWeight: "700" }]} numberOfLines={1}>
                      {node.name ?? node.id}
                    </Text>
                    <Text style={[styles.small, { color: c.muted, marginTop: 1 }]}>
                      {node.barangay ?? ""}
                      {distanceM != null ? ` · ${formatDistance(distanceM)}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <TierBadge tier={node.currentTier} size={13} />
                    {depth != null && (
                      <Text style={{ color: c.ink, fontSize: 17, fontWeight: "800", marginTop: 2 }}>
                        {Math.round(depth)}
                        <Text style={{ color: c.muted, fontSize: 12, fontWeight: "600" }}> cm</Text>
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      )}

      <Text style={{ color: c.muted, fontSize: 12, textAlign: "center", marginTop: 6 }}>{t(locale, "simulated")}</Text>
    </ScrollView>
  );
}

function Notice({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string }) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: c.surface2,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <Ionicons name={icon} size={18} color={c.ink2} style={{ marginRight: 8, marginTop: 1 }} />
      <Text style={[styles.small, { color: c.ink2, flex: 1, lineHeight: 18 }]}>{text}</Text>
    </View>
  );
}

function Hero({ nodeId, distanceM }: { nodeId: string; distanceM: number | null }) {
  const c = useTheme();
  const { locale, latest, nodes } = useApp();
  const node = nodes.find((n) => n.id === nodeId)!;
  const p = latest[nodeId];
  const tier = node.currentTier;
  const fg = ON_TIER[tier];
  const depth = p?.filteredCm ?? p?.rawCm ?? null;
  const rate = p?.rateCmPerMin;
  const trendIcon = rate == null ? null : rate > 0.2 ? "trending-up" : rate < -0.2 ? "trending-down" : "remove";
  const trendText =
    rate == null ? "" : rate > 0.2 ? t(locale, "rising") : rate < -0.2 ? t(locale, "falling") : t(locale, "steady");

  return (
    <View
      accessible
      accessibilityLabel={`${t(locale, "yourArea")}: ${TIER_LABEL[locale][tier]}. ${advice(locale, tier)}`}
      style={{ backgroundColor: c.tiers[tier], borderRadius: 24, padding: 20, marginBottom: 14, overflow: "hidden" }}
    >
      {/* decorative rings */}
      <View style={{ position: "absolute", right: -60, top: -60, width: 220, height: 220, borderRadius: 110, borderWidth: 28, borderColor: fg, opacity: 0.07 }} />
      <View style={{ position: "absolute", right: -20, bottom: -90, width: 180, height: 180, borderRadius: 90, borderWidth: 20, borderColor: fg, opacity: 0.06 }} />

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons name="location" size={14} color={fg} style={{ opacity: 0.9, marginRight: 4 }} />
        <Text style={{ color: fg, fontSize: 13, fontWeight: "700", opacity: 0.9, flex: 1 }} numberOfLines={1}>
          {node.name ?? node.id}
          {distanceM != null ? ` · ${formatDistance(distanceM)}` : ""}
        </Text>
      </View>

      <View style={{ flexDirection: "row", marginTop: 10 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: fg, fontSize: 13, fontWeight: "600", opacity: 0.85 }}>{t(locale, "yourArea")}</Text>
          <Text style={{ color: fg, fontSize: 44, fontWeight: "900", letterSpacing: -1, marginTop: -2 }}>
            {TIER_LABEL[locale][tier]}
          </Text>
          <Text style={{ color: fg, fontSize: 17, fontWeight: "600", marginTop: 4, lineHeight: 23 }}>{advice(locale, tier)}</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 14 }}>
            <Text style={{ color: fg, fontSize: 40, fontWeight: "900", letterSpacing: -1 }}>
              {depth != null ? Math.round(depth) : "—"}
            </Text>
            <Text style={{ color: fg, fontSize: 16, fontWeight: "700", marginLeft: 4, marginBottom: 7, opacity: 0.9 }}>cm</Text>
            {trendIcon && (
              <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 10, marginBottom: 9 }}>
                <Ionicons name={trendIcon} size={16} color={fg} />
                <Text style={{ color: fg, fontSize: 13, fontWeight: "700", marginLeft: 3 }}>{trendText}</Text>
              </View>
            )}
          </View>
        </View>
        <DepthGauge depthCm={depth} fg={fg} labels={{ knee: t(locale, "knee"), waist: t(locale, "waist") }} />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        {[
          [t(locale, "now"), depth],
          [t(locale, "in1h"), p?.h1Cm ?? null],
          [t(locale, "in6h"), p?.h6Cm ?? null],
        ].map(([label, v]) => (
          <View
            key={label as string}
            style={{ flex: 1, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: fg === "#ffffff" ? "rgba(255,255,255,0.16)" : "rgba(11,11,11,0.08)" }}
          >
            <Text style={{ color: fg, fontSize: 12, fontWeight: "600", opacity: 0.9 }}>{label as string}</Text>
            <Text style={{ color: fg, fontSize: 18, fontWeight: "800" }}>
              {v == null ? "—" : `${Math.round(v as number)} cm`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function WhatToDo({ tier }: { tier: Parameters<typeof actions>[1] }) {
  const c = useTheme();
  const { locale } = useApp();
  return (
    <>
      <SectionTitle icon="checkmark-done-outline">{t(locale, "whatToDo")}</SectionTitle>
      <Card style={{ paddingVertical: 6 }}>
        {actions(locale, tier).map((a, i) => (
          <View
            key={a}
            style={[styles.row, { paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, alignItems: "flex-start" }]}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: c.brandSoft,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Text style={{ color: c.brand, fontSize: 12, fontWeight: "800" }}>{i + 1}</Text>
            </View>
            <Text style={[styles.body, { color: c.ink, flex: 1, paddingTop: 1 }]}>{a}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}
