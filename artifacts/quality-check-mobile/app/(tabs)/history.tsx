import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

interface Measurement {
  id: number;
  inspector: string;
  checksheetId: number;
  checksheetName: string;
  department: string;
  machine: string;
  measurements: Record<string, number | string | boolean>;
  issues: string[];
  timestamp: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await api.get<Measurement[]>("/api/measurements?limit=50");
      setMeasurements(data);
    } catch {
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>History</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Recent measurements</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={measurements}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad + 80, gap: 10 }}
          contentInsetAdjustmentBehavior="automatic"
          scrollEnabled={!!measurements.length}
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
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No measurements yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <MeasurementCard item={item} colors={colors} />
          )}
        />
      )}
    </View>
  );
}

function MeasurementCard({
  item,
  colors,
}: {
  item: Measurement;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const hasIssues = item.issues && item.issues.length > 0;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: hasIssues ? colors.destructive : colors.border,
          borderLeftColor: hasIssues ? colors.destructive : colors.primary,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardName, { color: colors.foreground }]}>{item.checksheetName}</Text>
        <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>
          {formatTime(item.timestamp)}
        </Text>
      </View>

      <View style={styles.cardMeta}>
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          {item.department}
        </Text>
        <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>·</Text>
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          {item.machine}
        </Text>
      </View>

      <View style={styles.measurements}>
        {Object.entries(item.measurements).slice(0, 3).map(([k, v]) => (
          <View
            key={k}
            style={[styles.measureBadge, { backgroundColor: colors.muted }]}
          >
            <Text style={[styles.measureKey, { color: colors.mutedForeground }]}>{k}</Text>
            <Text style={[styles.measureVal, { color: colors.foreground }]}>
              {typeof v === "boolean" ? (v ? "Pass" : "Fail") : String(v)}
            </Text>
          </View>
        ))}
        {Object.keys(item.measurements).length > 3 && (
          <View style={[styles.measureBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.measureVal, { color: colors.mutedForeground }]}>
              +{Object.keys(item.measurements).length - 3} more
            </Text>
          </View>
        )}
      </View>

      {hasIssues && (
        <View style={[styles.issueRow, { backgroundColor: "#fef2f2" }]}>
          <Feather name="alert-triangle" size={13} color={colors.destructive} />
          <Text style={[styles.issueText, { color: colors.destructive }]}>
            {item.issues.join(", ")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 14,
    gap: 8,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardName: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1, marginRight: 8 },
  cardTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardMeta: { flexDirection: "row", gap: 4 },
  metaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  metaDot: { fontSize: 13 },
  measurements: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  measureBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  measureKey: { fontSize: 11, fontFamily: "Inter_400Regular" },
  measureVal: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  issueRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 8 },
  issueText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
});
