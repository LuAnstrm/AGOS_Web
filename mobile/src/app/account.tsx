import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { LogoMark } from "@/components/brand";
import { Button, Card, styles } from "@/components/ui";
import { ApiError, OfflineError } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { t } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

/** Sign in or create a citizen account. */
export default function Account() {
  const c = useTheme();
  const { locale, signIn, register } = useApp();
  const [mode, setMode] = useState<"signIn" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") await register(email.trim(), password, name.trim());
      else await signIn(email.trim(), password);
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (e) {
      if (e instanceof OfflineError) setError(t(locale, "offline"));
      else if (e instanceof ApiError && e.status === 401) setError(t(locale, "wrongPassword"));
      else if (e instanceof ApiError && e.status === 409) setError(t(locale, "emailTaken"));
      else if (e instanceof ApiError && e.status === 400) setError(e.message);
      else setError(t(locale, "serverError"));
    } finally {
      setBusy(false);
    }
  };

  const input = {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: c.ink,
    backgroundColor: c.page,
    marginBottom: 12,
  };
  const canSubmit =
    email.includes("@") && password.length >= (mode === "register" ? 10 : 1) && (mode === "signIn" || name.trim());

  return (
    <ScrollView style={{ backgroundColor: c.page }} contentContainerStyle={{ padding: 16, paddingTop: 28 }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <LogoMark size={56} />
      </View>
      <Card>
        <Text style={[styles.h1, { color: c.ink, marginBottom: 6 }]}>
          {t(locale, mode === "register" ? "createAccount" : "signIn")}
        </Text>
        <Text style={[styles.body, { color: c.ink2, marginBottom: 16 }]}>{t(locale, "accountWhy")}</Text>

        {mode === "register" && (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t(locale, "yourName")}
            placeholderTextColor={c.muted}
            autoComplete="name"
            maxLength={100}
            style={input}
          />
        )}
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t(locale, "email")}
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={mode === "register" ? `${t(locale, "password")} — ${t(locale, "passwordHint")}` : t(locale, "password")}
          placeholderTextColor={c.muted}
          secureTextEntry
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          style={input}
        />
        {error && (
          <Text accessibilityLiveRegion="polite" style={[styles.body, { color: c.ink, fontWeight: "600", marginBottom: 12 }]}>
            {error}
          </Text>
        )}
        <Button
          label={t(locale, mode === "register" ? "createAccount" : "signIn")}
          onPress={() => void submit()}
          busy={busy}
          disabled={!canSubmit}
        />
        <Text
          accessibilityRole="button"
          onPress={() => {
            setMode((m) => (m === "register" ? "signIn" : "register"));
            setError(null);
          }}
          style={[styles.body, { color: c.ink, textAlign: "center", marginTop: 16, textDecorationLine: "underline" }]}
        >
          {t(locale, mode === "register" ? "haveAccount" : "noAccount")}
        </Text>
      </Card>
    </ScrollView>
  );
}
