import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { api, ApiError, OfflineError } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { t } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { Button, Card, SectionTitle, styles } from "./ui";

type Step = { kind: "enter" } | { kind: "code"; purpose: "subscribe" | "unsubscribe" } | { kind: "done"; text: string };

/**
 * SMS alerts sign-up: for this phone or a relative's basic phone (the code is
 * sent to that number, so only its owner can confirm). Opting out works the
 * same way and removes the number.
 */
export function SmsCard() {
  const c = useTheme();
  const { locale, location, token } = useApp();
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>({ kind: "enter" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const message = (e: unknown) =>
    e instanceof OfflineError
      ? t(locale, "offline")
      : e instanceof ApiError && e.status === 429
        ? t(locale, "smsTooMany")
        : e instanceof ApiError && e.status === 400
          ? e.message.includes("code")
            ? t(locale, "smsWrongCode")
            : t(locale, "smsBadNumber")
          : t(locale, "serverError");

  const request = async (purpose: "subscribe" | "unsubscribe") => {
    setBusy(true);
    setError(null);
    try {
      const pos = location.kind === "ok" ? location.position : null;
      const round = (x: number) => Math.round(x * 1000) / 1000;
      await api.smsCode(
        {
          phone,
          purpose,
          locale,
          ...(purpose === "subscribe" ? { consent: true } : {}),
          ...(pos ? { lat: round(pos.lat), lng: round(pos.lng) } : {}),
        },
        token,
      );
      setCode("");
      setStep({ kind: "code", purpose });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (step.kind !== "code") return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.smsVerify({ phone, code });
      setStep({ kind: "done", text: t(locale, r.active ? "smsOn" : "smsOff") });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const input = {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: c.ink,
    backgroundColor: c.page,
  };

  return (
    <>
      <SectionTitle icon="chatbox-ellipses-outline">{t(locale, "smsTitle")}</SectionTitle>
      <Card>
        <Text style={[styles.small, { color: c.ink2, lineHeight: 19, marginBottom: 12 }]}>{t(locale, "smsWhy")}</Text>

        {step.kind === "done" ? (
          <View style={[styles.row, { alignItems: "flex-start" }]}>
            <Ionicons name="checkmark-circle" size={20} color={c.tiers.safe} style={{ marginRight: 8 }} />
            <Text style={[styles.body, { color: c.ink, flex: 1, fontWeight: "600" }]}>{step.text}</Text>
          </View>
        ) : step.kind === "code" ? (
          <>
            <Text style={[styles.body, { color: c.ink, marginBottom: 8 }]}>{t(locale, "smsEnterCode")}</Text>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              placeholder="123456"
              placeholderTextColor={c.muted}
              style={[input, { letterSpacing: 6, fontSize: 22, textAlign: "center", marginBottom: 12 }]}
            />
            <Button
              label={t(locale, "smsConfirm")}
              onPress={() => void verify()}
              busy={busy}
              disabled={code.length !== 6}
            />
          </>
        ) : (
          <>
            <TextInput
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/[^+0-9 ()-]/g, ""))}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="0917 123 4567"
              placeholderTextColor={c.muted}
              maxLength={20}
              style={[input, { marginBottom: 12 }]}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              onPress={() => setConsent((v) => !v)}
              style={[styles.row, { alignItems: "flex-start", marginBottom: 12 }]}
            >
              <Ionicons name={consent ? "checkbox" : "square-outline"} size={22} color={consent ? c.brand : c.muted} style={{ marginRight: 8 }} />
              <Text style={[styles.small, { color: c.ink2, flex: 1, lineHeight: 18 }]}>{t(locale, "smsConsent")}</Text>
            </Pressable>
            <Button
              icon="chatbox-outline"
              label={t(locale, "smsSendCode")}
              onPress={() => void request("subscribe")}
              busy={busy}
              disabled={!consent || phone.replace(/\D/g, "").length < 10}
            />
            <Text
              accessibilityRole="button"
              onPress={() => phone.replace(/\D/g, "").length >= 10 && void request("unsubscribe")}
              style={[styles.small, { color: c.ink2, textAlign: "center", marginTop: 12, textDecorationLine: "underline" }]}
            >
              {t(locale, "smsStop")}
            </Text>
          </>
        )}

        {error && (
          <Text accessibilityLiveRegion="polite" style={[styles.small, { color: c.ink, fontWeight: "600", marginTop: 10 }]}>
            {error}
          </Text>
        )}
      </Card>
    </>
  );
}
