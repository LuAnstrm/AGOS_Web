import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { HeaderBrand } from "@/components/brand";
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
        headerStyle: { backgroundColor: c.page },
        headerShadowVisible: false,
        headerTitleAlign: "left",
        headerTitle: () => <HeaderBrand subtitle={t(locale, "place")} />,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarActiveTintColor: c.brand,
        tabBarInactiveTintColor: c.muted,
        sceneStyle: { backgroundColor: c.page },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t(locale, "tabHome"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "water" : "water-outline"} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: t(locale, "tabAlerts"),
          tabBarBadge: recentSerious > 0 ? recentSerious : undefined,
          tabBarBadgeStyle: { backgroundColor: c.tiers.warning, color: "#ffffff", fontSize: 11 },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "notifications" : "notifications-outline"} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: t(locale, "tabSos"),
          tabBarActiveTintColor: c.tiers.warning,
          tabBarIcon: ({ size, focused }) => (
            <Ionicons name={focused ? "alert-circle" : "alert-circle-outline"} size={size + 2} color={c.tiers.warning} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t(locale, "tabSettings"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "settings" : "settings-outline"} size={size} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
