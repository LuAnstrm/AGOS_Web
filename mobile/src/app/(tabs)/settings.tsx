import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LogoMark } from "@/components/brand";
import { SmsCard } from "@/components/sms-card";
import { Button, Card, SectionTitle, styles } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { t, type Locale } from "@/lib/i18n";
import { notificationPermission, requestNotifications, type NotifyPermission } from "@/lib/notify";
import { elevation, useTheme } from "@/lib/theme";

export default function Settings() {
  const c = useTheme();
  const { locale, setLocale, user, signOut } = useApp();
  const [perm, setPerm] = useState<NotifyPermission>("undetermined");

  useFocusEffect(
    useCallback(() => {
      void notificationPermission().then(setPerm);
    }, []),
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 32 }}>
      <SectionTitle icon="language-outline">{t(locale, "language")}</SectionTitle>
      <View
        style={{ flexDirection: "row", backgroundColor: c.surface2, borderRadius: 14, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: c.border }}
      >
        {(
          [
            ["fil", "Filipino"],
            ["en", "English"],
          ] as [Locale, string][]
        ).map(([l, label]) => (
          <Pressable
            key={l}
            accessibilityRole="button"
            accessibilityState={{ selected: locale === l }}
            onPress={() => setLocale(l)}
            style={[
              { flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: "center" },
              locale === l && [{ backgroundColor: c.surface }, elevation(c)],
            ]}
          >
            <Text style={{ color: locale === l ? c.ink : c.muted, fontWeight: "800", fontSize: 15 }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle icon="notifications-outline">{t(locale, "notifications")}</SectionTitle>
      <Card>
        <View style={styles.row}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: perm === "granted" ? c.brandSoft : c.surface2,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name={perm === "granted" ? "notifications" : "notifications-off-outline"} size={18} color={perm === "granted" ? c.brand : c.ink2} />
          </View>
          <Text style={[styles.body, { color: c.ink, flex: 1 }]}>
            {perm === "granted" ? t(locale, "notificationsOn") : t(locale, "notificationsOff")}
          </Text>
        </View>
        {perm !== "granted" && (
          <View style={{ marginTop: 12 }}>
            <Button kind="secondary" icon="notifications" label={t(locale, "enable")} onPress={() => void requestNotifications().then(setPerm)} />
          </View>
        )}
      </Card>

      <SmsCard />

      <SectionTitle icon="person-circle-outline">{t(locale, "account")}</SectionTitle>
      <Card>
        {user ? (
          <>
            <View style={[styles.row, { marginBottom: 14 }]}>
              <View
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandSoft, alignItems: "center", justifyContent: "center", marginRight: 12 }}
              >
                <Text style={{ color: c.brand, fontWeight: "800", fontSize: 16 }}>
                  {user.displayName.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.body, { color: c.ink, fontWeight: "700" }]}>{user.displayName}</Text>
                <Text style={[styles.small, { color: c.muted }]}>{user.email}</Text>
              </View>
            </View>
            <Button kind="secondary" icon="log-out-outline" label={t(locale, "signOut")} onPress={() => void signOut()} />
          </>
        ) : (
          <>
            <Text style={[styles.body, { color: c.ink2, marginBottom: 12 }]}>{t(locale, "accountWhy")}</Text>
            <Button icon="person-add-outline" label={t(locale, "createAccount")} onPress={() => router.push("/account")} />
          </>
        )}
      </Card>

      <SectionTitle icon="information-circle-outline">{t(locale, "about")}</SectionTitle>
      <Card>
        <View style={[styles.row, { marginBottom: 10 }]}>
          <LogoMark size={36} />
          <View style={{ marginLeft: 10 }}>
            <Text style={{ color: c.ink, fontWeight: "800", fontSize: 16 }}>AGOS</Text>
            <Text style={[styles.small, { color: c.muted }]}>v0.1.0 · {t(locale, "place")}</Text>
          </View>
        </View>
        <Text style={[styles.small, { color: c.ink2, lineHeight: 19 }]}>{t(locale, "aboutText")}</Text>
      </Card>
    </ScrollView>
  );
}
