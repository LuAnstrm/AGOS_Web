import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Local notifications for five-tier alerts that arrive over the WebSocket
 * while the app is running. (Remote push while the app is closed needs a
 * development build and a push service — see README.)
 *
 * Web has no expo-notifications support, so the browser build uses the
 * Notification API when allowed; the in-app banner is shown either way.
 */
const CHANNEL = "flood-alerts";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type NotifyPermission = "granted" | "denied" | "undetermined";

export async function notificationPermission(): Promise<NotifyPermission> {
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") return "denied";
    return Notification.permission === "default" ? "undetermined" : Notification.permission;
  }
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
}

export async function requestNotifications(): Promise<NotifyPermission> {
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") return "denied";
    const r = await Notification.requestPermission();
    return r === "default" ? "undetermined" : r;
  }
  // Android 13+: the permission prompt only appears once a channel exists.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Flood alerts / Babala sa baha",
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
    });
  }
  const r = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return r.granted ? "granted" : r.canAskAgain ? "undetermined" : "denied";
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(title, { body });
      }
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: Platform.OS === "android" ? { channelId: CHANNEL } : null,
    });
  } catch {
    // A failed notification must never break the alert feed itself.
  }
}

/**
 * Expo push token for remote alerts while the app is closed, or null when
 * unavailable: web, permission not granted, Expo Go on Android (SDK 53+), or
 * no Expo project id configured yet (see README: "Push alerts").
 * Never prompts — the prompt lives in Settings.
 */
export async function pushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    if (!(await Notifications.getPermissionsAsync()).granted) return null;
    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) return null;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}
