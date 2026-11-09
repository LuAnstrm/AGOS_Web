import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "@/lib/app-state";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="account" options={{ presentation: "modal", headerShown: true, title: "AGOS" }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
