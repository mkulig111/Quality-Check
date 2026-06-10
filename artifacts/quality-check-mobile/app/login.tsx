import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useAuth } from "@/lib/auth";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const { user, isLoading, signIn } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)/inspection" />;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
        },
      ]}
    >
      <View style={styles.hero}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary }]}>
          <Feather name="check-circle" size={40} color="#fff" />
        </View>
        <Text style={[styles.appName, { color: colors.foreground }]}>Quality Check</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Manufacturing inspection, simplified.
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.signInBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={signIn}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Replit"
        >
          <Feather name="log-in" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.signInText}>Sign in with Replit</Text>
        </Pressable>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Use your Replit account to access your workspace.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "space-between",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  appName: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  footer: {
    paddingBottom: 32,
    gap: 12,
    alignItems: "center",
  },
  signInBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
  },
  signInText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  hint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
