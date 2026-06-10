import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

interface SpcResult {
  checksheetName: string;
  fieldName: string;
  department: string;
  n: number;
  mean: number;
  stddev: number;
  cp?: number;
  cpk?: number;
  pp?: number;
  ppk?: number;
  ppm?: number;
  lsl?: number;
  usl?: number;
}

interface SpcSummaryResponse {
  results: SpcResult[];
  generatedAt?: string;
}

function cpkColor(cpk: number | undefined, colors: ReturnType<typeof import("@/hooks/useColors").useColors>) {
  if (cpk === undefined) return colors.mutedForeground;
  if (cpk >= 1.67) return "#16a34a"; // green
  if (cpk >= 1.33) return "#2563eb"; // blue
  if (cpk >= 1.0) return "#d97706";  // amber
  return "#dc2626";                    // red
}

function StatBox({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string;
  color?: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[statStyles.box, { backgroundColor: colors.muted }]}>
      <Text style={[statStyles.val, { color: color ?? colors.foreground }]}>{value}</Text>
      <Text style={[statStyles.lbl, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  box: { flex: 1, borderRadius: 8, padding: 10, alignItems: "center", gap: 2 },
  val: { fontSize: 16, fontFamily: "Inter_700Bold" },
  lbl: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

export default function SpcScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [results, setResults] = useState<SpcResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const isManager = user?.role === "manager";

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await api.get<SpcSummaryResponse>("/api/spc/summary");
      setResults(data.results ?? []);
      setGeneratedAt(data.generatedAt ?? null);
    } catch {
      // Endpoint may not exist — show empty state gracefully
      setResults([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0) + 80;

  if (!isManager) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>SPC Analysis</Text>
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>SPC Analysis</Text>
        {generatedAt && (
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Updated {new Date(generatedAt).toLocaleDateString()}
          </Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r, i) => `${r.checksheetName}-${r.fieldName}-${i}`}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad, gap: 12 }}
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
              <Feather name="bar-chart-2" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No SPC data</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Submit measurements with SPC characteristics to see capability indices here.
              </Text>
            </View>
          }
          renderItem={({ item: r }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
                    {r.checksheetName}
                  </Text>
                  <Text style={[styles.cardField, { color: colors.mutedForeground }]}>
                    {r.fieldName} · {r.department} · n={r.n}
                  </Text>
                </View>
                {r.cpk !== undefined && (
                  <View style={[styles.cpkBadge, { backgroundColor: cpkColor(r.cpk, colors) }]}>
                    <Text style={styles.cpkBadgeText}>
                      Cpk {r.cpk.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.statsRow}>
                {r.cp !== undefined && (
                  <StatBox label="Cp" value={r.cp.toFixed(2)} colors={colors} />
                )}
                {r.cpk !== undefined && (
                  <StatBox label="Cpk" value={r.cpk.toFixed(2)} color={cpkColor(r.cpk, colors)} colors={colors} />
                )}
                {r.pp !== undefined && (
                  <StatBox label="Pp" value={r.pp.toFixed(2)} colors={colors} />
                )}
                {r.ppk !== undefined && (
                  <StatBox label="Ppk" value={r.ppk.toFixed(2)} colors={colors} />
                )}
              </View>

              {r.ppm !== undefined && (
                <View style={styles.ppmRow}>
                  <Text style={[styles.ppmLabel, { color: colors.mutedForeground }]}>
                    Estimated PPM out of spec:{" "}
                  </Text>
                  <Text style={[styles.ppmValue, { color: r.ppm > 6210 ? "#dc2626" : colors.foreground }]}>
                    {r.ppm.toLocaleString()}
                  </Text>
                </View>
              )}

              {(r.lsl !== undefined || r.usl !== undefined) && (
                <Text style={[styles.limits, { color: colors.mutedForeground }]}>
                  {r.lsl !== undefined ? `LSL ${r.lsl}` : ""}
                  {r.lsl !== undefined && r.usl !== undefined ? "  " : ""}
                  {r.usl !== undefined ? `USL ${r.usl}` : ""}
                  {r.mean !== undefined ? `  mean ${r.mean.toFixed(3)}` : ""}
                </Text>
              )}
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
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardField: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cpkBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cpkBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  statsRow: { flexDirection: "row", gap: 8 },
  ppmRow: { flexDirection: "row", flexWrap: "wrap" },
  ppmLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  ppmValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  limits: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
