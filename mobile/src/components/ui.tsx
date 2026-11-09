import { useEffect, useState, type ReactNode } from "react";
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
import { useTheme } from "@/lib/theme";
import type { Tier } from "@/lib/tiers";

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

/** Tier = colored dot + word. Color never carries the meaning alone. */
export function TierBadge({ tier, size = 14 }: { tier: Tier; size?: number }) {
  const c = useTheme();
  const { locale } = useApp();
  return (
    <View style={styles.row}>
      <View style={{ width: size * 0.75, height: size * 0.75, borderRadius: size, backgroundColor: c.tiers[tier], marginRight: 6 }} />
      <Text style={{ color: c.ink, fontSize: size, fontWeight: "600" }}>{TIER_LABEL[locale][tier]}</Text>
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
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "secondary";
  disabled?: boolean;
  busy?: boolean;
  danger?: boolean;
}) {
  const c = useTheme();
  const primary = kind === "primary";
  const bg = danger ? c.tiers.warning : primary ? c.ink : "transparent";
  const fg = danger ? "#ffffff" : primary ? c.page : c.ink;
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
        },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

/** Connection strip: Live / Connecting / Offline + when data last arrived. */
export function LiveBar() {
  const c = useTheme();
  const { live, locale, updatedAt } = useApp();
  const now = useNow(30_000);
  const label = live === "live" ? t(locale, "live") : live === "connecting" ? t(locale, "connecting") : "Offline";
  return (
    <View style={[styles.row, { justifyContent: "space-between", marginBottom: 12 }]}>
      <View style={styles.row} accessibilityLiveRegion="polite">
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            marginRight: 6,
            backgroundColor: live === "live" ? c.tiers.safe : c.muted,
          }}
        />
        <Text style={{ color: c.ink2, fontSize: 13 }}>{label}</Text>
      </View>
      <Text style={{ color: c.muted, fontSize: 13 }}>{agoText(locale, updatedAt, now)}</Text>
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
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center" },
  button: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "700" },
  h1: { fontSize: 22, fontWeight: "700" },
  h2: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13 },
});
