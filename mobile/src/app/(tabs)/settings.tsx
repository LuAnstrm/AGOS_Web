import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, styles } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { t, type Locale } from "@/lib/i18n";
import { notificationPermission, requestNotifications, type NotifyPermission } from "@/lib/notify";
import { useTheme } from "@/lib/theme";

export default function Settings() {
  const c = useTheme();
  const { locale, setLocale, user, signOut } = useApp();
  const [perm, setPerm] = useState<NotifyPermission>("undetermined");

  useFocusEffect(
    useCallback(() => {
      void notificationPermission().then(setPerm);
    }, []),
  );

  const langChip = (l: Locale, label: string) => (
    <Pressable
      key={l}
      accessibilityRole="button"
      accessibilityState={{ selected: locale === l }}
      onPress={() => setLocale(l)}
      style={{
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: locale === l ? c.ink : c.border,
        backgroundColor: locale === l ? c.ink : "transparent",
        alignItems: "center",
        marginRight: l === "fil" ? 8 : 0,
      }}
    >
      <Text style={{ color: locale === l ? c.page : c.ink, fontWeight: "700", fontSize: 16 }}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Text style={[styles.h2, { color: c.ink }]}>{t(locale, "language")}</Text>
        <View style={styles.row}>
          {langChip("fil", "Filipino")}
          {langChip("en", "English")}
        </View>
      </Card>

      <Card>
        <Text style={[styles.h2, { color: c.ink }]}>{t(locale, "notifications")}</Text>
        <Text style={[styles.body, { color: c.ink2, marginBottom: perm === "granted" ? 0 : 12 }]}>
          {perm === "granted" ? t(locale, "notificationsOn") : t(locale, "notificationsOff")}
        </Text>
        {perm !== "granted" && (
          <Button kind="secondary" label={t(locale, "enable")} onPress={() => void requestNotifications().then(setPerm)} />
        )}
      </Card>

      <Card>
        {user ? (
          <>
            <Text style={[styles.small, { color: c.muted }]}>{t(locale, "signedInAs")}</Text>
            <Text style={[styles.body, { color: c.ink, fontWeight: "700", marginBottom: 2 }]}>{user.displayName}</Text>
            <Text style={[styles.small, { color: c.ink2, marginBottom: 12 }]}>{user.email}</Text>
            <Button kind="secondary" label={t(locale, "signOut")} onPress={() => void signOut()} />
          </>
        ) : (
          <>
            <Text style={[styles.body, { color: c.ink2, marginBottom: 12 }]}>{t(locale, "accountWhy")}</Text>
            <Button label={t(locale, "signIn")} onPress={() => router.push("/account")} />
          </>
        )}
      </Card>
    </ScrollView>
  );
}
