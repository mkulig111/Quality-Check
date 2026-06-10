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
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
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
}

interface Audit {
  id: number;
  title: string;
  checksheetId: number | null;
  checksheetName: string;
  department: string;
  machine: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  scheduledDate: string;
  recurrence: string;
  status: "pending" | "overdue" | "completed";
  completedAt: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(audit: Audit): boolean {
  return audit.status === "overdue" || (audit.status === "pending" && new Date(audit.scheduledDate) < new Date());
}

type ScreenView = "list" | "form";

export default function AuditsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [audits, setAudits] = useState<Audit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [activeView, setActiveView] = useState<ScreenView>("list");
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [checksheet, setChecksheet] = useState<Checksheet | null>(null);
  const [checksheetLoading, setChecksheetLoading] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAudits = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await api.get<Audit[]>("/api/audits");
      const pending = data.filter(a => a.status !== "completed");
      setAudits(pending);
    } catch {
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAudits(); }, [loadAudits]);

  const openAudit = useCallback(async (audit: Audit) => {
    setSelectedAudit(audit);
    setFormValues({});
    setChecksheet(null);
    setActiveView("form");

    if (audit.checksheetId != null) {
      setChecksheetLoading(true);
      try {
        const sheets = await api.get<Checksheet[]>("/api/checksheets");
        const sheet = sheets.find(s => s.id === audit.checksheetId) ?? null;
        if (sheet) {
          const init: Record<string, string | boolean> = {};
          sheet.measurementFields.forEach(f => {
            init[f.fieldName] = f.fieldType === "Boolean" ? false : "";
          });
          setFormValues(init);
        }
        setChecksheet(sheet);
      } catch {
        setChecksheet(null);
      } finally {
        setChecksheetLoading(false);
      }
    }
  }, []);

  const goBack = useCallback(() => {
    setActiveView("list");
    setSelectedAudit(null);
    setChecksheet(null);
    setFormValues({});
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedAudit) return;
    setIsSubmitting(true);
    try {
      const measurements: Record<string, number | string | boolean> = {};
      const issues: string[] = [];

      if (checksheet) {
        for (const field of checksheet.measurementFields) {
          const raw = formValues[field.fieldName];
          if (field.fieldType === "Numeric") {
            const num = parseFloat(raw as string);
            if (isNaN(num)) {
              Alert.alert("Validation", `"${field.fieldName}" must be a number`);
              setIsSubmitting(false);
              return;
            }
            measurements[field.fieldName] = num;
            if (field.lsl !== undefined && num < field.lsl) issues.push(`${field.fieldName} below LSL`);
            if (field.usl !== undefined && num > field.usl) issues.push(`${field.fieldName} above USL`);
          } else if (field.fieldType === "Boolean") {
            measurements[field.fieldName] = raw === true || raw === "true";
          } else {
            measurements[field.fieldName] = (raw as string) ?? "";
          }
        }
      }

      await api.post(`/api/audits/${selectedAudit.id}/complete`, { measurements, issues });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Completed", "Audit submitted successfully.", [
        { text: "OK", onPress: () => { goBack(); loadAudits(true); } },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to submit audit");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedAudit, checksheet, formValues, goBack, loadAudits]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 16) + 60;

  if (activeView === "form" && selectedAudit) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={goBack} style={styles.backBtn} hitSlop={8}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
              {selectedAudit.title}
            </Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {selectedAudit.department}{selectedAudit.machine ? ` · ${selectedAudit.machine}` : ""}
            </Text>
          </View>
        </View>

        {checksheetLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: botPad }}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.auditInfoCard, {
              backgroundColor: isOverdue(selectedAudit) ? "#fef2f2" : colors.card,
              borderColor: isOverdue(selectedAudit) ? colors.destructive : colors.border,
            }]}>
              <View style={styles.auditInfoRow}>
                <Feather
                  name="calendar"
                  size={14}
                  color={isOverdue(selectedAudit) ? colors.destructive : colors.mutedForeground}
                />
                <Text style={[
                  styles.auditInfoText,
                  { color: isOverdue(selectedAudit) ? colors.destructive : colors.mutedForeground },
                ]}>
                  Due {formatDate(selectedAudit.scheduledDate)}
                  {isOverdue(selectedAudit) ? " — Overdue" : ""}
                </Text>
              </View>
              <Text style={[styles.auditSheetName, { color: colors.foreground }]}>
                {selectedAudit.checksheetName}
              </Text>
            </View>

            {checksheet && checksheet.measurementFields.length > 0 ? (
              <View style={{ gap: 12, marginTop: 16 }}>
                {checksheet.measurementFields.map(field => (
                  <FieldInput
                    key={field.fieldName}
                    field={field}
                    value={formValues[field.fieldName]}
                    onChange={val => setFormValues(prev => ({ ...prev, [field.fieldName]: val }))}
                    colors={colors}
                  />
                ))}
              </View>
            ) : !checksheetLoading && (
              <View style={[styles.noSheetCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="info" size={16} color={colors.mutedForeground} />
                <Text style={[styles.noSheetText, { color: colors.mutedForeground }]}>
                  No measurement fields defined for this audit.
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                { backgroundColor: colors.primary, opacity: pressed || isSubmitting ? 0.8 : 1, marginTop: 24 },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="check-circle" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitText}>Complete Audit</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Audits</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Pending assignments
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={audits}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad, gap: 10 }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => { setIsRefreshing(true); loadAudits(true); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="check-square" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pending audits</Text>
              <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>
                Pull to refresh
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <AuditCard audit={item} onPress={() => openAudit(item)} colors={colors} />
          )}
        />
      )}
    </View>
  );
}

function AuditCard({
  audit,
  onPress,
  colors,
}: {
  audit: Audit;
  onPress: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const overdue = isOverdue(audit);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: overdue ? "#fef2f2" : colors.card,
          borderColor: overdue ? colors.destructive : colors.border,
          borderLeftColor: overdue ? colors.destructive : colors.primary,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
            {audit.title}
          </Text>
          <Text style={[styles.cardSheet, { color: colors.mutedForeground }]} numberOfLines={1}>
            {audit.checksheetName}
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: overdue ? colors.destructive : colors.muted },
        ]}>
          <Text style={[styles.statusText, { color: overdue ? "#fff" : colors.mutedForeground }]}>
            {overdue ? "Overdue" : "Pending"}
          </Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        <Feather name="map-pin" size={12} color={colors.mutedForeground} />
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          {audit.department}{audit.machine ? ` · ${audit.machine}` : ""}
        </Text>
        <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>·</Text>
        <Feather name="calendar" size={12} color={overdue ? colors.destructive : colors.mutedForeground} />
        <Text style={[styles.metaText, { color: overdue ? colors.destructive : colors.mutedForeground }]}>
          {formatDate(audit.scheduledDate)}
        </Text>
      </View>

      {audit.recurrence !== "none" && (
        <View style={[styles.recurrenceBadge, { backgroundColor: colors.muted }]}>
          <Feather name="repeat" size={10} color={colors.mutedForeground} />
          <Text style={[styles.recurrenceText, { color: colors.mutedForeground }]}>
            {audit.recurrence}
          </Text>
        </View>
      )}

      <View style={styles.tapHint}>
        <Text style={[styles.tapHintText, { color: overdue ? colors.destructive : colors.primary }]}>
          Tap to complete
        </Text>
        <Feather name="chevron-right" size={14} color={overdue ? colors.destructive : colors.primary} />
      </View>
    </Pressable>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  colors,
}: {
  field: MeasurementField;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const label = field.unit ? `${field.fieldName} (${field.unit})` : field.fieldName;
  const hint =
    field.lsl !== undefined && field.usl !== undefined
      ? `LSL: ${field.lsl}  USL: ${field.usl}`
      : field.lsl !== undefined
      ? `LSL: ${field.lsl}`
      : field.usl !== undefined
      ? `USL: ${field.usl}`
      : null;

  return (
    <View style={[styles.fieldCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      {hint && <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>{hint}</Text>}

      {field.fieldType === "Boolean" ? (
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: value ? colors.primary : colors.mutedForeground }]}>
            {value ? "Pass" : "Fail"}
          </Text>
          <Switch
            value={!!value}
            onValueChange={onChange}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      ) : (
        <TextInput
          style={[styles.textInput, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.background }]}
          value={value as string}
          onChangeText={onChange}
          keyboardType={field.fieldType === "Numeric" ? "decimal-pad" : "default"}
          placeholder={field.fieldType === "Numeric" ? "0.00" : "Enter value"}
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="done"
        />
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
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  emptySubText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 14,
    gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardSheet: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardMeta: { flexDirection: "row", gap: 4, alignItems: "center" },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  metaDot: { fontSize: 12 },
  recurrenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recurrenceText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  tapHintText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  auditInfoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  auditInfoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  auditInfoText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  auditSheetName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  noSheetCard: {
    marginTop: 16,
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noSheetText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  fieldCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  fieldLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  fieldHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  switchLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 14,
  },
  submitText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  header2: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
});
