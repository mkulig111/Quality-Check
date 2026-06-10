
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import React from "react";
import { PlusCircle, Trash2, FilePenLine, Loader2 } from "lucide-react";

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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { firestore } from "@/lib/firebase";
import { collection, addDoc, query, serverTimestamp, doc, deleteDoc, updateDoc, getDocs } from "firebase/firestore";


const measurementFieldSchema = z.object({
  fieldName: z.string().min(1, "Field name is required."),
  fieldType: z.enum(["Numeric", "Boolean", "Text"]),
  unit: z.string().optional(),
  lsl: z.coerce.number().optional(),
  usl: z.coerce.number().optional(),
  isSpecialCharacteristic: z.boolean().default(false),
});

const formSchema = z.object({
  itemName: z.string().min(1, "Item name is required."),
  department: z.string().min(1, "Department is required."),
  machine: z.string().min(1, "Machine is required."),
  measurementFields: z.array(measurementFieldSchema).min(1, "At least one measurement field is required."),
});

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
        isSpecialCharacteristic: boolean;
    }[];
}

const machineOptionsByDepartment: Record<string, string[]> = {
    "Injection": Array.from({ length: 15 }, (_, i) => `MC${i + 1}`),
    "Stamping": ["TR1", "TR2", "TR3", "TR4", "H1", "H2", "H3"],
    "Extrusion": ["EXT1"],
    "Assembly": ["Compbase", "Bottom Plate", "Plate Rear", "Reinforce 1", "Renforce 2", "Duct Connector", "Dispenser Welding"],
};


export function ChecksheetTab() {
  const { toast } = useToast();
  const [allChecksheets, setAllChecksheets] = React.useState<Checksheet[]>([]);
  const [departmentChecksheets, setDepartmentChecksheets] = React.useState<Checksheet[]>([]);
  const [isFetchingSheets, setIsFetchingSheets] = React.useState(true);
  
  const [editingSheetId, setEditingSheetId] = React.useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = React.useState<string | null>(null);
  const [machineOptions, setMachineOptions] = React.useState<string[]>([]);
  const departments = ["Stamping", "Injection", "Assembly", "Extrusion"];
  
  const fetchAllChecksheets = React.useCallback(async () => {
    setIsFetchingSheets(true);
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
      setIsFetchingSheets(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchAllChecksheets();
  }, [fetchAllChecksheets]);


  const handleDepartmentSelect = (department: string) => {
    setSelectedDepartment(department);
    const filteredSheets = allChecksheets.filter(sheet => sheet.department === department);
    setDepartmentChecksheets(filteredSheets);
  };


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemName: "",
      department: "Stamping",
      machine: "",
      measurementFields: [{ fieldName: "", fieldType: "Numeric", unit: "", lsl: undefined, usl: undefined, isSpecialCharacteristic: false }],
    },
  });

  const departmentValue = form.watch("department");

  React.useEffect(() => {
      if (departmentValue) {
          setMachineOptions(machineOptionsByDepartment[departmentValue] || []);
          form.setValue("machine", ""); // Reset machine when department changes
      } else {
          setMachineOptions([]);
      }
  }, [departmentValue, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "measurementFields",
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
        if (editingSheetId) {
            const docRef = doc(firestore, "checksheets", editingSheetId);
            await updateDoc(docRef, values);
            toast({
                title: "Check Sheet Updated",
                description: `Successfully updated check sheet for ${values.itemName}.`,
            });
            setEditingSheetId(null);
        } else {
            await addDoc(collection(firestore, "checksheets"), {
                ...values,
                createdAt: serverTimestamp(),
            });
            toast({
                title: "Check Sheet Created",
                description: `Successfully created check sheet for ${values.itemName}.`,
            });
        }
        await fetchAllChecksheets(); // Re-fetch all data after any change
        if (selectedDepartment) {
            handleDepartmentSelect(selectedDepartment); // Re-apply filter if a department is selected
        }
        form.reset({
          itemName: "",
          department: "Stamping",
          machine: "",
          measurementFields: [{ fieldName: "", fieldType: "Numeric", unit: "", lsl: undefined, usl: undefined, isSpecialCharacteristic: false }],
        });
    } catch (error) {
        toast({
            title: `Error ${editingSheetId ? 'Updating' : 'Creating'} Check Sheet`,
            description: "An unexpected error occurred.",
            variant: "destructive",
        });
        console.error("Error processing document: ", error);
    }
  }

  const handleEdit = (sheet: Checksheet) => {
    setEditingSheetId(sheet.id);
    form.reset({
        itemName: sheet.itemName,
        department: sheet.department,
        machine: sheet.machine,
        measurementFields: sheet.measurementFields,
    });
  }

  const handleCancelEdit = () => {
    setEditingSheetId(null);
    form.reset({
      itemName: "",
      department: "Stamping",
      machine: "",
      measurementFields: [{ fieldName: "", fieldType: "Numeric", unit: "", lsl: undefined, usl: undefined, isSpecialCharacteristic: false }],
    });
  }

  const handleDelete = async (sheet: Checksheet) => {
    try {
      await deleteDoc(doc(firestore, "checksheets", sheet.id));
      toast({
        title: "Check Sheet Deleted",
        description: "Successfully deleted check sheet.",
      });
      await fetchAllChecksheets();
      if (selectedDepartment) {
        handleDepartmentSelect(selectedDepartment);
      }
    } catch (error) {
      toast({
        title: "Error Deleting Check Sheet",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      console.error("Error deleting document: ", error);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 justify-center">
      <Card className="shadow-lg w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{editingSheetId ? "Edit Check Sheet" : "Create New Check Sheet"}</CardTitle>
          <CardDescription>{editingSheetId ? "Modify the details of the existing check sheet." : "Define a new item and its measurement parameters."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Engine Block" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map(dep => <SelectItem key={dep} value={dep}>{dep}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="machine"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Machine</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!departmentValue}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a machine" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {machineOptions.map(machine => <SelectItem key={machine} value={machine}>{machine}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <h3 className="text-lg font-medium mb-2">Measurement Fields</h3>
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg relative space-y-4">
                         <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 text-destructive hover:text-destructive"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name={`measurementFields.${index}.fieldName`}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Field Name</FormLabel>
                                    <FormControl>
                                    <Input placeholder="e.g., Weight" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`measurementFields.${index}.fieldType`}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Field Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="Numeric">Numeric</SelectItem>
                                        <SelectItem value="Boolean">Boolean</SelectItem>
                                        <SelectItem value="Text">Text</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </FormItem>
                                )}
                            />
                        </div>
                        <Controller
                            control={form.control}
                            name={`measurementFields.${index}.fieldType`}
                            render={({ field }) => (
                                <>
                                {field.value === 'Numeric' && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <FormField
                                            control={form.control}
                                            name={`measurementFields.${index}.unit`}
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Unit</FormLabel>
                                                <FormControl><Input placeholder="e.g., kg" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`measurementFields.${index}.lsl`}
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>LSL</FormLabel>
                                                <FormControl><Input type="number" placeholder="e.g., 74.5" {...field} value={field.value ?? ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`measurementFields.${index}.usl`}
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>USL</FormLabel>
                                                <FormControl><Input type="number" placeholder="e.g., 75.5" {...field} value={field.value ?? ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                    </div>
                                )}
                                </>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name={`measurementFields.${index}.isSpecialCharacteristic`}
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-1">
                                <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                <FormLabel>
                                    Special Characteristic (Calculate SPC)
                                </FormLabel>
                                </div>
                            </FormItem>
                            )}
                        />
                    </div>
                  ))}
                </div>
                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => append({ fieldName: "", fieldType: "Numeric", unit: "", lsl: undefined, usl: undefined, isSpecialCharacteristic: false })}
                    >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Field
                </Button>
                {form.formState.errors.measurementFields && <p className="text-sm font-medium text-destructive">{form.formState.errors.measurementFields.message}</p>}
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="w-full">{editingSheetId ? "Update Sheet" : "Create Sheet"}</Button>
                {editingSheetId && <Button type="button" variant="outline" className="w-full" onClick={handleCancelEdit}>Cancel</Button>}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Existing Check Sheets</CardTitle>
          <CardDescription>Select a department to view its check sheets.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="flex flex-wrap gap-2 mb-4">
                {departments.map(dep => (
                    <Button
                        key={dep}
                        type="button"
                        variant={selectedDepartment === dep ? "default" : "outline"}
                        onClick={() => handleDepartmentSelect(dep)}
                        disabled={isFetchingSheets}
                    >
                        {isFetchingSheets && selectedDepartment === dep ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {dep}
                    </Button>
                ))}
            </div>

            <div className="space-y-4">
            {isFetchingSheets && (
                <div className="flex justify-center items-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}
            {!isFetchingSheets && selectedDepartment && departmentChecksheets.length === 0 && (
                <p className="text-muted-foreground">No check sheets found for the {selectedDepartment} department.</p>
            )}
            {!isFetchingSheets && departmentChecksheets.map((sheet) => (
                <Card key={sheet.id} className="p-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{sheet.itemName}</h4>
                                <Badge variant="secondary">{sheet.department}</Badge>
                                <Badge variant="outline">{sheet.machine}</Badge>
                            </div>
                            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                {sheet.measurementFields && sheet.measurementFields.map((field, fieldIndex) => (
                                    <p key={fieldIndex}>
                                        {field.isSpecialCharacteristic && <span className="text-destructive">* </span>}
                                        {field.fieldName}
                                        <span className="text-xs ml-1">({field.fieldType})</span>
                                        {field.unit && <span className="ml-2">Unit: {field.unit}</span>}
                                        {field.lsl !== undefined && <span className="ml-2">LSL: {field.lsl}</span>}
                                        {field.usl !== undefined && <span className="ml-2">USL: {field.usl}</span>}
                                    </p>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(sheet)}>
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
                                    This action cannot be undone. This will permanently delete the check sheet
                                    and all associated measurement data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(sheet)}>Continue</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </Card>
            ))}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
