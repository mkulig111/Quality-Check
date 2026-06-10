
'use server';

/**
 * @fileOverview A flow for performing SPC analysis from data stored in Cloud Storage.
 */

import {ai, adminStorage} from '@/ai/genkit';
import {z} from 'zod';
import Papa from 'papaparse';
import { subDays, isWithinInterval, parseISO } from 'date-fns';


const SpcAnalysisInputSchema = z.object({
  department: z.string(),
  checksheetId: z.string(),
  fieldName: z.string(),
  lsl: z.number().optional(),
  usl: z.number().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  numberOfPoints: z.number().int().positive(),
});

const SpcAnalysisOutputSchema = z.object({
    values: z.array(z.number()),
    lsl: z.number().optional(),
    usl: z.number().optional(),
    foundPoints: z.number(),
});


export const spcFromStorageFlow = ai.defineFlow(
  {
    name: 'spcFromStorageFlow',
    inputSchema: SpcAnalysisInputSchema,
    outputSchema: SpcAnalysisOutputSchema,
  },
  async (input) => {
    const { department, checksheetId, fieldName, lsl, usl, startDate, endDate, numberOfPoints } = input;
    
    const bucket = adminStorage.bucket();
    const [files] = await bucket.getFiles({ prefix: `exports/${department}-export-` });

    if (files.length === 0) {
        throw new Error(`No export files found for the ${department} department.`);
    }

    const dateInterval = { start: new Date(startDate), end: new Date(endDate) };
    let allMeasurements: { timestamp: Date, value: number }[] = [];
    
    // Filter files by date from their filename, then download and parse them
    for (const file of files) {
        const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})\.csv$/);
        if (dateMatch) {
            const fileDate = parseISO(dateMatch[1]);
            // Check if file's date is within the requested range for analysis
            // We give a buffer of 1 day to account for how exports are named vs the data they contain.
            const bufferedInterval = { start: subDays(dateInterval.start, 1), end: dateInterval.end };
             if (isWithinInterval(fileDate, bufferedInterval)) {
                const [content] = await file.download();
                const parsed = Papa.parse(content.toString('utf8'), { header: true, skipEmptyLines: true });
                
                parsed.data.forEach((row: any) => {
                    const rowDate = row['Date'] ? new Date(`${row['Date']}T${row['Time'] || '00:00:00'}`) : null;

                    // The checksheet ID isn't in the CSV, so we rely on item name.
                    // This is a simplification. A real-world scenario might need more robust linking.
                    if (row['Item Name'] === checksheetId && row[fieldName] !== undefined && rowDate && isWithinInterval(rowDate, dateInterval)) {
                         const value = parseFloat(row[fieldName]);
                         if (!isNaN(value)) {
                            allMeasurements.push({ timestamp: rowDate, value });
                         }
                    }
                });
            }
        }
    }
    
    if (allMeasurements.length === 0) {
        return { values: [], lsl, usl, foundPoints: 0 };
    }

    // Sort by date and take the most recent points
    allMeasurements.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const finalValues = allMeasurements.slice(0, numberOfPoints).map(m => m.value).reverse(); // reverse for chronological chart

    return {
        values: finalValues,
        lsl,
        usl,
        foundPoints: allMeasurements.length,
    };
  }
);
