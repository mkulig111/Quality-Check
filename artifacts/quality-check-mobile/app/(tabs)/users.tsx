import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  username: string | null;
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: "manager" | "inspector";
  createdAt?: string;
}

interface CreateForm {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "inspector" | "manager";
}

const emptyForm: CreateForm = {
  username: "",
  password: "",
  firstName: "",
  lastName: "",
  role: "inspector",
};

export default function UsersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user: me } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, [load]);

  const toggleRole = useCallback(
    async (u: AppUser) => {
      if (!isManager) return;
      const newRole = u.role === "manager" ? "inspector" : "manager";
      const name = u.firstName ?? u.username ?? u.email ?? "user";
      Alert.alert("Change role", `Set ${name} to ${newRole}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "default",
          onPress: async () => {
            setUpdatingId(u.id);
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              await api.patch(`/api/users/${u.id}/role`, { role: newRole });
              setUsers((prev) =>
                prev.map((x) => (x.id === u.id ? { ...x, role: newRole } : x)),
              );
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            } catch (err: any) {
              Alert.alert("Failed", err.message ?? "Could not update role");
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]);
    },
    [isManager],
  );

  const handleDelete = useCallback(
    (u: AppUser) => {
      if (!isManager) return;
      const name = u.firstName ?? u.username ?? u.email ?? "this user";
      Alert.alert("Delete user", `Remove ${name}? This cannot be undone.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/users/${u.id}`);
              setUsers((prev) => prev.filter((x) => x.id !== u.id));
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            } catch (err: any) {
              Alert.alert("Failed", err.message ?? "Could not delete user");
            }
          },
        },
      ]);
    },
    [isManager],
  );

  const handleCreate = async () => {
    if (!form.username.trim() || !form.password) {
      setCreateError("Username and password are required.");
      return;
    }
    setCreateError(null);
    setIsCreating(true);
    try {
      const newUser = await api.post<AppUser>("/api/users", {
        username: form.username.trim(),
        password: form.password,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        role: form.role,
      });
      setUsers((prev) => [...prev, newUser]);
      setForm(emptyForm);
      setShowCreate(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setCreateError(err.message ?? "Could not create user.");
    } finally {
      setIsCreating(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0) + 80;

  if (!isManager) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: topPad,
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Users
          </Text>
        </View>
        <View style={styles.center}>
          <Feather name="lock" size={40} color={colors.mutedForeground} />
          <Text style={[styles.lockText, { color: colors.mutedForeground }]}>
            Manager access only
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Users
            </Text>
            <Text
              style={[styles.headerSub, { color: colors.mutedForeground }]}
            >
              {users.length} account{users.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => {
              setShowCreate((v) => !v);
              setCreateError(null);
            }}
          >
            <Feather
              name={showCreate ? "x" : "user-plus"}
              size={18}
              color="#fff"
            />
            <Text style={styles.addBtnText}>
              {showCreate ? "Cancel" : "Add User"}
            </Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad, gap: 10 }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                load(true);
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            showCreate ? (
              <View
                style={[
                  styles.createCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.createTitle, { color: colors.foreground }]}
                >
                  New User
                </Text>

                {createError && (
                  <Text style={[styles.createError, { color: colors.destructive }]}>
                    {createError}
                  </Text>
                )}

                <View style={styles.createRow}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                      First name
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                      ]}
                      value={form.firstName}
                      onChangeText={(v) => setForm((f) => ({ ...f, firstName: v }))}
                      placeholder="Jan"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                      Last name
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                      ]}
                      value={form.lastName}
                      onChangeText={(v) => setForm((f) => ({ ...f, lastName: v }))}
                      placeholder="Kowalski"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                    Username *
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                    ]}
                    value={form.username}
                    onChangeText={(v) => setForm((f) => ({ ...f, username: v }))}
                    placeholder="jan.kowalski"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                    Password *
                  </Text>
                  <View style={styles.passwordWrap}>
                    <TextInput
                      style={[
                        styles.textInput,
                        styles.passwordInput,
                        { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                      ]}
                      value={form.password}
                      onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                      placeholder="••••••••"
                      placeholderTextColor={colors.mutedForeground}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword((v) => !v)}
                      hitSlop={8}
                    >
                      <Feather
                        name={showPassword ? "eye-off" : "eye"}
                        size={16}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                    Role
                  </Text>
                  <View style={styles.roleToggle}>
                    {(["inspector", "manager"] as const).map((r) => (
                      <Pressable
                        key={r}
                        style={({ pressed }) => [
                          styles.roleOption,
                          {
                            backgroundColor:
                              form.role === r ? colors.primary : colors.background,
                            borderColor: colors.border,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                        onPress={() => setForm((f) => ({ ...f, role: r }))}
                      >
                        <Text
                          style={[
                            styles.roleOptionText,
                            { color: form.role === r ? "#fff" : colors.foreground },
                          ]}
                        >
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.createBtn,
                    { backgroundColor: colors.primary, opacity: pressed || isCreating ? 0.8 : 1 },
                  ]}
                  onPress={handleCreate}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Feather name="user-plus" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.createBtnText}>Create User</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !showCreate ? (
              <View style={styles.empty}>
                <Feather name="users" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No users yet. Tap "Add User" to create one.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item: u }) => (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.cardLeft}>
                <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {(u.firstName?.[0] ?? u.username?.[0] ?? "?").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.name, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") ||
                      u.username ||
                      "Unknown"}
                  </Text>
                  <Text
                    style={[styles.usernameText, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    @{u.username ?? "—"}
                  </Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.roleBadge,
                    {
                      backgroundColor:
                        u.role === "manager" ? colors.primary : colors.muted,
                      opacity: pressed || updatingId === u.id ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => toggleRole(u)}
                  disabled={updatingId === u.id || u.id === me?.id}
                >
                  {updatingId === u.id ? (
                    <ActivityIndicator
                      size="small"
                      color={u.role === "manager" ? "#fff" : colors.mutedForeground}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.roleText,
                        {
                          color:
                            u.role === "manager" ? "#fff" : colors.mutedForeground,
                        },
                      ]}
                    >
                      {u.role}
                    </Text>
                  )}
                </Pressable>
                {u.id !== me?.id && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteBtn,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                    onPress={() => handleDelete(u)}
                    hitSlop={8}
                  >
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </Pressable>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  lockText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  createCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 10,
  },
  createTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  createError: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  createRow: {
    flexDirection: "row",
    gap: 10,
  },
  field: { gap: 4 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 40 },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: [{ translateY: -8 }],
  },
  roleToggle: {
    flexDirection: "row",
    gap: 8,
  },
  roleOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  roleOptionText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
    minHeight: 44,
  },
  createBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  cardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  usernameText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 76,
    alignItems: "center",
  },
  roleText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  deleteBtn: {
    padding: 4,
  },
});
