
"use client";

import { Bar, BarChart, Line, LineChart, ReferenceLine, XAxis, YAxis, CartesianGrid, Legend, Tooltip, ResponsiveContainer, ComposedChart, Label } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import React from "react";

interface SpcAnalysisChartsProps {
  data: number[];
  lsl?: number;
  usl?: number;
  subgroupSize?: number;
}

// Helper Functions for Statistical Calculations

// Standard deviation
const getStdDev = (data: number[]) => {
  const n = data.length;
  if (n < 2) return 0;
  const mean = data.reduce((a, b) => a + b) / n;
  return Math.sqrt(data.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / (n - 1));
};

// Average of an array
const getMean = (data: number[]) => {
  if (data.length === 0) return 0;
  return data.reduce((a, b) => a + b) / data.length;
};

// Create subgroups for X-bar and R charts
const createSubgroups = (data: number[], size: number) => {
    const subgroups: number[][] = [];
    for (let i = 0; i < data.length; i += size) {
        const subgroup = data.slice(i, i + size);
        if (subgroup.length === size) { // Only full subgroups
            subgroups.push(subgroup);
        }
    }
    return subgroups;
};

// D2, d2, and c4 constants for subgroup calculations
const D2_VALUES: { [key: number]: number } = { 2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326, 6: 2.534, 7: 2.704, 8: 2.847, 9: 2.970, 10: 3.078 };
const D4_VALUES: { [key: number]: number } = { 2: 3.267, 3: 2.574, 4: 2.282, 5: 2.114, 6: 2.004, 7: 1.924, 8: 1.864, 9: 1.816, 10: 1.777 };


const chartConfig: ChartConfig = {
  frequency: { label: "Frequency", color: "hsl(var(--chart-2))" },
  curve: { label: "Normal", color: "hsl(var(--destructive))" },
  mean: { label: "Mean", color: "hsl(var(--primary))" },
  range: { label: "Range", color: "hsl(var(--primary))" },
  ucl: { label: "UCL", color: "hsl(var(--destructive))" },
  lcl: { label: "LCL", color: "hsl(var(--destructive))" },
  observations: { label: "Observations", color: "hsl(var(--primary))" },
  qq: { label: "Q-Q", color: "hsl(var(--primary))" },
};


export function SpcAnalysisCharts({ data, lsl, usl, subgroupSize = 5 }: SpcAnalysisChartsProps) {

  const {
    overallMean,
    overallStdDev,
    withinStdDev,
    cp,
    cpk,
    pp,
    ppk,
    ppm,
    percentBelowLsl,
    percentAboveUsl,
    xBarChartData,
    rangeChartData,
    processDistributionData,
  } = React.useMemo(() => {
    if (!data || data.length === 0) {
      return {
        overallMean: 0, overallStdDev: 0, withinStdDev: 0, cp: 0, cpk: 0, pp: 0, ppk: 0, ppm: 0, percentBelowLsl: 0, percentAboveUsl: 0,
        xBarChartData: [], rangeChartData: [], processDistributionData: [],
      };
    }

    const overallMean = getMean(data);
    const overallStdDev = getStdDev(data);

    const subgroups = createSubgroups(data, subgroupSize);
    const subgroupMeans = subgroups.map(getMean);
    const subgroupRanges = subgroups.map(sg => Math.max(...sg) - Math.min(...sg));

    const avgRange = getMean(subgroupRanges);
    const d2 = D2_VALUES[subgroupSize] || 2.326;
    const withinStdDev = avgRange / d2;
    
    // Capability
    const cp = (lsl !== undefined && usl !== undefined && withinStdDev > 0) ? (usl - lsl) / (6 * withinStdDev) : 0;
    const cpu = (usl !== undefined && withinStdDev > 0) ? (usl - overallMean) / (3 * withinStdDev) : Infinity;
    const cpl = (lsl !== undefined && withinStdDev > 0) ? (overallMean - lsl) / (3 * withinStdDev) : Infinity;
    const cpk = Math.min(cpu, cpl);

    const pp = (lsl !== undefined && usl !== undefined && overallStdDev > 0) ? (usl - lsl) / (6 * overallStdDev) : 0;
    const ppu = (usl !== undefined && overallStdDev > 0) ? (usl - overallMean) / (3 * overallStdDev) : Infinity;
    const ppl = (lsl !== undefined && overallStdDev > 0) ? (overallMean - lsl) / (3 * overallStdDev) : Infinity;
    const ppk = Math.min(ppu, ppl);

    const ppm = (ppk > 0) ? (1 - (0.5 * (1 + Math.sign(ppk)) - 0.5 * Math.sign(ppk) * (1 - Math.exp(-Math.pow(ppk * Math.sqrt(2), 2))))) * 2 * 1000000 : 1000000;

    // Performance
    const percentBelowLsl = lsl !== undefined ? (data.filter(d => d < lsl).length / data.length) * 100 : 0;
    const percentAboveUsl = usl !== undefined ? (data.filter(d => d > usl).length / data.length) * 100 : 0;
    
    // Chart Data
    const grandMean = getMean(subgroupMeans);
    const A2 = 3.760 / (d2 * Math.sqrt(subgroupSize));
    const xBarUcl = grandMean + A2 * avgRange;
    const xBarLcl = grandMean - A2 * avgRange;
    const xBarChartData = subgroupMeans.map((mean, i) => ({ batch: `${i + 1}`, mean, ucl: xBarUcl, lcl: xBarLcl }));

    const D4 = D4_VALUES[subgroupSize] || 2.114;
    const rangeUcl = D4 * avgRange;
    const rangeChartData = subgroupRanges.map((range, i) => ({ batch: `${i + 1}`, range, ucl: rangeUcl, lcl: 0 }));

    // Process Distribution - Corrected Logic
    const minX = Math.min(...data, lsl ?? Infinity);
    const maxX = Math.max(...data, usl ?? -Infinity);
    const range = maxX - minX;
    const extendedMin = minX - range * 0.1;
    const extendedMax = maxX + range * 0.1;
    const numBins = 20; // Use a fixed number for consistency
    const binWidth = (extendedMax - extendedMin) / numBins;

    const bins = Array.from({ length: numBins }, (_, i) => {
        const binStart = extendedMin + i * binWidth;
        const binEnd = binStart + binWidth;
        const binCenter = (binStart + binEnd) / 2;
        const frequency = data.filter(d => d >= binStart && d < binEnd).length;
        return { bin: binCenter, frequency };
    });

    const normalFn = (x: number) => (1 / (overallStdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - overallMean) / overallStdDev, 2));
    const processDistributionData = bins.map(binData => ({
        ...binData,
        curve: normalFn(binData.bin) * data.length * binWidth, // Scale curve to frequency
    }));

    return {
        overallMean, overallStdDev, withinStdDev, cp, cpk, pp, ppk, ppm, percentBelowLsl, percentAboveUsl,
        xBarChartData, rangeChartData, processDistributionData
    };
  }, [data, lsl, usl, subgroupSize]);

  const target = lsl !== undefined && usl !== undefined ? (lsl + usl) / 2 : overallMean;
  const tickFormatter = (value: number) => value.toFixed(1);

  return (
    <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
             <Card className="xl:col-span-1">
                <CardHeader><CardTitle>Process Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <ComposedChart data={processDistributionData} barGap={0}>
                      <CartesianGrid vertical={false} />
                      <XAxis 
                        dataKey="bin" 
                        type="number" 
                        domain={['dataMin', 'dataMax']} 
                        tickFormatter={tickFormatter}
                      />
                      <YAxis />
                      <Tooltip 
                        cursor={{ fill: "hsl(var(--muted))" }}
                        content={<ChartTooltipContent 
                          hideLabel 
                          formatter={(value, name, props) => {
                              if (name === 'bin') return null;
                              if (props.payload.bin) {
                                  return (
                                    <div className="flex flex-col gap-1">
                                      <div className="font-semibold">{`Bin: ${props.payload.bin.toFixed(2)}`}</div>
                                      <div>{`Frequency: ${props.payload.frequency}`}</div>
                                    </div>
                                  );
                              }
                              return null;
                          }}
                        />}
                       />
                      <Bar dataKey="frequency" fill="var(--color-frequency)" radius={0} />
                      <Line dataKey="curve" type="monotone" stroke="var(--color-curve)" strokeWidth={2} dot={false} />
                      {lsl !== undefined && (
                        <ReferenceLine x={lsl} stroke="hsl(var(--destructive))" strokeDasharray="3 3">
                           <Label value="LSL" position="insideBottomLeft" fill="hsl(var(--destructive))" fontSize={12}/>
                        </ReferenceLine>
                      )}
                      {usl !== undefined && (
                       <ReferenceLine x={usl} stroke="hsl(var(--destructive))" strokeDasharray="3 3">
                         <Label value="USL" position="insideBottomRight" fill="hsl(var(--destructive))" fontSize={12}/>
                       </ReferenceLine>
                      )}
                       <ReferenceLine x={overallMean} stroke="hsl(var(--primary))" strokeDasharray="3 3">
                         <Label value="Mean" position="insideTopLeft" fill="hsl(var(--primary))" fontSize={12}/>
                       </ReferenceLine>
                    </ComposedChart>
                  </ChartContainer>
                </CardContent>
            </Card>
             <Card className="xl:col-span-1">
                <CardHeader><CardTitle>X Bar Chart</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <LineChart data={xBarChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="batch" />
                        <YAxis domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={tickFormatter} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line type="monotone" dataKey="mean" stroke="var(--color-mean)" />
                        <Line type="monotone" dataKey="ucl" stroke="var(--color-ucl)" strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="lcl" stroke="var(--color-lcl)" strokeDasharray="5 5" dot={false} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
            </Card>
            <Card className="xl:col-span-1">
                <CardHeader><CardTitle>Range Chart</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <LineChart data={rangeChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="batch" />
                        <YAxis />
                        <Tooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line type="monotone" dataKey="range" stroke="var(--color-range)" />
                        <Line type="monotone" dataKey="ucl" stroke="var(--color-ucl)" strokeDasharray="5 5" dot={false}/>
                        <Line type="monotone" dataKey="lcl" stroke="var(--color-lcl)" strokeDasharray="5 5" dot={false}/>
                    </LineChart>
                  </ChartContainer>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader><CardTitle>Numerical Results</CardTitle></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-1/4">Category</TableHead>
                            <TableHead className="w-1/4">Metric</TableHead>
                            <TableHead className="text-right w-1/2">Value</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {/* Specifications */}
                        <TableRow className="bg-muted/50 font-semibold">
                            <TableCell colSpan={3}>Specifications</TableCell>
                        </TableRow>
                        <TableRow><TableCell></TableCell><TableCell>Lower Spec Limit (LSL)</TableCell><TableCell className="text-right">{lsl?.toFixed(3) ?? 'N/A'}</TableCell></TableRow>
                        <TableRow><TableCell></TableCell><TableCell>Target</TableCell><TableCell className="text-right">{target.toFixed(3) ?? 'N/A'}</TableCell></TableRow>
                        <TableRow><TableCell></TableCell><TableCell>Upper Spec Limit (USL)</TableCell><TableCell className="text-right">{usl?.toFixed(3) ?? 'N/A'}</TableCell></TableRow>
                         <TableRow><TableCell></TableCell><TableCell>Spec Range (Tolerance)</TableCell><TableCell className="text-right">{(usl !== undefined && lsl !== undefined) ? (usl-lsl).toFixed(3) : 'N/A'}</TableCell></TableRow>
                        
                        {/* Capability (Within) */}
                         <TableRow className="bg-muted/50 font-semibold">
                            <TableCell colSpan={3}>Process Capability (Within)</TableCell>
                        </TableRow>
                        <TableRow><TableCell></TableCell><TableCell>Cp</TableCell><TableCell className="text-right">{cp.toFixed(3)}</TableCell></TableRow>
                        <TableRow><TableCell></TableCell><TableCell>Cpk</TableCell><TableCell className="text-right">{cpk.toFixed(3)}</TableCell></TableRow>
                        <TableRow><TableCell></TableCell><TableCell>Sigma (Within)</TableCell><TableCell className="text-right">{withinStdDev.toFixed(3)}</TableCell></TableRow>

                        {/* Capability (Overall) */}
                        <TableRow className="bg-muted/50 font-semibold">
                            <TableCell colSpan={3}>Process Capability (Overall)</TableCell>
                        </TableRow>
                        <TableRow><TableCell></TableCell><TableCell>Pp</TableCell><TableCell className="text-right">{pp.toFixed(3)}</TableCell></TableRow>
                        <TableRow><TableCell></TableCell><TableCell>Ppk</TableCell><TableCell className="text-right">{ppk.toFixed(3)}</TableCell></TableRow>
                        <TableRow><TableCell></TableCell><TableCell>Sigma (Overall)</TableCell><TableCell className="text-right">{overallStdDev.toFixed(3)}</TableCell></TableRow>
                        <TableRow><TableCell></TableCell><TableCell>Defective Parts Per Million (PPM)</TableCell><TableCell className="text-right">{ppm.toLocaleString(undefined, { maximumFractionDigits: 0})}</TableCell></TableRow>
                        
                        {/* Performance */}
                        <TableRow className="bg-muted/50 font-semibold">
                            <TableCell colSpan={3}>Process Performance</TableCell>
                        </TableRow>
                        <TableRow><TableCell></TableCell><TableCell>% Below LSL</TableCell><TableCell className="text-right">{percentBelowLsl.toFixed(3)}%</TableCell></TableRow>
                        <TableRow><TableCell></TableCell><TableCell>% Above USL</TableCell><TableCell className="text-right">{percentAboveUsl.toFixed(3)}%</TableCell></TableRow>
                        <TableRow><TableCell></TableCell><TableCell>Total % Outside Spec</TableCell><TableCell className="text-right">{(percentBelowLsl + percentAboveUsl).toFixed(3)}%</TableCell></TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
