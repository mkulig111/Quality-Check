
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import React from "react";
import { Loader2, ChevronsRight, FilePenLine, Trash2, History, Check, X } from "lucide-react";
import { formatDistanceToNow, addMinutes } from "date-fns";

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
import { auth, firestore } from "@/lib/firebase";
import { addDoc, collection, query, orderBy, serverTimestamp, Timestamp, doc, deleteDoc, updateDoc, getDocs, where, writeBatch, limit, onSnapshot } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";


// Base schema which can be extended
const formSchema = z.object({}).optional();

interface Checksheet {
    id: string;
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
    id: string;
    date: string;
    time: string;
    inspector: string;
    timestamp: Timestamp;
    checksheetId: string;
    checksheetName: string;
    department: string;
    machine: string;
    measurements: Record<string, number | string | boolean>;
    issues: string[];
}

const machineOptionsByDepartment: Record<string, string[]> = {
    "Injection": Array.from({ length: 15 }, (_, i) => `MC${i + 1}`),
    "Stamping": ["TR1", "TR2", "TR3", "TR4", "H1", "H2", "H3"],
    "Extrusion": ["EXT1"],
    "Assembly": ["Compbase", "Bottom Plate", "Plate Rear", "Reinforce 1", "Renforce 2", "Duct Connector", "Dispenser Welding"],
};

const RECENT_MEASUREMENTS_CAP = 100;
const HISTORY_LIMIT = 10;

export function InspectionTab() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isFetchingChecksheets, setIsFetchingChecksheets] = React.useState(true);
  const [measurementHistory, setMeasurementHistory] = React.useState<Measurement[]>([]);
  const [user] = useAuthState(auth);

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

  const [isLoadingHistory, setIsLoadingHistory] = React.useState(true);
  
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [formDataForConfirm, setFormDataForConfirm] = React.useState<any>(null);

  const form = useForm({
    resolver: zodResolver(dynamicFormSchema),
    defaultValues: {},
  });

  const fetchAllChecksheets = React.useCallback(async () => {
    setIsFetchingChecksheets(true);
    try {
        const q = query(collection(firestore, "checksheets"));
        const querySnapshot = await getDocs(q);
        const sheets: Checksheet[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            sheets.push({
              id: doc.id,
              itemName: data.itemName,
              department: data.department,
              machine: data.machine,
              measurementFields: data.measurementFields,
            });
        });
        setAllChecksheets(sheets);
    } catch (error) {
        toast({ title: "Error", description: "Could not fetch check sheets.", variant: "destructive" });
        console.error("Error fetching checksheets:", error);
    } finally {
        setIsFetchingChecksheets(false);
    }
  }, [toast]);
  
  React.useEffect(() => {
    fetchAllChecksheets();
  }, [fetchAllChecksheets]);


  const handleDepartmentSelect = (department: string) => {
    setSelectedDepartment(department);
    setSelectedMachine("");
    setMachineOptions(machineOptionsByDepartment[department] || []);
    setMachineChecksheets([]);
    setSelectedChecksheet(null);
    form.reset({});
    const filteredSheets = allChecksheets.filter(sheet => sheet.department === department);
    setDepartmentChecksheets(filteredSheets);
  };

  const handleMachineSelect = (machine: string) => {
    setSelectedMachine(machine);
    setSelectedChecksheet(null);
    form.reset({});
    const filteredSheets = departmentChecksheets.filter(sheet => sheet.machine === machine);
    setMachineChecksheets(filteredSheets);
  };

  React.useEffect(() => {
    if (selectedChecksheet) {
        const shape: { [key: string]: any } = {};
        const defaultValues: { [key: string]: any } = {};

        selectedChecksheet.measurementFields.forEach(field => {
            switch(field.fieldType) {
                case "Numeric":
                    shape[field.fieldName] = z.coerce.number();
                    defaultValues[field.fieldName] = field.lsl !== undefined && field.usl !== undefined ? (field.lsl + (field.usl || field.lsl))/2 : 0;
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
        const newSchema = z.object(shape);
        setDynamicFormSchema(newSchema);
        // Don't reset if we are editing
        if (!editingMeasurement) {
            form.reset(defaultValues);
        }
    } else {
      form.reset({});
      setDynamicFormSchema(z.object({}));
    }
  }, [selectedChecksheet, form, editingMeasurement]);

  React.useEffect(() => {
    setIsLoadingHistory(true);
    const recentMeasurementsRef = collection(firestore, "recent_measurements");
    const q = query(recentMeasurementsRef, orderBy("timestamp", "desc"), limit(HISTORY_LIMIT));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const history: Measurement[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const timestamp = data.timestamp as Timestamp;
            history.push({
                id: doc.id,
                date: timestamp?.toDate().toLocaleDateString() || '',
                time: timestamp?.toDate().toLocaleTimeString() || '',
                inspector: data.inspector,
                checksheetId: data.checksheetId,
                checksheetName: data.checksheetName,
                department: data.department,
                machine: data.machine,
                measurements: data.measurements,
                issues: data.issues || [],
                timestamp: timestamp,
            });
        });
        setMeasurementHistory(history);
        setIsLoadingHistory(false);
    }, (error) => {
        console.error("Error fetching real-time history:", error);
        toast({ title: "Error", description: "Could not fetch measurement history.", variant: "destructive" });
        setIsLoadingHistory(false);
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, [toast]);


  async function handleOpenConfirm(values: z.infer<typeof dynamicFormSchema>) {
    if (!selectedChecksheet) return;

    setFormDataForConfirm(values);
    setIsConfirmOpen(true);
  }

  const addMeasurementToDb = async (values: any, issues: string[]) => {
    if (!user || !selectedChecksheet) return;

    const payload = {
        inspector: user.email,
        checksheetId: selectedChecksheet.id,
        checksheetName: selectedChecksheet.itemName,
        department: selectedChecksheet.department,
        machine: selectedChecksheet.machine,
        measurements: values,
        issues: issues,
        timestamp: serverTimestamp()
    };
    
    const writeBatchPromise = writeBatch(firestore);
    
    // Write to main collection
    const mainDocRef = doc(collection(firestore, "measurements"));
    writeBatchPromise.set(mainDocRef, payload);
    
    // Write to recent collection
    const recentDocRef = doc(collection(firestore, "recent_measurements"), mainDocRef.id);
    writeBatchPromise.set(recentDocRef, payload);

    await writeBatchPromise.commit();

    // After adding, prune the collection if it exceeds the cap.
    const recentMeasurementsRef = collection(firestore, "recent_measurements");
    const countQuery = query(recentMeasurementsRef, orderBy("timestamp", "desc"));
    const snapshot = await getDocs(countQuery);
    
    if (snapshot.size > RECENT_MEASUREMENTS_CAP) {
        const pruneBatch = writeBatch(firestore);
        const docsToDelete = snapshot.docs.slice(RECENT_MEASUREMENTS_CAP);
        docsToDelete.forEach(docToDelete => pruneBatch.delete(docToDelete.ref));
        await pruneBatch.commit();
    }
  }
  
  const updateMeasurementInDb = async (id: string, values: any, issues: string[]) => {
      if (!user || !selectedChecksheet || !editingMeasurement) return;
      
      const updatedPayload = {
          inspector: editingMeasurement.inspector,
          checksheetId: editingMeasurement.checksheetId,
          checksheetName: editingMeasurement.checksheetName,
          department: editingMeasurement.department,
          machine: editingMeasurement.machine,
          measurements: values,
          issues: issues,
          timestamp: editingMeasurement.timestamp,
      };

      const batch = writeBatch(firestore);

      const mainDocRef = doc(firestore, "measurements", id);
      batch.update(mainDocRef, updatedPayload);

      const recentDocRef = doc(firestore, "recent_measurements", id);
      batch.update(recentDocRef, updatedPayload);
      
      await batch.commit();
  };


  const handleConfirmSubmit = React.useCallback(async () => {
    if (!formDataForConfirm) return;
    setIsLoading(true);
    setIsConfirmOpen(false);

    try {
        if (editingMeasurement) {
            await updateMeasurementInDb(editingMeasurement.id, formDataForConfirm, []);
        } else {
            await addMeasurementToDb(formDataForConfirm, []);
        }
         toast({
            title: editingMeasurement ? "Measurement Updated" : "Measurement Submitted",
            description: "Your measurement has been successfully recorded.",
            variant: "success"
        });
        
        handleCancelEdit();

    } catch (error) {
        toast({
            title: "Submission Failed",
            description: "An unexpected error occurred.",
            variant: "destructive",
        });
        console.error("DB Error:", error);
    } finally {
        setIsLoading(false);
        setFormDataForConfirm(null);
    }
  }, [formDataForConfirm, editingMeasurement, toast]);


  const handleDelete = async (measurementId: string) => {
    try {
      const batch = writeBatch(firestore);

      const mainDocRef = doc(firestore, "measurements", measurementId);
      batch.delete(mainDocRef);

      const recentDocRef = doc(firestore, "recent_measurements", measurementId);
      batch.delete(recentDocRef);

      await batch.commit();
      
      toast({ title: "Measurement Deleted", description: "Successfully deleted record." });
      // No need to manually update state, onSnapshot will handle it.
    } catch (error) {
       toast({ title: "Delete Failed", description: "Could not delete measurement.", variant: "destructive" });
      console.error("Error deleting measurement: ", error);
    }
  }

  const handleEdit = async (measurement: Measurement) => {
    setEditingMeasurement(measurement);

    const checksheet = allChecksheets.find(cs => cs.id === measurement.checksheetId);

    if (!checksheet) {
        toast({ title: "Error", description: "Checksheet not found for this measurement", variant: "destructive"});
        return;
    }
    
    handleDepartmentSelect(checksheet.department);
    
    // Using timeouts to ensure state updates propagate before the next one is set.
    // This helps sequentially update dependent UI elements.
    setTimeout(() => {
        handleMachineSelect(checksheet.machine);
        setTimeout(() => {
          setSelectedChecksheet(checksheet);
          setTimeout(() => {
              form.reset(measurement.measurements);
          }, 50);
        }, 50);
    }, 50);
  }

  const handleCancelEdit = () => {
    setEditingMeasurement(null);
    setSelectedChecksheet(null);
    setSelectedDepartment("");
    setSelectedMachine("");
    setDepartmentChecksheets([]);
    setMachineChecksheets([]);
    form.reset({});
  }
  
  return (
    <div className="space-y-6">
        <Card className="shadow-lg">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleOpenConfirm)}>
            <CardHeader>
                <CardTitle>{editingMeasurement ? "Edit Measurement" : "Inspection"}</CardTitle>
                <CardDescription>
                {editingMeasurement ? "Update the measurement details below." : "Select a department and check sheet, then enter measurements."}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Department</Label>
                    <div className="flex flex-wrap gap-2">
                        {departments.map(dep => (
                            <Button
                                key={dep}
                                type="button"
                                variant={selectedDepartment === dep ? "default" : "outline"}
                                onClick={() => {
                                    if (!editingMeasurement) {
                                       handleDepartmentSelect(dep);
                                    }
                                }}
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
                        {machineOptions.map(machine => (
                            <Button
                                key={machine}
                                type="button"
                                variant={selectedMachine === machine ? "default" : "outline"}
                                onClick={() => {
                                    if (!editingMeasurement) {
                                       handleMachineSelect(machine);
                                    }
                                }}
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
                        {machineChecksheets.map(sheet => (
                          <Button
                            key={sheet.id}
                            type="button"
                            variant={selectedChecksheet?.id === sheet.id ? "default" : "outline"}
                            onClick={() => {
                              if (!editingMeasurement) {
                                setSelectedChecksheet(sheet);
                              }
                            }}
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


                {selectedChecksheet && selectedChecksheet.measurementFields.map((field, index) => (
                    <FormField
                        key={`${selectedChecksheet.id}-${index}`}
                        control={form.control}
                        name={field.fieldName as any}
                        render={({ field: formField }) => (
                            <FormItem>
                                <FormLabel>{field.fieldName} {field.unit ? `(${field.unit})` : ''}</FormLabel>
                                <FormControl>
                                    {field.fieldType === "Numeric" ? (
                                        <Input type="number" step="any" {...formField} value={formField.value ?? ''} />
                                    ) : field.fieldType === "Text" ? (
                                        <Input type="text" {...formField} value={formField.value ?? ''} />
                                    ) : (
                                       <Controller
                                            name={field.fieldName as any}
                                            control={form.control}
                                            render={({ field: controllerField }) => (
                                                <Select onValueChange={(val) => controllerField.onChange(val === 'true')} value={String(controllerField.value ?? 'false')}>
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
                                {field.fieldType === 'Numeric' && field.lsl !== undefined && field.usl !== undefined && (
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
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingMeasurement ? "Update Measurement" : <ChevronsRight className="mr-2 h-4 w-4" />}
                            {editingMeasurement ? "" : "Submit Measurement"}
                        </Button>
                        {editingMeasurement && <Button type="button" variant="outline" onClick={handleCancelEdit} className="w-full">Cancel</Button>}
                    </div>
                )}
            </CardFooter>
            </form>
        </Form>
        </Card>

        {/* Confirmation Dialog */}
        <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Measurement</AlertDialogTitle>
                    <AlertDialogDescription>
                        Please review the entered values before saving.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="text-sm space-y-2">
                    {formDataForConfirm && Object.entries(formDataForConfirm).map(([key, value]) => (
                        <div key={key}>
                            <span className="font-semibold">{key}:</span> {String(value)}
                        </div>
                    ))}
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                         <Button variant="outline" className="hover:bg-red-500/10 hover:border-red-500 hover:text-red-500">
                             <X className="mr-2 h-4 w-4" /> Cancel
                         </Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <Button 
                            onClick={() => handleConfirmSubmit()} 
                            disabled={isLoading} 
                            className="hover:bg-green-500/10 hover:border-green-500 hover:text-green-500"
                        >
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                            Confirm
                        </Button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>


        <Card>
            <CardHeader>
                <CardTitle>Measurement History</CardTitle>
                <CardDescription>Showing the last {HISTORY_LIMIT} measurements in real-time.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingHistory ? (
                    <div className="flex justify-center items-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : measurementHistory.length === 0 ? (
                    <p className="text-muted-foreground text-center">No measurement history found.</p>
                ) : (
                    <div className="space-y-4">
                        {measurementHistory.map((entry) => {
                            const checksheet = allChecksheets.find(cs => cs.id === entry.checksheetId);
                            const hasIssues = entry.issues?.length > 0 || Object.entries(entry.measurements).some(([key, value]) => {
                                const field = checksheet?.measurementFields.find(f => f.fieldName === key);
                                return typeof value === 'number' && field && ((field.lsl !== undefined && value < field.lsl) || (field.usl !== undefined && value > field.usl));
                            });

                            return (
                                <Card key={entry.id} className={cn(hasIssues && "border-destructive")}>
                                    <CardHeader className="flex-row items-start justify-between p-4">
                                        <div>
                                            <CardTitle className="text-lg">{entry.checksheetName}</CardTitle>
                                            <CardDescription>
                                                {entry.date} at {entry.time} by {entry.inspector}
                                            </CardDescription>
                                             <div className="mt-2 flex gap-2">
                                                <Badge variant="secondary">{entry.department}</Badge>
                                                <Badge variant="outline">{entry.machine}</Badge>
                                             </div>
                                        </div>
                                         <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)}>
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
                                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete this measurement record.
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                  <AlertDialogAction onClick={() => handleDelete(entry.id)}>Continue</AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Field</TableHead>
                                                    <TableHead className="text-center">LSL</TableHead>
                                                    <TableHead className="text-center">Value</TableHead>
                                                    <TableHead className="text-center">USL</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {Object.entries(entry.measurements).map(([key, value]) => {
                                                    const field = checksheet?.measurementFields.find(f => f.fieldName === key);
                                                    const isNumeric = typeof value === 'number' && field?.fieldType === 'Numeric';
                                                    
                                                    const isOutOfSpec = isNumeric && field && (
                                                        (field.lsl !== undefined && value < field.lsl) ||
                                                        (field.usl !== undefined && value > field.usl)
                                                    );

                                                    const displayValue = typeof value === 'boolean' ? (value ? 'OK' : 'Not OK') : String(value);

                                                    return (
                                                        <TableRow key={key} className={cn(isOutOfSpec ? "text-destructive" : "")}>
                                                            <TableCell className="font-medium">{key}</TableCell>
                                                            <TableCell className="text-center">{field?.lsl ?? 'N/A'}</TableCell>
                                                            <TableCell className={cn("text-center", isOutOfSpec && "font-bold")}>{displayValue}</TableCell>
                                                            <TableCell className="text-center">{field?.usl ?? 'N/A'}</TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                         {entry.issues?.length > 0 && (
                                            <div className="mt-4">
                                                <h4 className="font-semibold text-destructive">Detected Issues:</h4>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                     {entry.issues.map((issue, i) => (
                                                        <Badge key={i} variant="destructive">{issue}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}

    