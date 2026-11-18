import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useAuth } from "../../lib/auth";
import { COLORS } from "../../lib/format";

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  const { unread } = useAuth();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: COLORS.brand, headerTintColor: COLORS.brandDark }}>
      <Tabs.Screen name="index" options={{ title: "Home", headerTitle: "RapidSale", tabBarIcon: icon("🏠") }} />
      <Tabs.Screen
        name="chats"
        options={{ title: "Chats", tabBarIcon: icon("💬"), tabBarBadge: unread > 0 ? unread : undefined }}
      />
      <Tabs.Screen name="sell" options={{ title: "Sell", tabBarIcon: icon("➕") }} />
      <Tabs.Screen name="my-ads" options={{ title: "My Ads", tabBarIcon: icon("📋") }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: icon("👤") }} />
    </Tabs>
  );
}
