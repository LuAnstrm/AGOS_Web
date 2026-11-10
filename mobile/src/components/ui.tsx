import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { agoText, useApp } from "@/lib/app-state";
import { t, TIER_LABEL } from "@/lib/i18n";
import { elevation, useTheme } from "@/lib/theme";
import type { Tier } from "@/lib/tiers";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, elevation(c), style]}>
      {children}
    </View>
  );
}

/** Section heading above a card or list. */
export function SectionTitle({ icon, children }: { icon?: IconName; children: ReactNode }) {
  const c = useTheme();
  return (
    <View style={[styles.row, { marginTop: 8, marginBottom: 10, marginLeft: 2 }]}>
      {icon && <Ionicons name={icon} size={15} color={c.muted} style={{ marginRight: 6 }} />}
      <Text style={{ color: c.ink2, fontSize: 13, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" }}>
        {children}
      </Text>
    </View>
  );
}

/** Tier = colored dot + word. Color never carries the meaning alone. */
export function TierBadge({ tier, size = 14 }: { tier: Tier; size?: number }) {
  const c = useTheme();
  const { locale } = useApp();
  return (
    <View style={styles.row}>
      <View
        style={{
          width: size * 0.7,
          height: size * 0.7,
          borderRadius: size,
          backgroundColor: c.tiers[tier],
          marginRight: 6,
        }}
      />
      <Text style={{ color: c.ink, fontSize: size, fontWeight: "700" }}>{TIER_LABEL[locale][tier]}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = "primary",
  disabled,
  busy,
  danger,
  icon,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "secondary";
  disabled?: boolean;
  busy?: boolean;
  danger?: boolean;
  icon?: IconName;
}) {
  const c = useTheme();
  const primary = kind === "primary";
  const bg = danger ? c.tiers.warning : primary ? c.brand : "transparent";
  const fg = danger ? "#ffffff" : primary ? c.brandInk : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: primary || danger ? bg : c.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 8 }} />}
          <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Connection + freshness, shown under the header. */
export function LiveBar() {
  const c = useTheme();
  const { live, locale, updatedAt } = useApp();
  const now = useNow(30_000);
  const label = live === "live" ? t(locale, "live") : live === "connecting" ? t(locale, "connecting") : "Offline";
  return (
    <View
      style={[
        styles.row,
        {
          justifyContent: "space-between",
          marginBottom: 14,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        },
      ]}
    >
      <View style={styles.row} accessibilityLiveRegion="polite">
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            marginRight: 7,
            backgroundColor: live === "live" ? c.tiers.safe : c.muted,
          }}
        />
        <Text style={{ color: c.ink, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      </View>
      <Text style={{ color: c.muted, fontSize: 12 }}>{agoText(locale, updatedAt, now)}</Text>
    </View>
  );
}

export function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center" },
  button: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "700" },
  h1: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  h2: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13 },
});
