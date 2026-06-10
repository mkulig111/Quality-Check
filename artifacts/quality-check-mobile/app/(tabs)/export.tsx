import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
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

const DEPARTMENTS = ["Stamping", "Injection", "Assembly", "Extrusion"];

type DateRange = "today" | "yesterday" | "week" | "month";

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Last 7 days",
  month: "Last 30 days",
};

function getDateRange(range: DateRange): { startDate: string; endDate: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (range) {
    case "today":
      return { startDate: fmt(now), endDate: fmt(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { startDate: fmt(y), endDate: fmt(y) };
    }
    case "week": {
      const w = new Date(now);
      w.setDate(w.getDate() - 6);
      return { startDate: fmt(w), endDate: fmt(now) };
    }
    case "month": {
      const m = new Date(now);
      m.setDate(m.getDate() - 29);
      return { startDate: fmt(m), endDate: fmt(now) };
    }
  }
}

export default function ExportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set(DEPARTMENTS));
  const [dateRange, setDateRange] = useState<DateRange>("week");
  const [isExporting, setIsExporting] = useState(false);
  const [isRunningDaily, setIsRunningDaily] = useState(false);

  const isManager = user?.role === "manager";

  const toggleDept = (dept: string) => {
    setSelectedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) { next.delete(dept); } else { next.add(dept); }
      return next;
    });
  };

  const handleExport = async () => {
    if (selectedDepts.size === 0) {
      Alert.alert("Select department", "Choose at least one department to export.");
      return;
    }
    setIsExporting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { startDate, endDate } = getDateRange(dateRange);
      const result = await api.post<{
        count: number;
        departments: string[];
        message: string;
      }>("/api/export/generate", {
        departments: Array.from(selectedDepts),
        startDate,
        endDate,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Export Ready",
        `${result.count ?? 0} records exported for ${DATE_RANGE_LABELS[dateRange]}.`,
      );
    } catch (err: any) {
      Alert.alert("Export failed", err.message ?? "Unknown error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDailyExport = async () => {
    setIsRunningDaily(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await api.post<{ results: { department: string; status: string }[] }>(
        "/api/export/daily",
        {}
      );
      const summary = (result.results ?? [])
        .map(r => `${r.department}: ${r.status}`)
        .join("\n");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Daily Export Complete", summary || "Done");
    } catch (err: any) {
      Alert.alert("Export failed", err.message ?? "Unknown error");
    } finally {
      setIsRunningDaily(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0) + 80;

  if (!isManager) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Export</Text>
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
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Export</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Download measurement data</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: botPad, gap: 20 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={{ gap: 10 }}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DATE RANGE</Text>
          <View style={styles.rangeGrid}>
            {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map(r => (
              <Pressable
                key={r}
                style={({ pressed }) => [
                  styles.rangeChip,
                  {
                    backgroundColor: dateRange === r ? colors.primary : colors.card,
                    borderColor: dateRange === r ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => setDateRange(r)}
              >
                <Text
                  style={[
                    styles.rangeText,
                    { color: dateRange === r ? "#fff" : colors.foreground },
                  ]}
                >
                  {DATE_RANGE_LABELS[r]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DEPARTMENTS</Text>
          {DEPARTMENTS.map(dept => (
            <Pressable
              key={dept}
              style={({ pressed }) => [
                styles.deptRow,
                {
                  backgroundColor: colors.card,
                  borderColor: selectedDepts.has(dept) ? colors.primary : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={() => toggleDept(dept)}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: selectedDepts.has(dept) ? colors.primary : "transparent",
                    borderColor: selectedDepts.has(dept) ? colors.primary : colors.border,
                  },
                ]}
              >
                {selectedDepts.has(dept) && (
                  <Feather name="check" size={12} color="#fff" />
                )}
              </View>
              <Text style={[styles.deptText, { color: colors.foreground }]}>{dept}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 10 }}>
          <Pressable
            style={({ pressed }) => [
              styles.exportBtn,
              { backgroundColor: colors.primary, opacity: pressed || isExporting ? 0.8 : 1 },
            ]}
            onPress={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="download" size={18} color="#fff" />
                <Text style={styles.exportBtnText}>Generate Export</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.dailyBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed || isRunningDaily ? 0.7 : 1,
              },
            ]}
            onPress={handleDailyExport}
            disabled={isRunningDaily}
          >
            {isRunningDaily ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Feather name="calendar" size={16} color={colors.primary} />
                <Text style={[styles.dailyBtnText, { color: colors.primary }]}>
                  Run Yesterday's Export
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
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
  sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  rangeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  rangeText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  deptRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  deptText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    borderRadius: 14,
  },
  exportBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  dailyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  dailyBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
