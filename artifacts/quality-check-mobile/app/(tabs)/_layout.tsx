import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs, Redirect } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

// Manager tab set: Inspect, SPC, History, Export, Profile (5 tabs, Android-safe)
// Inspector tab set: Inspect, History, Audits, Sheets, Profile (5 tabs, Android-safe)
// Users screen is linked from the Profile tab for managers.
// Audits screen is hidden from manager tab bar (managers use web for audit management).

function NativeTabLayout({ isManager }: { isManager: boolean }) {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="inspection">
        <Icon sf={{ default: "checklist", selected: "checklist" }} />
        <Label>Inspect</Label>
      </NativeTabs.Trigger>
      {isManager && (
        <NativeTabs.Trigger name="spc">
          <Icon sf={{ default: "chart.xyaxis.line", selected: "chart.xyaxis.line" }} />
          <Label>SPC</Label>
        </NativeTabs.Trigger>
      )}
      <NativeTabs.Trigger name="history">
        <Icon sf={{ default: "clock", selected: "clock.fill" }} />
        <Label>History</Label>
      </NativeTabs.Trigger>
      {!isManager && (
        <NativeTabs.Trigger name="audits">
          <Icon sf={{ default: "checkmark.circle", selected: "checkmark.circle.fill" }} />
          <Label>Audits</Label>
        </NativeTabs.Trigger>
      )}
      {!isManager && (
        <NativeTabs.Trigger name="checksheets">
          <Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} />
          <Label>Sheets</Label>
        </NativeTabs.Trigger>
      )}
      {isManager && (
        <NativeTabs.Trigger name="export">
          <Icon sf={{ default: "arrow.down.circle", selected: "arrow.down.circle.fill" }} />
          <Label>Export</Label>
        </NativeTabs.Trigger>
      )}
      <NativeTabs.Trigger name="settings">
        <Icon sf={{ default: "person.circle", selected: "person.circle.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout({ isManager }: { isManager: boolean }) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      {/* Inspection — visible to all */}
      <Tabs.Screen
        name="inspection"
        options={{
          title: "Inspect",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="checklist" tintColor={color} size={24} />
            ) : (
              <Feather name="clipboard" size={22} color={color} />
            ),
        }}
      />

      {/* SPC — managers only */}
      <Tabs.Screen
        name="spc"
        options={{
          title: "SPC",
          href: isManager ? undefined : null,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.xyaxis.line" tintColor={color} size={24} />
            ) : (
              <Feather name="bar-chart-2" size={22} color={color} />
            ),
        }}
      />

      {/* History — visible to all */}
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="clock" tintColor={color} size={24} />
            ) : (
              <Feather name="clock" size={22} color={color} />
            ),
        }}
      />

      {/* Audits — inspectors see in tab bar; managers can navigate but it's hidden from their bar */}
      <Tabs.Screen
        name="audits"
        options={{
          title: "Audits",
          href: isManager ? null : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="checkmark.circle" tintColor={color} size={24} />
            ) : (
              <Feather name="check-square" size={22} color={color} />
            ),
        }}
      />

      {/* Check Sheets — inspectors only in tab bar; managers navigate from Profile */}
      <Tabs.Screen
        name="checksheets"
        options={{
          title: "Sheets",
          href: isManager ? null : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="doc.text" tintColor={color} size={24} />
            ) : (
              <Feather name="file-text" size={22} color={color} />
            ),
        }}
      />

      {/* Export — managers only */}
      <Tabs.Screen
        name="export"
        options={{
          title: "Export",
          href: isManager ? undefined : null,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="arrow.down.circle" tintColor={color} size={24} />
            ) : (
              <Feather name="download" size={22} color={color} />
            ),
        }}
      />

      {/* Users — manager only; hidden from tab bar but routable via Profile */}
      <Tabs.Screen
        name="users"
        options={{
          title: "Users",
          href: null, // accessible via navigation from settings, not in tab bar
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.2" tintColor={color} size={24} />
            ) : (
              <Feather name="users" size={22} color={color} />
            ),
        }}
      />

      {/* Profile/Settings — visible to all */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.circle" tintColor={color} size={24} />
            ) : (
              <Feather name="user" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const isManager = user.role === "manager";

  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout isManager={isManager} />;
  }
  return <ClassicTabLayout isManager={isManager} />;
}
