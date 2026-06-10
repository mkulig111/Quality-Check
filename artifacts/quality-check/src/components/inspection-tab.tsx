import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import React from "react";
import { Loader2, ChevronsRight, FilePenLine, Trash2, History, Upload, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Papa from "papaparse";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface Checksheet {
  id: number;
  itemName: string;
  department: string;
  machine: string;
  measurementFields: {
    fieldName: string;
    fieldType: "Numeric" | "Boolean" | "Text";
    unit?: string;
    lsl?: number;
    usl?: number;
  }[];
}

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

const machineOptionsByDepartment: Record<string, string[]> = {
  Injection: Array.from({ length: 15 }, (_, i) => `MC${i + 1}`),
  Stamping: ["TR1", "TR2", "TR3", "TR4", "H1", "H2", "H3"],
  Extrusion: ["EXT1"],
  Assembly: ["Compbase", "Bottom Plate", "Plate Rear", "Reinforce 1", "Renforce 2", "Duct Connector", "Dispenser Welding"],
};

const HISTORY_LIMIT = 10;
const POLL_INTERVAL_MS = 10000;

function downloadInspectionTemplate(checksheets: Checksheet[]) {
  if (!checksheets.length) return;
  const sample = checksheets[0];
  const fieldNames = sample.measurementFields.map((f) => f.fieldName);
  const headers = ["checksheet_name", "department", "machine", "timestamp", ...fieldNames];
  const exampleValues = sample.measurementFields.map((f) => {
    if (f.fieldType === "Numeric") return f.lsl !== undefined ? String(f.lsl) : "0";
    if (f.fieldType === "Boolean") return "true";
    return "OK";
  });
  const rows = [
    headers,
    [sample.itemName, sample.department, sample.machine, new Date().toISOString(), ...exampleValues],
  ];
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inspection_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function InspectionTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isManager = user?.role === "manager";

  const [isLoading, setIsLoading] = React.useState(false);
  const [isFetchingChecksheets, setIsFetchingChecksheets] = React.useState(true);
  const [measurementHistory, setMeasurementHistory] = React.useState<Measurement[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(true);
  const [isImporting, setIsImporting] = React.useState(false);

  const importFileRef = React.useRef<HTMLInputElement>(null);

  const [departments] = React.useState(["Stamping", "Injection", "Assembly", "Extrusion"]);
  const [allChecksheets, setAllChecksheets] = React.useState<Checksheet[]>([]);
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>("");
  const [departmentChecksheets, setDepartmentChecksheets] = React.useState<Checksheet[]>([]);
  const [selectedChecksheet, setSelectedChecksheet] = React.useState<Checksheet | null>(null);
  const [editingMeasurement, setEditingMeasurement] = React.useState<Measurement | null>(null);

  const [selectedMachine, setSelectedMachine] = React.useState<string>("");
  const [machineOptions, setMachineOptions] = React.useState<string[]>([]);
  const [machineChecksheets, setMachineChecksheets] = React.useState<Checksheet[]>([]);

  const [dynamicFormSchema, setDynamicFormSchema] = React.useState(z.object({}));
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [formDataForConfirm, setFormDataForConfirm] = React.useState<any>(null);

  const form = useForm<Record<string, any>>({
    resolver: zodResolver(dynamicFormSchema),
    defaultValues: {},
  });

  const fetchAllChecksheets = React.useCallback(async () => {
    setIsFetchingChecksheets(true);
    try {
      const sheets = await api.get<Checksheet[]>("/api/checksheets");
      setAllChecksheets(sheets);
    } catch {
      toast({ title: "Error", description: "Could not fetch check sheets.", variant: "destructive" });
    } finally {
      setIsFetchingChecksheets(false);
    }
  }, [toast]);

  const fetchHistory = React.useCallback(async () => {
    try {
      const data = await api.get<Measurement[]>(`/api/measurements?limit=${HISTORY_LIMIT}`);
      setMeasurementHistory(data);
    } catch {
      // silently fail for polling
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAllChecksheets();
  }, [fetchAllChecksheets]);

  React.useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  const handleDepartmentSelect = (department: string) => {
    setSelectedDepartment(department);
    setSelectedMachine("");
    setMachineOptions(machineOptionsByDepartment[department] || []);
    setMachineChecksheets([]);
    setSelectedChecksheet(null);
    form.reset({});
    const filteredSheets = allChecksheets.filter((sheet) => sheet.department === department);
    setDepartmentChecksheets(filteredSheets);
  };

  const handleMachineSelect = (machine: string) => {
    setSelectedMachine(machine);
    setSelectedChecksheet(null);
    form.reset({});
    const filteredSheets = departmentChecksheets.filter((sheet) => sheet.machine === machine);
    setMachineChecksheets(filteredSheets);
  };

  React.useEffect(() => {
    if (selectedChecksheet) {
      const shape: { [key: string]: any } = {};
      const defaultValues: { [key: string]: any } = {};
      selectedChecksheet.measurementFields.forEach((field) => {
        switch (field.fieldType) {
          case "Numeric":
            shape[field.fieldName] = z.coerce.number();
            defaultValues[field.fieldName] =
              field.lsl !== undefined && field.usl !== undefined
                ? (field.lsl + (field.usl || field.lsl)) / 2
                : 0;
            break;
          case "Boolean":
            shape[field.fieldName] = z.boolean();
            defaultValues[field.fieldName] = false;
            break;
          case "Text":
            shape[field.fieldName] = z.string().min(1, `${field.fieldName} is required.`);
            defaultValues[field.fieldName] = "";
            break;
        }
      });
      setDynamicFormSchema(z.object(shape));
      if (!editingMeasurement) {
        form.reset(defaultValues);
      }
    } else {
      form.reset({});
      setDynamicFormSchema(z.object({}));
    }
  }, [selectedChecksheet, form, editingMeasurement]);

  async function handleOpenConfirm(values: any) {
    if (!selectedChecksheet) return;
    setFormDataForConfirm(values);
    setIsConfirmOpen(true);
  }

  const handleConfirmSubmit = React.useCallback(async () => {
    if (!formDataForConfirm || !selectedChecksheet) return;
    setIsLoading(true);
    setIsConfirmOpen(false);

    try {
      if (editingMeasurement) {
        await api.put(`/api/measurements/${editingMeasurement.id}`, {
          measurements: formDataForConfirm,
          issues: [],
        });
      } else {
        await api.post("/api/measurements", {
          checksheetId: selectedChecksheet.id,
          checksheetName: selectedChecksheet.itemName,
          department: selectedChecksheet.department,
          machine: selectedChecksheet.machine,
          measurements: formDataForConfirm,
          issues: [],
        });
      }
      toast({
        title: editingMeasurement ? "Measurement Updated" : "Measurement Submitted",
        description: "Your measurement has been successfully recorded.",
      });
      await fetchHistory();
      handleCancelEdit();
    } catch {
      toast({ title: "Submission Failed", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setFormDataForConfirm(null);
    }
  }, [formDataForConfirm, editingMeasurement, selectedChecksheet, toast, fetchHistory]);

  const handleDelete = async (measurementId: number) => {
    try {
      await api.delete(`/api/measurements/${measurementId}`);
      toast({ title: "Measurement Deleted", description: "Successfully deleted record." });
      await fetchHistory();
    } catch {
      toast({ title: "Delete Failed", description: "Could not delete measurement.", variant: "destructive" });
    }
  };

  const handleEdit = async (measurement: Measurement) => {
    setEditingMeasurement(measurement);
    const checksheet = allChecksheets.find((cs) => cs.id === measurement.checksheetId);
    if (!checksheet) {
      toast({ title: "Error", description: "Checksheet not found for this measurement", variant: "destructive" });
      return;
    }
    handleDepartmentSelect(checksheet.department);
    setTimeout(() => {
      handleMachineSelect(checksheet.machine);
      setTimeout(() => {
        setSelectedChecksheet(checksheet);
        setTimeout(() => {
          form.reset(measurement.measurements);
        }, 50);
      }, 50);
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditingMeasurement(null);
    setSelectedChecksheet(null);
    setSelectedDepartment("");
    setSelectedMachine("");
    setDepartmentChecksheets([]);
    setMachineChecksheets([]);
    form.reset({});
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        if (!rows.length) {
          toast({ title: "Import Failed", description: "CSV file is empty.", variant: "destructive" });
          return;
        }

        setIsImporting(true);
        let created = 0;
        let failed = 0;
        const errors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const checksheetName = (row["checksheet_name"] || "").trim();
          const department = (row["department"] || "").trim();
          const machine = (row["machine"] || "").trim();
          const timestampRaw = (row["timestamp"] || "").trim();

          if (!checksheetName || !department || !machine) {
            errors.push(`Row ${i + 2}: missing checksheet_name, department, or machine`);
            failed++;
            continue;
          }

          const checksheet = allChecksheets.find(
            (cs) =>
              cs.itemName === checksheetName &&
              cs.department === department &&
              cs.machine === machine,
          );

          if (!checksheet) {
            errors.push(`Row ${i + 2}: no checksheet found for "${checksheetName}" / ${department} / ${machine}`);
            failed++;
            continue;
          }

          const measurements: Record<string, number | string | boolean> = {};
          for (const field of checksheet.measurementFields) {
            const rawVal = row[field.fieldName];
            if (rawVal === undefined || rawVal === "") continue;
            if (field.fieldType === "Numeric") {
              const n = parseFloat(rawVal);
              measurements[field.fieldName] = isNaN(n) ? 0 : n;
            } else if (field.fieldType === "Boolean") {
              measurements[field.fieldName] = rawVal.toLowerCase() === "true";
            } else {
              measurements[field.fieldName] = rawVal;
            }
          }

          const timestamp = timestampRaw ? new Date(timestampRaw) : new Date();
          if (isNaN(timestamp.getTime())) {
            errors.push(`Row ${i + 2}: invalid timestamp "${timestampRaw}"`);
            failed++;
            continue;
          }

          try {
            await api.post("/api/measurements", {
              checksheetId: checksheet.id,
              checksheetName: checksheet.itemName,
              department: checksheet.department,
              machine: checksheet.machine,
              measurements,
              issues: [],
            });
            created++;
          } catch {
            errors.push(`Row ${i + 2}: server error`);
            failed++;
          }
        }

        setIsImporting(false);
        await fetchHistory();

        if (errors.length > 0) {
          console.warn("Inspection import errors:", errors);
        }

        toast({
          title: "Import Complete",
          description: `${created} record(s) imported${failed ? `, ${failed} failed` : ""}.`,
          variant: failed > 0 && created === 0 ? "destructive" : "default",
        });
      },
      error: () => {
        setIsImporting(false);
        toast({ title: "Import Failed", description: "Could not parse CSV file.", variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleOpenConfirm)}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>{editingMeasurement ? "Edit Measurement" : "Inspection"}</CardTitle>
                  <CardDescription>
                    {editingMeasurement
                      ? "Update the measurement details below."
                      : "Select a department and check sheet, then enter measurements."}
                  </CardDescription>
                </div>
                {isManager && !editingMeasurement && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={allChecksheets.length === 0}
                      onClick={() => downloadInspectionTemplate(allChecksheets)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Template
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isImporting || isFetchingChecksheets}
                      onClick={() => importFileRef.current?.click()}
                    >
                      {isImporting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Import CSV
                    </Button>
                    <input
                      ref={importFileRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleImportFile}
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <div className="flex flex-wrap gap-2">
                  {departments.map((dep) => (
                    <Button
                      key={dep}
                      type="button"
                      variant={selectedDepartment === dep ? "default" : "outline"}
                      onClick={() => { if (!editingMeasurement) handleDepartmentSelect(dep); }}
                      disabled={!!editingMeasurement || isFetchingChecksheets}
                    >
                      {dep}
                    </Button>
                  ))}
                </div>
              </div>

              {selectedDepartment && (
                <div className="space-y-2">
                  <Label>Machine</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {machineOptions.map((machine) => (
                      <Button
                        key={machine}
                        type="button"
                        variant={selectedMachine === machine ? "default" : "outline"}
                        onClick={() => { if (!editingMeasurement) handleMachineSelect(machine); }}
                        disabled={!!editingMeasurement}
                        className="w-full"
                      >
                        {machine}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {selectedMachine && (
                <div className="space-y-2">
                  <Label>Check Sheet</Label>
                  {isFetchingChecksheets ? (
                    <div className="flex justify-center items-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : machineChecksheets.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {machineChecksheets.map((sheet) => (
                        <Button
                          key={sheet.id}
                          type="button"
                          variant={selectedChecksheet?.id === sheet.id ? "default" : "outline"}
                          onClick={() => { if (!editingMeasurement) setSelectedChecksheet(sheet); }}
                          disabled={!!editingMeasurement}
                          className="w-full"
                        >
                          {sheet.itemName}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-2">No check sheets found for this machine.</p>
                  )}
                </div>
              )}

              {selectedChecksheet &&
                selectedChecksheet.measurementFields.map((field, index) => (
                  <FormField
                    key={`${selectedChecksheet.id}-${index}`}
                    control={form.control}
                    name={field.fieldName as any}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>
                          {field.fieldName} {field.unit ? `(${field.unit})` : ""}
                        </FormLabel>
                        <FormControl>
                          {field.fieldType === "Numeric" ? (
                            <Input type="number" step="any" {...formField} value={formField.value ?? ""} />
                          ) : field.fieldType === "Text" ? (
                            <Input type="text" {...formField} value={formField.value ?? ""} />
                          ) : (
                            <Controller
                              name={field.fieldName as any}
                              control={form.control}
                              render={({ field: controllerField }) => (
                                <Select
                                  onValueChange={(val) => controllerField.onChange(val === "true")}
                                  value={String(controllerField.value ?? "false")}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="true">OK</SelectItem>
                                    <SelectItem value="false">Not OK</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          )}
                        </FormControl>
                        {field.fieldType === "Numeric" && field.lsl !== undefined && field.usl !== undefined && (
                          <FormDescription>
                            Standard: {field.lsl} - {field.usl}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
            </CardContent>
            <CardFooter className="flex-col items-stretch">
              {selectedChecksheet && (
                <div className="flex w-full gap-2">
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : editingMeasurement ? (
                      "Update Measurement"
                    ) : (
                      <>
                        <ChevronsRight className="mr-2 h-4 w-4" />
                        Submit Measurement
                      </>
                    )}
                  </Button>
                  {editingMeasurement && (
                    <Button type="button" variant="outline" onClick={handleCancelEdit} className="w-full">
                      Cancel
                    </Button>
                  )}
                </div>
              )}
            </CardFooter>
          </form>
        </Form>
      </Card>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Measurement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit this measurement? Please review the values before confirming.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {formDataForConfirm && (
            <div className="my-4 space-y-2 max-h-48 overflow-y-auto text-sm">
              {Object.entries(formDataForConfirm).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="font-medium">{key}:</span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Measurements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : measurementHistory.length === 0 ? (
            <p className="text-muted-foreground text-center p-8">No recent measurements found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Dept / Machine</TableHead>
                  <TableHead>Inspector</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {measurementHistory.map((measurement) => (
                  <TableRow key={measurement.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(measurement.timestamp), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="font-medium">{measurement.checksheetName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {measurement.department} / {measurement.machine}
                    </TableCell>
                    <TableCell className="text-sm">{measurement.inspector}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(measurement)}>
                          <FilePenLine className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Measurement?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(measurement.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
