import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
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

const DEPARTMENTS = ["Stamping", "Injection", "Assembly", "Extrusion"];
const MACHINES: Record<string, string[]> = {
  Injection: Array.from({ length: 15 }, (_, i) => `MC${i + 1}`),
  Stamping: ["TR1", "TR2", "TR3", "TR4", "H1", "H2", "H3"],
  Extrusion: ["EXT1"],
  Assembly: ["Compbase", "Bottom Plate", "Plate Rear", "Reinforce 1", "Renforce 2", "Duct Connector", "Dispenser Welding"],
};

type Step = "department" | "machine" | "checksheet" | "form";

export default function InspectionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("department");
  const [allSheets, setAllSheets] = useState<Checksheet[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  const [department, setDepartment] = useState("");
  const [machine, setMachine] = useState("");
  const [selectedSheet, setSelectedSheet] = useState<Checksheet | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get<Checksheet[]>("/api/checksheets")
      .then(setAllSheets)
      .catch(() => {})
      .finally(() => setIsFetching(false));
  }, []);

  const machineSheets = allSheets.filter(
    s => s.department === department && s.machine === machine
  );

  const reset = () => {
    setStep("department");
    setDepartment("");
    setMachine("");
    setSelectedSheet(null);
    setFormValues({});
  };

  const handleSubmit = useCallback(async () => {
    if (!selectedSheet) return;
    setIsSubmitting(true);
    try {
      const measurements: Record<string, number | string | boolean> = {};
      const issues: string[] = [];

      for (const field of selectedSheet.measurementFields) {
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

      await api.post("/api/measurements", {
        checksheetId: selectedSheet.id,
        measurements,
        issues,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Submitted", "Measurement recorded successfully.", [
        { text: "New Entry", onPress: reset },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedSheet, formValues]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 16) + 60;

  if (isFetching) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Inspection</Text>
        {step !== "department" && (
          <Pressable onPress={reset} style={styles.resetBtn}>
            <Feather name="refresh-cw" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: botPad }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {step === "department" && (
          <StepSection title="Select Department" colors={colors}>
            {DEPARTMENTS.map(d => (
              <OptionCard
                key={d}
                label={d}
                onPress={() => { setDepartment(d); setStep("machine"); }}
                colors={colors}
              />
            ))}
          </StepSection>
        )}

        {step === "machine" && (
          <StepSection title={`Machine — ${department}`} colors={colors}>
            {(MACHINES[department] ?? []).map(m => (
              <OptionCard
                key={m}
                label={m}
                onPress={() => { setMachine(m); setStep("checksheet"); }}
                colors={colors}
              />
            ))}
          </StepSection>
        )}

        {step === "checksheet" && (
          <StepSection title={`Check Sheet — ${machine}`} colors={colors}>
            {machineSheets.length === 0 ? (
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>
                No check sheets for this machine.
              </Text>
            ) : (
              machineSheets.map(s => (
                <OptionCard
                  key={s.id}
                  label={s.itemName}
                  onPress={() => {
                    setSelectedSheet(s);
                    const init: Record<string, string | boolean> = {};
                    s.measurementFields.forEach(f => {
                      init[f.fieldName] = f.fieldType === "Boolean" ? false : "";
                    });
                    setFormValues(init);
                    setStep("form");
                  }}
                  colors={colors}
                />
              ))
            )}
          </StepSection>
        )}

        {step === "form" && selectedSheet && (
          <View style={{ gap: 16 }}>
            <View style={[styles.sheetInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sheetName, { color: colors.foreground }]}>{selectedSheet.itemName}</Text>
              <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
                {department} · {machine}
              </Text>
            </View>

            {selectedSheet.measurementFields.map(field => (
              <FieldInput
                key={field.fieldName}
                field={field}
                value={formValues[field.fieldName]}
                onChange={val => setFormValues(prev => ({ ...prev, [field.fieldName]: val }))}
                colors={colors}
              />
            ))}

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                { backgroundColor: colors.primary, opacity: pressed || isSubmitting ? 0.8 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="send" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitText}>Submit Measurement</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StepSection({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.stepTitle, { color: colors.mutedForeground }]}>{title}</Text>
      {children}
    </View>
  );
}

function OptionCard({
  label,
  onPress,
  colors,
}: {
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.optionCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.optionLabel, { color: colors.foreground }]}>{label}</Text>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  resetBtn: { padding: 4 },
  stepTitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionLabel: { fontSize: 16, fontFamily: "Inter_500Medium" },
  empty: { fontSize: 15, fontFamily: "Inter_400Regular", paddingVertical: 8 },
  sheetInfo: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  sheetName: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  sheetSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
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
    marginTop: 8,
  },
  submitText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
