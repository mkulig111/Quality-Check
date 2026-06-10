import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Loader2, Calendar as CalendarIcon, UploadCloud, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import Papa from "papaparse";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const DEPARTMENTS = ["Stamping", "Injection", "Assembly", "Extrusion"];

interface Measurement {
  id: number;
  checksheetName: string;
  department: string;
  inspector: string;
  measurements: Record<string, any>;
  timestamp: string;
}

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
      const startDate = date.from.toISOString();
      const endDate = date.to
        ? new Date(new Date(date.to).setHours(23, 59, 59, 999)).toISOString()
        : new Date(new Date(date.from).setHours(23, 59, 59, 999)).toISOString();

      const measurements = await api.get<Measurement[]>(
        `/api/measurements?department=${encodeURIComponent(selectedDepartment)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&limit=10000`
      );

      if (measurements.length === 0) {
        toast({ title: "No Data Found", description: "No measurement data found for the selected criteria." });
        return;
      }

      const allFieldNames = new Set<string>();
      measurements.forEach((m) => {
        if (m.measurements) Object.keys(m.measurements).forEach((k) => allFieldNames.add(k));
      });
      const sortedFieldNames = Array.from(allFieldNames).sort();
      const headers = ["Item Name", "Department", "Date", "Time", "Inspector", ...sortedFieldNames];

      const dataToExport = measurements.map((m) => {
        const ts = new Date(m.timestamp);
        const row: Record<string, any> = {
          "Item Name": m.checksheetName,
          Department: m.department,
          Date: ts.toISOString().split("T")[0],
          Time: ts.toLocaleTimeString("en-US", { hour12: false }),
          Inspector: m.inspector,
        };
        sortedFieldNames.forEach((f) => { row[f] = String(m.measurements[f] ?? ""); });
        return row;
      });

      const csv = Papa.unparse(dataToExport, { columns: headers });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.setAttribute("href", URL.createObjectURL(blob));
      link.setAttribute("download", `${selectedDepartment}-export-${format(new Date(), "yyyy-MM-dd")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Export Successful", description: `Downloaded ${dataToExport.length} records.` });
    } catch {
      toast({ title: "Export Failed", description: "Could not export the data.", variant: "destructive" });
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
      const endDate = date.to
        ? new Date(new Date(date.to).setHours(23, 59, 59, 999)).toISOString()
        : new Date(new Date(date.from).setHours(23, 59, 59, 999)).toISOString();

      const res = await fetch("/api/export/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: selectedDepartment, startDate, endDate }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const filename = `${selectedDepartment}-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
      const link = document.createElement("a");
      link.setAttribute("href", URL.createObjectURL(blob));
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Report Generated", description: "Your download has started." });
    } catch (error: any) {
      toast({ title: "Server Export Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoadingCloud(false);
    }
  };

  const handleManualExport = async () => {
    setIsManualExporting(true);
    try {
      const result = await api.post<{
        success: boolean;
        date: string;
        message: string;
        exports: { department: string; status: string; count?: number; error?: string }[];
      }>("/api/export/daily", {});

      const successCount = result.exports.filter((e) => e.status === "SUCCESS").length;
      const failedCount = result.exports.filter((e) => e.status === "FAILED").length;
      const skippedCount = result.exports.filter((e) => e.status === "SKIPPED").length;

      toast({
        title: "Manual Export Complete",
        description: `Date: ${result.date}. ${successCount} succeeded${skippedCount > 0 ? `, ${skippedCount} skipped (no data)` : ""}${failedCount > 0 ? `, ${failedCount} failed` : ""}.`,
      });
    } catch (error: any) {
      toast({ title: "Manual Export Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsManualExporting(false);
    }
  };

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Export Measurement Data</CardTitle>
          <CardDescription>
            Select a department and date range to download measurement data as a CSV file, or run a manual export of yesterday's data.
          </CardDescription>
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
                  {DEPARTMENTS.map((dep) => (
                    <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="date" variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>
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
            <Button
              onClick={handleExport}
              disabled={isLoading || isLoadingCloud || !selectedDepartment}
              className="w-full"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isLoading ? "Generating..." : "Generate and Download CSV"}
            </Button>

            <Button
              onClick={handleCloudExport}
              disabled={isLoading || isLoadingCloud || !selectedDepartment}
              className="w-full"
            >
              {isLoadingCloud ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              {isLoadingCloud ? "Generating..." : "Generate and Download from Server"}
            </Button>

            <Button
              onClick={handleManualExport}
              disabled={isManualExporting}
              variant="secondary"
              className="w-full"
            >
              {isManualExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <History className="mr-2 h-4 w-4" />}
              {isManualExporting ? "Exporting..." : "Run Manual Export for Yesterday"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
