import Constants from "expo-constants";

/**
 * Backend URL. EXPO_PUBLIC_AGOS_API wins (set it to your computer's LAN IP,
 * e.g. http://192.168.1.20:3000, when testing on a real phone — "localhost"
 * on a phone is the phone itself). Falls back to app.json `extra.apiUrl`.
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_AGOS_API ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "http://localhost:3000"
).replace(/\/$/, "");

export const WS_URL = API_URL.replace(/^http/, "ws") + "/ws";

/**
 * National emergency hotline. The Malolos CDRRMO direct line should be added
 * here once confirmed with the office (left empty rather than guessed).
 */
export const HOTLINES: { label: string; number: string }[] = [
  { label: "911", number: "911" },
];
