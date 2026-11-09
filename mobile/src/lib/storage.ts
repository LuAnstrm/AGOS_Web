import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Secrets (the sign-in token) go to the OS keychain/keystore via SecureStore.
 * SecureStore has no web implementation, so the web build (used for testing
 * in a browser) falls back to localStorage.
 */
export const secret = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === "web") return safeLocal(() => localStorage.getItem(key)) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") return void safeLocal(() => localStorage.setItem(key, value));
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === "web") return void safeLocal(() => localStorage.removeItem(key));
    await SecureStore.deleteItemAsync(key);
  },
};

/** Non-secret app state and the offline cache (last known readings, queue). */
export const store = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable: the app keeps working from memory.
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

function safeLocal<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
