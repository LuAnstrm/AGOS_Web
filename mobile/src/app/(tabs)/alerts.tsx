import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Card, LiveBar, styles } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { distanceM } from "@/lib/geo";
import { t, TIER_LABEL } from "@/lib/i18n";
import { elevation, useTheme } from "@/lib/theme";
import { ON_TIER, tierRank } from "@/lib/tiers";

const NEAR_M = 3000;

export default function Alerts() {
  const c = useTheme();
  const { locale, alerts, nodes, location } = useApp();
  const [scope, setScope] = useState<"near" | "all">("near");
  const hasLocation = location.kind === "ok";

  const shown = useMemo(() => {
    if (scope === "all" || location.kind !== "ok") return alerts;
    return alerts.filter((a) => {
      const n = nodes.find((x) => x.id === a.nodeId);
      return n?.lat != null && n.lng != null && distanceM(location.position, { lat: n.lat, lng: n.lng }) <= NEAR_M;
    });
  }, [alerts, nodes, location, scope]);

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 32 }}
      data={shown}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={
        <>
          <LiveBar />
          {hasLocation && (
            <View
              style={{
                flexDirection: "row",
                backgroundColor: c.surface2,
                borderRadius: 12,
                padding: 3,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              {(["near", "all"] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setScope(s)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: scope === s }}
                  style={[
                    { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
                    scope === s && [{ backgroundColor: c.surface }, elevation(c)],
                  ]}
                >
                  <Text style={{ color: scope === s ? c.ink : c.muted, fontWeight: "700", fontSize: 14 }}>
                    {t(locale, s === "near" ? "alertsNearMe" : "alertsAll")}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        <Card style={{ alignItems: "center", paddingVertical: 32 }}>
          <Ionicons name="notifications-off-outline" size={32} color={c.muted} />
          <Text style={[styles.body, { color: c.ink2, marginTop: 8 }]}>{t(locale, "noAlerts")}</Text>
        </Card>
      }
      renderItem={({ item: a, index }) => {
        const n = nodes.find((x) => x.id === a.nodeId);
        const up = a.previousTier ? tierRank(a.tier) > tierRank(a.previousTier) : true;
        const last = index === shown.length - 1;
        return (
          <View style={{ flexDirection: "row" }}>
            {/* timeline rail */}
            <View style={{ width: 36, alignItems: "center" }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: c.tiers[a.tier],
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 14,
                }}
              >
                <Ionicons name={up ? "arrow-up" : "arrow-down"} size={15} color={ON_TIER[a.tier]} />
              </View>
              {!last && <View style={{ flex: 1, width: 2, backgroundColor: c.border, marginTop: 4 }} />}
            </View>
            <Card style={{ flex: 1, marginLeft: 8 }}>
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Text style={{ color: c.ink, fontSize: 16, fontWeight: "800" }}>
                  {TIER_LABEL[locale][a.tier]}
                  {a.previousTier && (
                    <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
                      {"  "}
                      {locale === "fil" ? "mula" : "from"} {TIER_LABEL[locale][a.previousTier]}
                    </Text>
                  )}
                </Text>
                <Text style={[styles.small, { color: c.muted }]}>
                  {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <Text style={[styles.small, { color: c.ink2, marginTop: 2, marginBottom: 6, fontWeight: "600" }]}>
                {n?.name ?? a.nodeId}
                {n?.barangay ? ` · ${n.barangay}` : ""}
              </Text>
              <Text style={[styles.body, { color: c.ink }]}>{locale === "fil" ? a.messageFil : a.messageEn}</Text>
            </Card>
          </View>
        );
      }}
    />
  );
}
