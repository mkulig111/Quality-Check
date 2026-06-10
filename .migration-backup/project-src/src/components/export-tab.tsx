
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Loader2, Calendar as CalendarIcon, UploadCloud, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { firestore } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import Papa from "papaparse";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { generateExportUrlFlow } from "@/ai/flows/generate-reports-flow";
import { dailyExportFlow } from "@/ai/flows/daily-export-flow";

const DEPARTMENTS = ["Stamping", "Injection", "Assembly", "Extrusion"];

export function ExportTab() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = React.useState(false);
  const [isManualExporting, setIsManualExporting] = React.useState(false);
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
  });
  const [selectedDepartment, setSelectedDepartment] = React.useState<string | null>(null);

  const handleExport = async () => {
    if (!selectedDepartment) {
      toast({ title: "Department not selected", description: "Please select a department to export.", variant: "destructive" });
      return;
    }
    if (!date?.from) {
      toast({ title: "Date not selected", description: "Please select a date range to export.", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const startOfDay = date.from;
      const endOfDay = date.to ? new Date(date.to.setHours(23, 59, 59, 999)) : new Date(date.from.setHours(23, 59, 59, 999));
      
      const q = query(
        collection(firestore, "measurements"),
        where("department", "==", selectedDepartment),
        where("timestamp", ">=", Timestamp.fromDate(startOfDay)),
        where("timestamp", "<=", Timestamp.fromDate(endOfDay))
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ title: "No Data Found", description: "No measurement data found for the selected criteria." });
        setIsLoading(false);
        return;
      }

      const allFieldNames = new Set<string>();
      const measurementsData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          if (data.measurements) {
              Object.keys(data.measurements).forEach(fieldName => allFieldNames.add(fieldName));
          }
          return data;
      });

      const sortedFieldNames = Array.from(allFieldNames).sort();
      const headers = ['Item Name', 'Department', 'Date', 'Time', 'Inspector', ...sortedFieldNames];

      const dataToExport = measurementsData.map(data => {
        const timestamp = (data.timestamp as Timestamp)?.toDate();
        const row: Record<string, any> = {
          'Item Name': data.checksheetName,
          'Department': data.department,
          'Date': timestamp ? timestamp.toISOString().split('T')[0] : 'N/A',
          'Time': timestamp ? timestamp.toLocaleTimeString('en-US', { hour12: false }) : 'N/A',
          'Inspector': data.inspector,
        };
        sortedFieldNames.forEach(field => {
            row[field] = String(data.measurements[field] ?? '');
        });
        return row;
      });

      const csv = Papa.unparse(dataToExport, { fields: headers });
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      const filename = `${selectedDepartment}-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Export Successful", description: `Downloaded ${dataToExport.length} records.` });

    } catch (error) {
      console.error("Export error:", error);
      toast({ title: "Export Failed", description: "Could not export the data. Check console for details.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCloudExport = async () => {
    if (!selectedDepartment) {
      toast({ title: "Department not selected", description: "Please select a department to export.", variant: "destructive" });
      return;
    }
    if (!date?.from) {
      toast({ title: "Date not selected", description: "Please select a date range to export.", variant: "destructive" });
      return;
    }
    setIsLoadingCloud(true);
    try {
        const startDate = date.from.toISOString();
        const endDate = (date.to ?? date.from).toISOString();

        const downloadUrl = await generateExportUrlFlow({
            department: selectedDepartment,
            startDate,
            endDate,
        });

        toast({
            title: "Report Generated",
            description: "Your download will begin shortly.",
        });

        window.open(downloadUrl, '_blank');

    } catch (error: any) {
        console.error("Cloud export error:", error);
        toast({ title: "Cloud Export Failed", description: error.message, variant: "destructive" });
    } finally {
        setIsLoadingCloud(false);
    }
  }

  const handleManualExport = async () => {
    setIsManualExporting(true);
    try {
      const result = await dailyExportFlow();
      const successCount = result.exports.filter(e => e.status === 'SUCCESS').length;
      const failedCount = result.exports.filter(e => e.status === 'FAILED').length;
      toast({
        title: "Manual Export Complete",
        description: `Successfully exported data for ${successCount} departments. ${failedCount > 0 ? `Failed for ${failedCount}.` : ''}`,
      });
      console.log("Manual export result:", result);
    } catch (error: any) {
      console.error("Manual export error:", error);
      toast({ title: "Manual Export Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsManualExporting(false);
    }
  }


  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Export Measurement Data</CardTitle>
          <CardDescription>Select a department and date range to download measurement data as a CSV file, or run a manual export of yesterday's data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
               <Select onValueChange={setSelectedDepartment} value={selectedDepartment || ""}>
                  <SelectTrigger>
                      <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent>
                      {DEPARTMENTS.map(dep => <SelectItem key={dep} value={dep}>{dep}</SelectItem>)}
                  </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
                <Label>Date Range</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        id="date"
                        variant={"outline"}
                        className="w-full justify-start text-left font-normal"
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                            <>
                                {format(date.from, "LLL dd, y")} -{" "}
                                {format(date.to, "LLL dd, y")}
                            </>
                            ) : (
                            format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date range</span>
                        )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>
             </div>
          </div>
          <div className="space-y-2">
            <Button onClick={handleExport} disabled={true} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {isLoading ? "Generating..." : "Generate and Download CSV"}
            </Button>
            <Button onClick={handleCloudExport} disabled={isLoading || isLoadingCloud || !selectedDepartment} className="w-full">
                {isLoadingCloud ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                {isLoadingCloud ? "Generating..." : "Generate and Download from Cloud"}
            </Button>
            <Button onClick={handleManualExport} disabled={isManualExporting} variant="secondary" className="w-full">
                {isManualExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <History className="mr-2 h-4 w-4" />}
                {isManualExporting ? "Exporting..." : "Run Manual Export for Yesterday"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
