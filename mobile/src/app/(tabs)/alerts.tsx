import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Card, LiveBar, styles, TierBadge } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { distanceM } from "@/lib/geo";
import { t } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

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

  const chip = (active: boolean) => ({
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: active ? c.ink : c.border,
    backgroundColor: active ? c.ink : "transparent",
    marginRight: 8,
  });

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={shown}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={
        <>
          <LiveBar />
          {hasLocation && (
            <View style={[styles.row, { marginBottom: 12 }]}>
              {(["near", "all"] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setScope(s)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: scope === s }}
                  style={chip(scope === s)}
                >
                  <Text style={{ color: scope === s ? c.page : c.ink, fontWeight: "600" }}>
                    {t(locale, s === "near" ? "alertsNearMe" : "alertsAll")}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        <Card>
          <Text style={[styles.body, { color: c.ink2 }]}>{t(locale, "noAlerts")}</Text>
        </Card>
      }
      renderItem={({ item: a }) => {
        const n = nodes.find((x) => x.id === a.nodeId);
        return (
          <Card style={{ borderLeftWidth: 5, borderLeftColor: c.tiers[a.tier] }}>
            <View style={[styles.row, { justifyContent: "space-between", marginBottom: 6 }]}>
              <TierBadge tier={a.tier} size={16} />
              <Text style={[styles.small, { color: c.muted }]}>
                {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
            <Text style={[styles.small, { color: c.ink2, marginBottom: 4 }]}>
              {n?.name ?? a.nodeId}
              {n?.barangay ? ` · ${n.barangay}` : ""}
            </Text>
            <Text style={[styles.body, { color: c.ink }]}>{locale === "fil" ? a.messageFil : a.messageEn}</Text>
          </Card>
        );
      }}
    />
  );
}
