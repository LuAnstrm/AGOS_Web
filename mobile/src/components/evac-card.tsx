import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import { Linking, Text, View } from "react-native";
import { useApp, useMyArea } from "@/lib/app-state";
import { directionsUrl, recommend, type Sensor } from "@/lib/evac";
import { formatDistance } from "@/lib/geo";
import { t } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { Button, Card, SectionTitle, styles } from "./ui";

/**
 * Nearest safe open evacuation centre (straight-line distance and direction),
 * with a hand-off to the phone's maps app for real street directions.
 * Computed on the phone from cached data, so it works offline.
 */
export function EvacCard() {
  const c = useTheme();
  const { locale, centres, nodes, location } = useApp();
  const { mine } = useMyArea();

  const from =
    location.kind === "ok"
      ? location.position
      : mine?.node.lat != null && mine.node.lng != null
        ? { lat: mine.node.lat, lng: mine.node.lng }
        : null;

  const recs = useMemo(() => {
    if (!from) return [];
    const sensors: Sensor[] = nodes
      .filter((n) => n.lat != null && n.lng != null)
      .map((n) => ({ id: n.id, lat: n.lat!, lng: n.lng!, tier: n.currentTier }));
    return recommend(from, centres, sensors, 3);
  }, [from?.lat, from?.lng, centres, nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!from || centres.length === 0) return null;
  const best = recs[0];

  return (
    <>
      <SectionTitle icon="home-outline">{t(locale, "evacTitle")}</SectionTitle>
      <Card>
        {!best ? (
          <Text style={[styles.body, { color: c.ink }]}>{t(locale, "evacNone")}</Text>
        ) : (
          <>
            <View style={styles.row}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: c.brandSoft,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
                accessibilityLabel={best.compass}
              >
                <Ionicons
                  name="navigate"
                  size={24}
                  color={c.brand}
                  // the navigate glyph points north-east; rotate to the bearing
                  style={{ transform: [{ rotate: `${best.bearingDeg - 45}deg` }] }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontSize: 17, fontWeight: "800" }} numberOfLines={2}>
                  {best.centre.name}
                </Text>
                <Text style={[styles.small, { color: c.ink2, marginTop: 2 }]}>
                  {formatDistance(best.distanceM)} {best.compass} · ~{best.walkMinutes} {t(locale, "evacWalk")}
                  {best.centre.capacity ? ` · ${best.centre.capacity.toLocaleString()}` : ""}
                </Text>
              </View>
            </View>

            {best.safety !== "safe" && (
              <View style={{ flexDirection: "row", marginTop: 12, backgroundColor: c.surface2, borderRadius: 12, padding: 10 }}>
                <Ionicons name="warning" size={18} color={c.tiers.warning} style={{ marginRight: 8 }} />
                <Text style={[styles.small, { color: c.ink, flex: 1, lineHeight: 18 }]}>
                  {t(locale, best.safety === "caution" ? "evacCaution" : "evacUnsafe")}
                </Text>
              </View>
            )}

            {best.centre.placeholder && (
              <Text style={[styles.small, { color: c.muted, marginTop: 10 }]}>ⓘ {t(locale, "evacPlaceholder")}</Text>
            )}

            <View style={{ marginTop: 14 }}>
              <Button
                icon="walk"
                label={t(locale, "evacDirections")}
                onPress={() => void Linking.openURL(directionsUrl(best.centre))}
              />
            </View>

            {recs.length > 1 && (
              <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
                <Text style={[styles.small, { color: c.muted, fontWeight: "700", marginBottom: 4 }]}>{t(locale, "evacOthers")}</Text>
                {recs.slice(1).map((r) => (
                  <Text key={r.centre.id} style={[styles.small, { color: c.ink2, paddingVertical: 3 }]} numberOfLines={1}>
                    {r.centre.name} · {formatDistance(r.distanceM)} {r.compass}
                    {r.safety !== "safe" ? " ⚠" : ""}
                  </Text>
                ))}
              </View>
            )}

            {location.kind !== "ok" && (
              <Text style={[styles.small, { color: c.muted, marginTop: 10 }]}>{t(locale, "evacFromArea")}</Text>
            )}
          </>
        )}
      </Card>
    </>
  );
}
