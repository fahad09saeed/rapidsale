import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../lib/auth";
import { COLORS } from "../lib/format";

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerTintColor: COLORS.brandDark, headerTransparent: false, contentStyle: { backgroundColor: COLORS.bg } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="listing/[id]" options={{ title: "Ad details" }} />
          <Stack.Screen name="chat/[id]" options={{ title: "Chat" }} />
          <Stack.Screen name="search" options={{ title: "Search" }} />
          <Stack.Screen name="login" options={{ title: "Log in", presentation: "modal" }} />
          <Stack.Screen name="register" options={{ title: "Create account" }} />
          <Stack.Screen name="verify" options={{ title: "Verify" }} />
          <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
