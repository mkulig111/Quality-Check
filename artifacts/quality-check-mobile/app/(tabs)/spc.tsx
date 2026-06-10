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
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

interface MeasurementField {
  fieldName: string;
  fieldType: string;
  isSpecialCharacteristic?: boolean;
  lsl?: number;
  usl?: number;
}

interface Checksheet {
  id: number;
  itemName: string;
  department: string;
  measurementFields: MeasurementField[];
}

interface Measurement {
  id: number;
  checksheetName: string;
  department: string;
  measurements: Record<string, unknown>;
  timestamp: string;
}

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

const D2_5 = 2.326;

function getMean(data: number[]) {
  if (data.length === 0) return 0;
  return data.reduce((a, b) => a + b, 0) / data.length;
}

function getStdDev(data: number[]) {
  if (data.length < 2) return 0;
  const m = getMean(data);
  return Math.sqrt(data.reduce((s, x) => s + (x - m) ** 2, 0) / (data.length - 1));
}

function computeSpc(values: number[], lsl?: number, usl?: number): SpcResult["cp"] extends undefined ? Partial<SpcResult> : Partial<SpcResult> {
  const n = values.length;
  if (n < 5) return {};
  const mean = getMean(values);
  const stddev = getStdDev(values);
  if (stddev === 0) return { n, mean, stddev };

  const subSize = 5;
  const subgroups: number[][] = [];
  for (let i = 0; i + subSize <= n; i += subSize) subgroups.push(values.slice(i, i + subSize));
  const subRanges = subgroups.map(sg => Math.max(...sg) - Math.min(...sg));
  const avgRange = getMean(subRanges);
  const withinStdDev = avgRange > 0 ? avgRange / D2_5 : stddev;

  let cp: number | undefined;
  let cpk: number | undefined;
  let pp: number | undefined;
  let ppk: number | undefined;
  let ppm: number | undefined;

  if (lsl !== undefined && usl !== undefined) {
    cp = withinStdDev > 0 ? (usl - lsl) / (6 * withinStdDev) : undefined;
    pp = stddev > 0 ? (usl - lsl) / (6 * stddev) : undefined;
  }
  const cpu = usl !== undefined && withinStdDev > 0 ? (usl - mean) / (3 * withinStdDev) : Infinity;
  const cpl = lsl !== undefined && withinStdDev > 0 ? (mean - lsl) / (3 * withinStdDev) : Infinity;
  if (isFinite(cpu) || isFinite(cpl)) {
    cpk = Math.min(isFinite(cpu) ? cpu : Infinity, isFinite(cpl) ? cpl : Infinity);
    if (!isFinite(cpk)) cpk = undefined;
  }
  const ppu = usl !== undefined && stddev > 0 ? (usl - mean) / (3 * stddev) : Infinity;
  const ppl = lsl !== undefined && stddev > 0 ? (mean - lsl) / (3 * stddev) : Infinity;
  if (isFinite(ppu) || isFinite(ppl)) {
    ppk = Math.min(isFinite(ppu) ? ppu : Infinity, isFinite(ppl) ? ppl : Infinity);
    if (!isFinite(ppk)) ppk = undefined;
  }
  if (ppk !== undefined && ppk > 0) {
    ppm = (1 - (0.5 * (1 + Math.sign(ppk)) - 0.5 * Math.sign(ppk) * (1 - Math.exp(-((ppk * Math.sqrt(2)) ** 2))))) * 2 * 1_000_000;
    ppm = Math.round(ppm);
  }

  return { n, mean, stddev, cp, cpk, pp, ppk, ppm };
}

function cpkColor(cpk: number | undefined, primary: string) {
  if (cpk === undefined) return "#888";
  if (cpk >= 1.67) return "#16a34a";
  if (cpk >= 1.33) return "#2563eb";
  if (cpk >= 1.0) return "#d97706";
  return "#dc2626";
}

function StatBox({ label, value, color, bgColor }: { label: string; value: string; color?: string; bgColor: string }) {
  return (
    <View style={[statStyles.box, { backgroundColor: bgColor }]}>
      <Text style={[statStyles.val, { color: color ?? "#111" }]}>{value}</Text>
      <Text style={[statStyles.lbl, { color: "#888" }]}>{label}</Text>
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
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const isManager = user?.role === "manager";

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const checksheets = await api.get<Checksheet[]>("/api/checksheets");

      const spcEntries: Array<{
        checksheetName: string;
        department: string;
        fieldName: string;
        lsl?: number;
        usl?: number;
      }> = [];

      for (const cs of checksheets) {
        if (!cs.measurementFields) continue;
        for (const field of cs.measurementFields) {
          if (field.isSpecialCharacteristic && field.fieldType === "Numeric") {
            spcEntries.push({
              checksheetName: cs.itemName,
              department: cs.department,
              fieldName: field.fieldName,
              lsl: field.lsl,
              usl: field.usl,
            });
          }
        }
      }

      const computed: SpcResult[] = [];
      for (const entry of spcEntries) {
        try {
          const measurements = await api.get<Measurement[]>(
            `/api/measurements?checksheetName=${encodeURIComponent(entry.checksheetName)}&department=${encodeURIComponent(entry.department)}&limit=200`
          );
          const values: number[] = [];
          for (const m of measurements) {
            const raw = m.measurements?.[entry.fieldName];
            if (raw !== undefined && raw !== null && !isNaN(Number(raw))) {
              values.push(Number(raw));
            }
          }
          if (values.length < 5) continue;
          const stats = computeSpc(values, entry.lsl, entry.usl);
          computed.push({
            checksheetName: entry.checksheetName,
            fieldName: entry.fieldName,
            department: entry.department,
            lsl: entry.lsl,
            usl: entry.usl,
            n: stats.n ?? values.length,
            mean: stats.mean ?? getMean(values),
            stddev: stats.stddev ?? getStdDev(values),
            cp: stats.cp,
            cpk: stats.cpk,
            pp: stats.pp,
            ppk: stats.ppk,
            ppm: stats.ppm,
          });
        } catch {
          // skip this entry
        }
      }

      setResults(computed);
      setLoadedAt(new Date());
    } catch {
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
        {loadedAt && (
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Updated {loadedAt.toLocaleTimeString()}
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
                Submit at least 5 measurements for a field marked as Special Characteristic to see capability indices.
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
                  <View style={[styles.cpkBadge, { backgroundColor: cpkColor(r.cpk, colors.primary) }]}>
                    <Text style={styles.cpkBadgeText}>Cpk {r.cpk.toFixed(2)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.statsRow}>
                {r.cp !== undefined && (
                  <StatBox label="Cp" value={r.cp.toFixed(2)} bgColor={colors.muted} color={colors.foreground} />
                )}
                {r.cpk !== undefined && (
                  <StatBox label="Cpk" value={r.cpk.toFixed(2)} color={cpkColor(r.cpk, colors.primary)} bgColor={colors.muted} />
                )}
                {r.pp !== undefined && (
                  <StatBox label="Pp" value={r.pp.toFixed(2)} bgColor={colors.muted} color={colors.foreground} />
                )}
                {r.ppk !== undefined && (
                  <StatBox label="Ppk" value={r.ppk.toFixed(2)} bgColor={colors.muted} color={colors.foreground} />
                )}
              </View>

              {r.ppm !== undefined && (
                <View style={styles.ppmRow}>
                  <Text style={[styles.ppmLabel, { color: colors.mutedForeground }]}>Estimated PPM out of spec: </Text>
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
                  {`  mean ${r.mean.toFixed(3)}`}
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
