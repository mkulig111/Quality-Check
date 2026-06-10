import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

interface AppUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: "manager" | "inspector";
  createdAt?: string;
}

export default function UsersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user: me } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isManager = me?.role === "manager";

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await api.get<AppUser[]>("/api/users");
      setUsers(data);
    } catch {
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleRole = useCallback(async (u: AppUser) => {
    if (!isManager) return;
    const newRole = u.role === "manager" ? "inspector" : "manager";
    Alert.alert(
      "Change role",
      `Set ${u.firstName ?? u.email} to ${newRole}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "default",
          onPress: async () => {
            setUpdatingId(u.id);
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              await api.patch(`/api/users/${u.id}/role`, { role: newRole });
              setUsers(prev =>
                prev.map(x => (x.id === u.id ? { ...x, role: newRole } : x))
              );
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              Alert.alert("Failed", err.message ?? "Could not update role");
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  }, [isManager]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0) + 80;

  if (!isManager) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Users</Text>
        </View>
        <View style={styles.center}>
          <Feather name="lock" size={40} color={colors.mutedForeground} />
          <Text style={[styles.lockText, { color: colors.mutedForeground }]}>Manager access only</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Users</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {users.length} account{users.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad, gap: 10 }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => { setIsRefreshing(true); load(true); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No users found</Text>
            </View>
          }
          renderItem={({ item: u }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardLeft}>
                <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {(u.firstName?.[0] ?? u.email[0]).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}
                  </Text>
                  <Text style={[styles.email, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {u.email}
                  </Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.roleBadge,
                  {
                    backgroundColor: u.role === "manager" ? colors.primary : colors.muted,
                    opacity: pressed || updatingId === u.id ? 0.7 : 1,
                  },
                ]}
                onPress={() => toggleRole(u)}
                disabled={updatingId === u.id || u.id === me?.id}
              >
                {updatingId === u.id ? (
                  <ActivityIndicator size="small" color={u.role === "manager" ? "#fff" : colors.mutedForeground} />
                ) : (
                  <Text style={[styles.roleText, { color: u.role === "manager" ? "#fff" : colors.mutedForeground }]}>
                    {u.role}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  lockText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  cardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  email: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  roleText: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
});
