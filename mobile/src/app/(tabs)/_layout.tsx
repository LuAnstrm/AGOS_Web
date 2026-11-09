import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useNow } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { t } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { tierRank } from "@/lib/tiers";

export default function TabsLayout() {
  const c = useTheme();
  const { locale, alerts } = useApp();
  const now = useNow(60_000);
  const recentSerious = alerts.filter(
    (a) => tierRank(a.tier) >= tierRank("watch") && now - Date.parse(a.createdAt) < 3 * 3600_000,
  ).length;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTitleStyle: { color: c.ink, fontWeight: "700" },
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarActiveTintColor: c.ink,
        tabBarInactiveTintColor: c.muted,
        sceneStyle: { backgroundColor: c.page },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t(locale, "tabHome"),
          tabBarIcon: ({ color, size }) => <Ionicons name="water" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: t(locale, "tabAlerts"),
          tabBarBadge: recentSerious > 0 ? recentSerious : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: t(locale, "tabSos"),
          tabBarIcon: ({ size }) => <Ionicons name="alert-circle" size={size} color={c.tiers.warning} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t(locale, "tabSettings"),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
