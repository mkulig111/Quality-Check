import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Database, BarChart2, Trash2, Loader2 } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { SpcAnalysisCharts } from "@/components/spc-analysis-charts";
import { firestore } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

interface SpcOption {
  id: string;
  label: string;
  checksheetId: string;
  checksheetDocId: string;
  fieldName: string;
  lsl?: number;
  usl?: number;
}

interface Checksheet {
  id: string;
  itemName: string;
  department: string;
  measurementFields: {
    fieldName: string;
    isSpecialCharacteristic: boolean;
    lsl?: number;
    usl?: number;
  }[];
}

interface MeasurementData {
  values: number[];
  lsl?: number;
  usl?: number;
}

const DEPARTMENTS = ["Stamping", "Injection", "Assembly", "Extrusion"];

export function SpcTab() {
  const { toast } = useToast();
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [isFetching, setIsFetching] = React.useState(false);
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);
  const [showCharts, setShowCharts] = React.useState(false);

  const [selectedDepartment, setSelectedDepartment] = React.useState<string | null>(null);
  const [departmentChecksheets, setDepartmentChecksheets] = React.useState<Checksheet[]>([]);
  const [selectedItem, setSelectedItem] = React.useState<Checksheet | null>(null);

  const [spcOptions, setSpcOptions] = React.useState<SpcOption[]>([]);
  const [selectedSpcOption, setSelectedSpcOption] = React.useState<string>("");
  const [numberOfPoints, setNumberOfPoints] = React.useState<string>("30");
  const [availableData, setAvailableData] = React.useState<number | null>(null);
  const [spcData, setSpcData] = React.useState<MeasurementData | null>(null);

  const handleDepartmentSelect = async (department: string) => {
    setSelectedDepartment(department);
    setSelectedItem(null);
    setSpcOptions([]);
    setSelectedSpcOption("");
    handleSelectionChange();

    setIsFetching(true);
    try {
      const q = query(collection(firestore, "checksheets"), where("department", "==", department));
      const querySnapshot = await getDocs(q);
      const sheets: Checksheet[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        sheets.push({
          id: doc.id,
          itemName: data.itemName,
          department: data.department,
          measurementFields: data.measurementFields,
        });
      });
      setDepartmentChecksheets(sheets);
    } catch (error) {
      toast({ title: "Error", description: "Could not fetch checksheets.", variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  };

  const handleItemSelect = (item: Checksheet) => {
    setSelectedItem(item);
    setSelectedSpcOption("");
    handleSelectionChange();

    const options: SpcOption[] = [];
    if (item.measurementFields) {
      item.measurementFields.forEach((field) => {
        if (field.isSpecialCharacteristic) {
          options.push({
            id: `${item.id}::${field.fieldName}`,
            label: `${field.fieldName}`,
            checksheetId: item.itemName,
            checksheetDocId: item.id,
            fieldName: field.fieldName,
            lsl: field.lsl,
            usl: field.usl,
          });
        }
      });
    }
    setSpcOptions(options);
  };

  const handleGenerateClick = async () => {
    if (!selectedSpcOption || !selectedDepartment || !date?.from) {
      toast({
        title: "Missing selection",
        description: "Please select department, characteristic, and date range.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setAvailableData(null);
    setShowCharts(false);

    const selectedOption = spcOptions.find((o) => o.id === selectedSpcOption);
    if (!selectedOption) {
      setIsLoading(false);
      return;
    }

    try {
      const pointsToFetch = parseInt(numberOfPoints);

      const q = query(
        collection(firestore, "measurements"),
        where("checksheetName", "==", selectedOption.checksheetId),
        where("department", "==", selectedDepartment),
        where("timestamp", ">=", Timestamp.fromDate(date.from)),
        where("timestamp", "<=", Timestamp.fromDate(date.to ?? date.from)),
        orderBy("timestamp", "desc"),
        limit(pointsToFetch * 2)
      );

      const querySnapshot = await getDocs(q);
      const values: number[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const val = data.measurements?.[selectedOption.fieldName];
        if (val !== undefined && !isNaN(Number(val))) {
          values.push(Number(val));
        }
      });

      setAvailableData(values.length);

      if (values.length >= pointsToFetch) {
        setSpcData({
          values: values.slice(0, pointsToFetch).reverse(),
          lsl: selectedOption.lsl,
          usl: selectedOption.usl,
        });
        setShowCharts(true);
      } else {
        setSpcData(null);
        setShowCharts(false);
      }
    } catch (error: any) {
      console.error("SPC Analysis Error:", error);
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
      setShowCharts(false);
      setSpcData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectionChange = () => {
    setShowCharts(false);
    setAvailableData(null);
    setSpcData(null);
  };

  React.useEffect(() => {
    handleSelectionChange();
  }, [selectedSpcOption, numberOfPoints, date]);

  const handleSeedData = async () => {
    setIsSeeding(true);

    try {
      const checksheetQuery = query(
        collection(firestore, "checksheets"),
        where("department", "==", selectedDepartment || DEPARTMENTS[0]),
        limit(1)
      );
      const querySnapshot = await getDocs(checksheetQuery);

      if (querySnapshot.empty) {
        toast({
          title: "Seeding Failed",
          description: "No checksheet found for the selected department. Please create one first.",
          variant: "destructive",
        });
        setIsSeeding(false);
        return;
      }

      const checksheetDoc = querySnapshot.docs[0];
      const checksheet = { id: checksheetDoc.id, ...checksheetDoc.data() } as any;

      const specialField = checksheet.measurementFields?.find((f: any) => f.isSpecialCharacteristic);
      if (!specialField) {
        toast({
          title: "Seeding Failed",
          description: "No special characteristic found. Mark a field as 'Special Characteristic' first.",
          variant: "destructive",
        });
        setIsSeeding(false);
        return;
      }

      const { lsl = 95, usl = 105 } = specialField;
      const mean = (lsl + usl) / 2;
      const stdDev = (usl - lsl) / 6;

      const promises = [];
      for (let i = 0; i < 30; i++) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        const randomValue = z0 * stdDev + mean;

        const docPayload = {
          inspector: "seed@system.io",
          checksheetId: checksheet.id,
          checksheetName: checksheet.itemName,
          department: checksheet.department,
          machine: checksheet.machine || "N/A",
          measurements: { [specialField.fieldName]: parseFloat(randomValue.toFixed(3)) },
          issues: [],
          timestamp: serverTimestamp(),
        };
        promises.push(addDoc(collection(firestore, "measurements"), docPayload));
      }

      await Promise.all(promises);
      toast({
        title: "Seeding Successful",
        description: "Successfully added 30 random data points.",
      });
    } catch (error) {
      toast({ title: "Seeding Error", description: "An error occurred while adding data.", variant: "destructive" });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearSeededData = async () => {
    setIsClearing(true);
    try {
      const q = query(collection(firestore, "measurements"), where("inspector", "==", "seed@system.io"));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ title: "No Seeded Data Found", description: "There is no seeded data to clear." });
        setIsClearing(false);
        return;
      }

      const batch = writeBatch(firestore);
      querySnapshot.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      toast({
        title: "Seeded Data Cleared",
        description: `Successfully removed ${querySnapshot.size} measurement records.`,
      });
    } catch (error) {
      toast({ title: "Error Clearing Data", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SPC Analysis</CardTitle>
          <CardDescription>Select parameters to analyze measurement data from Firestore.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>1. Select Department</Label>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map((dep) => (
                <Button
                  key={dep}
                  type="button"
                  variant={selectedDepartment === dep ? "default" : "outline"}
                  onClick={() => handleDepartmentSelect(dep)}
                  disabled={isFetching}
                >
                  {isFetching && selectedDepartment === dep ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {dep}
                </Button>
              ))}
            </div>
          </div>

          {isFetching && (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {selectedDepartment && !isFetching && departmentChecksheets.length > 0 && (
            <div className="space-y-2">
              <Label>2. Select Item Name</Label>
              <div className="flex flex-wrap gap-2">
                {departmentChecksheets.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant={selectedItem?.id === item.id ? "default" : "outline"}
                    onClick={() => handleItemSelect(item)}
                  >
                    {item.itemName}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {selectedDepartment && !isFetching && departmentChecksheets.length === 0 && (
            <p className="text-sm text-muted-foreground">No checksheets found for {selectedDepartment}.</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>3. Select Characteristic</Label>
              <Select
                onValueChange={setSelectedSpcOption}
                value={selectedSpcOption}
                disabled={!selectedItem || spcOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedItem
                        ? "Select an item first"
                        : spcOptions.length === 0
                        ? "No special characteristics found"
                        : "Select characteristic"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {spcOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>4. Number of data points</Label>
              <Select onValueChange={setNumberOfPoints} value={numberOfPoints} disabled={!selectedSpcOption}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="60">60</SelectItem>
                  <SelectItem value="90">90</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>5. Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    disabled={!selectedSpcOption}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(date.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date</span>
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
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button onClick={handleGenerateClick} disabled={!selectedSpcOption || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart2 className="mr-2 h-4 w-4" />}
            {isLoading ? "Generating..." : "Generate Analysis"}
          </Button>
          <Button onClick={handleSeedData} disabled={isSeeding} variant="secondary">
            {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
            {isSeeding ? "Seeding..." : "Seed Data for Demo"}
          </Button>
          <Button onClick={handleClearSeededData} disabled={isClearing} variant="destructive">
            {isClearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {isClearing ? "Clearing..." : "Clear Seeded Data"}
          </Button>
        </CardFooter>
      </Card>

      {availableData !== null && !showCharts && !isLoading && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Not Enough Data</AlertTitle>
          <AlertDescription>
            Found {availableData} data points for the selected criteria, but {numberOfPoints} are required. Please
            select a larger date range or seed more data.
          </AlertDescription>
        </Alert>
      )}

      {showCharts && spcData && (
        <Card>
          <CardHeader>
            <CardTitle>
              Charts of {selectedItem?.itemName} -{" "}
              {spcOptions.find((o) => o.id === selectedSpcOption)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SpcAnalysisCharts data={spcData.values} lsl={spcData.lsl} usl={spcData.usl} subgroupSize={5} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
