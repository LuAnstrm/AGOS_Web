import { Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useTheme } from "@/lib/theme";

/** AGOS mark: water lines under a downward "level" arrow (same as the web). */
export function LogoMark({ size = 28 }: { size?: number }) {
  const c = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden>
      <Rect width={64} height={64} rx={14} fill={c.brand} />
      <Path d="M10 38c5.5 0 5.5-5 11-5s5.5 5 11 5 5.5-5 11-5 5.5 5 11 5" fill="none" stroke={c.brandInk} strokeWidth={4.5} strokeLinecap="round" />
      <Path d="M10 48c5.5 0 5.5-5 11-5s5.5 5 11 5 5.5-5 11-5 5.5 5 11 5" fill="none" stroke={c.brandInk} strokeOpacity={0.55} strokeWidth={4.5} strokeLinecap="round" />
      <Path d="M32 12v14" stroke={c.brandInk} strokeWidth={4.5} strokeLinecap="round" />
      <Path d="M26 20l6 6 6-6" fill="none" stroke={c.brandInk} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Header title: mark + name + place. */
export function HeaderBrand({ subtitle }: { subtitle: string }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }} accessibilityRole="header">
      <LogoMark size={28} />
      <View style={{ marginLeft: 10 }}>
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: "800", letterSpacing: 0.3 }}>AGOS</Text>
        <Text style={{ color: c.muted, fontSize: 11, fontWeight: "600" }}>{subtitle}</Text>
      </View>
    </View>
  );
}
