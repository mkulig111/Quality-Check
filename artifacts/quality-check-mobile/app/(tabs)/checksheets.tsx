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

interface MeasurementField {
  fieldName: string;
  fieldType: "Numeric" | "Boolean" | "Text";
  unit?: string;
  lsl?: number;
  usl?: number;
}

interface Checksheet {
  id: number;
  itemName: string;
  department: string;
  machine: string;
  measurementFields: MeasurementField[];
  isSpcCharacteristic?: boolean;
}

export default function ChecksheetsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [checksheets, setChecksheets] = useState<Checksheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await api.get<Checksheet[]>("/api/checksheets");
      setChecksheets(data);
    } catch {
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = checksheets.reduce<Record<string, Checksheet[]>>((acc, sheet) => {
    const key = sheet.department;
    if (!acc[key]) acc[key] = [];
    acc[key].push(sheet);
    return acc;
  }, {});

  const sections = Object.entries(grouped).map(([dept, sheets]) => ({ dept, sheets }));

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0) + 80;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Check Sheets</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {checksheets.length} item{checksheets.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={item => item.dept}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad, gap: 16 }}
          contentInsetAdjustmentBehavior="automatic"
          scrollEnabled={!!sections.length}
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
              <Feather name="file-text" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No check sheets defined</Text>
            </View>
          }
          renderItem={({ item: { dept, sheets } }) => (
            <View style={{ gap: 8 }}>
              <Text style={[styles.deptLabel, { color: colors.mutedForeground }]}>
                {dept.toUpperCase()}
              </Text>
              {sheets.map(sheet => (
                <SheetCard key={sheet.id} sheet={sheet} colors={colors} />
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

function SheetCard({
  sheet,
  colors,
}: {
  sheet: Checksheet;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardName, { color: colors.foreground }]}>{sheet.itemName}</Text>
        {sheet.isSpcCharacteristic && (
          <View style={[styles.spcBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.spcText}>SPC</Text>
          </View>
        )}
      </View>
      <Text style={[styles.machineName, { color: colors.mutedForeground }]}>{sheet.machine}</Text>
      <View style={styles.fields}>
        {sheet.measurementFields.map(f => (
          <View key={f.fieldName} style={[styles.fieldChip, { backgroundColor: colors.muted }]}>
            <Text style={[styles.fieldChipText, { color: colors.mutedForeground }]}>
              {f.fieldName}
              {f.unit ? ` (${f.unit})` : ""}
              {" · "}
              {f.fieldType}
            </Text>
          </View>
        ))}
      </View>
      {sheet.measurementFields.some(f => f.lsl !== undefined || f.usl !== undefined) && (
        <View style={styles.limits}>
          {sheet.measurementFields
            .filter(f => f.lsl !== undefined || f.usl !== undefined)
            .map(f => (
              <Text key={f.fieldName} style={[styles.limitText, { color: colors.mutedForeground }]}>
                {f.fieldName}:{" "}
                {f.lsl !== undefined ? `LSL ${f.lsl}` : ""}
                {f.lsl !== undefined && f.usl !== undefined ? "  " : ""}
                {f.usl !== undefined ? `USL ${f.usl}` : ""}
              </Text>
            ))}
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
  deptLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardName: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  spcBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  spcText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  machineName: { fontSize: 13, fontFamily: "Inter_400Regular" },
  fields: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  fieldChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  fieldChipText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  limits: { gap: 2, marginTop: 2 },
  limitText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
