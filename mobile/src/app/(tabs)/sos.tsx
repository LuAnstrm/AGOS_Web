import * as Crypto from "expo-crypto";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Button, Card, styles } from "@/components/ui";
import { api, type MySos, type NewSos, type SosNeed } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { HOTLINES } from "@/lib/config";
import { needText, sosStatusText, t } from "@/lib/i18n";
import { enqueue, flush, queued, type QueuedSos } from "@/lib/sos-queue";
import { useTheme } from "@/lib/theme";

const NEEDS: SosNeed[] = ["trapped", "medical", "elderly", "children", "pwd", "pregnant"];

type Phase =
  | { kind: "form" }
  | { kind: "confirm" }
  | { kind: "sending" }
  | { kind: "done"; result: "sent" | "queued" | "needLocation" | "error" };

export default function Sos() {
  const c = useTheme();
  const { locale, user, token, refreshLocation } = useApp();
  const [people, setPeople] = useState(1);
  const [needs, setNeeds] = useState<SosNeed[]>([]);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [mine, setMine] = useState<MySos[]>([]);
  const [pending, setPending] = useState<QueuedSos[]>([]);

  const loadStatus = useCallback(async () => {
    setPending(await queued());
    if (!token) return;
    try {
      setMine(await api.mySos(token));
    } catch {
      /* offline: keep the last list */
    }
  }, [token]);

  // While this tab is open, poll request status every 20 s.
  useFocusEffect(
    useCallback(() => {
      void loadStatus();
      const id = setInterval(() => void loadStatus(), 20_000);
      return () => clearInterval(id);
    }, [loadStatus]),
  );

  const send = async () => {
    setPhase({ kind: "sending" });
    const loc = await refreshLocation(true);
    if (loc.kind !== "ok") return setPhase({ kind: "done", result: "needLocation" });
    const sos: NewSos = {
      clientId: `app-${Crypto.randomUUID()}`,
      channel: "app",
      lat: Math.round(loc.position.lat * 1e6) / 1e6,
      lng: Math.round(loc.position.lng * 1e6) / 1e6,
      peopleCount: people,
      needs,
      message: message.trim() || undefined,
      reporterPhone: phone.trim() || undefined,
      reportedAt: new Date().toISOString(),
    };
    // Saved on the phone before anything else, so it can't be lost.
    await enqueue(sos);
    const r = await flush(token);
    await loadStatus();
    if (r.rejected.length) return setPhase({ kind: "done", result: "error" });
    setPhase({ kind: "done", result: r.remaining > 0 ? "queued" : "sent" });
    if (r.remaining === 0) {
      setMessage("");
      setNeeds([]);
      setPeople(1);
    }
  };

  const hotlines = (
    <Card>
      <Text style={[styles.body, { color: c.ink2, marginBottom: 10 }]}>{t(locale, "callHotline")}</Text>
      {HOTLINES.map((h) => (
        <Button key={h.number} kind="secondary" label={`☎  ${h.label}`} onPress={() => void Linking.openURL(`tel:${h.number}`)} />
      ))}
    </Card>
  );

  if (!user) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card>
          <Text style={[styles.h1, { color: c.ink, marginBottom: 6 }]}>{t(locale, "sosTitle")}</Text>
          <Text style={[styles.body, { color: c.ink2, marginBottom: 14 }]}>{t(locale, "signInForSos")}</Text>
          <Button label={t(locale, "signIn")} onPress={() => router.push("/account")} />
        </Card>
        {hotlines}
      </ScrollView>
    );
  }
  if (user.role !== "citizen") {
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card>
          <Text style={[styles.body, { color: c.ink }]}>{t(locale, "officerAccount")}</Text>
        </Card>
      </ScrollView>
    );
  }

  const chip = (on: boolean) => ({
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: on ? c.ink : c.border,
    backgroundColor: on ? c.ink : "transparent",
    marginRight: 8,
    marginBottom: 8,
  });
  const input = {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: c.ink,
    backgroundColor: c.page,
  };

  const resultText =
    phase.kind === "done"
      ? {
          sent: t(locale, "sentOk"),
          queued: t(locale, "queued"),
          needLocation: t(locale, "needLocation"),
          error: t(locale, "serverError"),
        }[phase.result]
      : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={[styles.h1, { color: c.ink, marginBottom: 4 }]}>{t(locale, "sosTitle")}</Text>
        <Text style={[styles.body, { color: c.ink2, marginBottom: 16 }]}>{t(locale, "sosIntro")}</Text>

        <Text style={[styles.h2, { color: c.ink }]}>{t(locale, "people")}</Text>
        <View style={[styles.row, { marginBottom: 16 }]}>
          <Stepper label="−" onPress={() => setPeople((p) => Math.max(1, p - 1))} />
          <Text
            accessibilityLabel={`${people}`}
            style={{ color: c.ink, fontSize: 28, fontWeight: "800", minWidth: 56, textAlign: "center" }}
          >
            {people}
          </Text>
          <Stepper label="+" onPress={() => setPeople((p) => Math.min(200, p + 1))} />
        </View>

        <Text style={[styles.h2, { color: c.ink }]}>{t(locale, "needs")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12 }}>
          {NEEDS.map((n) => {
            const on = needs.includes(n);
            return (
              <Pressable
                key={n}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => setNeeds((xs) => (on ? xs.filter((x) => x !== n) : [...xs, n]))}
                style={chip(on)}
              >
                <Text style={{ color: on ? c.page : c.ink, fontWeight: "600" }}>{needText(locale, n)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.h2, { color: c.ink }]}>{t(locale, "messageLabel")}</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder={t(locale, "messagePlaceholder")}
          placeholderTextColor={c.muted}
          maxLength={500}
          multiline
          style={[input, { minHeight: 64, marginBottom: 12 }]}
        />
        <Text style={[styles.h2, { color: c.ink }]}>{t(locale, "phoneLabel")}</Text>
        <TextInput
          value={phone}
          onChangeText={(v) => setPhone(v.replace(/[^+0-9 ()-]/g, ""))}
          keyboardType="phone-pad"
          maxLength={20}
          placeholder="09XX XXX XXXX"
          placeholderTextColor={c.muted}
          style={[input, { marginBottom: 18 }]}
        />

        {phase.kind === "confirm" ? (
          <View>
            <Text style={[styles.h2, { color: c.ink }]}>{t(locale, "confirmTitle")}</Text>
            <Text style={[styles.body, { color: c.ink2, marginBottom: 12 }]}>{t(locale, "confirmBody")}</Text>
            <Button danger label={t(locale, "confirmYes")} onPress={() => void send()} />
            <View style={{ height: 8 }} />
            <Button kind="secondary" label={t(locale, "cancel")} onPress={() => setPhase({ kind: "form" })} />
          </View>
        ) : (
          <Button
            danger
            busy={phase.kind === "sending"}
            label={phase.kind === "sending" ? t(locale, "sending") : t(locale, "send")}
            onPress={() => setPhase({ kind: "confirm" })}
          />
        )}
        {resultText && (
          <Text accessibilityLiveRegion="assertive" style={[styles.body, { color: c.ink, fontWeight: "600", marginTop: 12 }]}>
            {resultText}
          </Text>
        )}
      </Card>

      {(pending.length > 0 || mine.length > 0) && (
        <Card>
          <Text style={[styles.h2, { color: c.ink }]}>{t(locale, "myRequests")}</Text>
          {pending.map((p) => (
            <Text key={p.sos.clientId} style={[styles.body, { color: c.ink, paddingVertical: 6 }]}>
              ⏳ {t(locale, "queued")}
            </Text>
          ))}
          {mine.map((r) => (
            <View key={r.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border }}>
              <Text style={[styles.body, { color: c.ink, fontWeight: "700" }]}>{sosStatusText(locale, r.status)}</Text>
              <Text style={[styles.small, { color: c.muted }]}>
                {new Date(r.createdAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
                {" · "}
                {r.peopleCount}
                {r.assignedTeam ? ` · ${t(locale, "team")}: ${r.assignedTeam}` : ""}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {hotlines}
    </ScrollView>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === "+" ? "more" : "fewer"}
      onPress={onPress}
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: c.ink, fontSize: 26, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
