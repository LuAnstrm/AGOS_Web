import { Text, View } from "react-native";

const MAX_CM = 200;
const KNEE_CM = 45; // Moderate threshold
const WAIST_CM = 90; // High threshold

/**
 * Vertical water-level gauge for the hero card: the fill is the current
 * depth, with the knee (45 cm) and waist (90 cm) marks residents use to judge
 * whether a street is passable.
 */
export function DepthGauge({
  depthCm,
  fg,
  labels,
  height = 150,
}: {
  depthCm: number | null;
  fg: string;
  labels: { knee: string; waist: string };
  height?: number;
}) {
  const pct = depthCm == null ? 0 : Math.max(0, Math.min(1, depthCm / MAX_CM));
  const y = (cm: number) => height - (cm / MAX_CM) * height;
  return (
    <View
      style={{ height, flexDirection: "row" }}
      accessible
      accessibilityLabel={depthCm == null ? "No reading" : `${Math.round(depthCm)} cm`}
    >
      <View
        style={{
          width: 26,
          height,
          borderRadius: 13,
          borderWidth: 2,
          borderColor: fg,
          overflow: "hidden",
          justifyContent: "flex-end",
          opacity: 0.95,
        }}
      >
        <View style={{ height: `${pct * 100}%`, backgroundColor: fg, opacity: 0.85 }} />
      </View>
      <View style={{ width: 64, height, marginLeft: 6 }}>
        {[
          [WAIST_CM, labels.waist],
          [KNEE_CM, labels.knee],
        ].map(([cm, label]) => (
          <View
            key={label as string}
            style={{ position: "absolute", top: y(cm as number) - 8, left: 0, flexDirection: "row", alignItems: "center" }}
          >
            <View style={{ width: 8, height: 2, backgroundColor: fg, marginRight: 4 }} />
            <Text style={{ color: fg, fontSize: 11, fontWeight: "700", opacity: 0.95 }}>{label as string}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
