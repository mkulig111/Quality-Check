
'use server';

/**
 * @fileOverview A flow for automatically exporting the previous day's data for all departments.
 */

import {ai, adminFirestore, adminStorage} from '@/ai/genkit';
import {z} from 'zod';
import {Timestamp} from 'firebase-admin/firestore';
import Papa from 'papaparse';
import {format, subDays, startOfDay, endOfDay} from 'date-fns';

const DEPARTMENTS = ["Stamping", "Injection", "Assembly", "Extrusion"];

export const dailyExportFlow = ai.defineFlow(
  {
    name: 'dailyExportFlow',
    inputSchema: z.void(),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        exports: z.array(z.object({ department: z.string(), status: z.string(), path: z.string().optional(), error: z.string().optional() }))
    }),
  },
  async () => {
    const today = new Date();
    const yesterday = subDays(today, 1);
    const startDate = startOfDay(yesterday);
    const endDate = endOfDay(yesterday);
    const exportResults = [];

    // Query all measurements from yesterday first to avoid composite index issues.
    const measurementsRef = adminFirestore.collection('measurements');
    const q = measurementsRef
      .where('timestamp', '>=', Timestamp.fromDate(startDate))
      .where('timestamp', '<=', Timestamp.fromDate(endDate));
      
    const querySnapshot = await q.get();
    const allYesterdayMeasurements = querySnapshot.docs.map(doc => doc.data());

    for (const department of DEPARTMENTS) {
        try {
            // Filter the results for the current department in-memory.
            const departmentMeasurements = allYesterdayMeasurements.filter(m => m.department === department);

            if (departmentMeasurements.length === 0) {
                exportResults.push({ department, status: 'SKIPPED', message: 'No data found.' });
                continue;
            }

            const allFieldNames = new Set<string>();
            departmentMeasurements.forEach(data => {
                if (data.measurements) {
                    Object.keys(data.measurements).forEach(field => allFieldNames.add(field));
                }
            });

            const sortedFieldNames = Array.from(allFieldNames).sort();
            const headers = ['Item Name', 'Department', 'Date', 'Time', 'Inspector', ...sortedFieldNames];
            
            const dataToExport = departmentMeasurements.map(data => {
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

            const bucket = adminStorage.bucket();
            const filename = `exports/${department}-export-${format(yesterday, 'yyyy-MM-dd')}.csv`;
            const file = bucket.file(filename);

            await file.save(Buffer.from(csv), {
                metadata: {
                    contentType: 'text/csv',
                },
            });
            
            exportResults.push({ department, status: 'SUCCESS', path: file.name });
            
        } catch (error: any) {
            console.error(`Failed to export for department: ${department}`, error);
            exportResults.push({ department, status: 'FAILED', error: error.message });
        }
    }

    return {
        success: true,
        message: 'Daily export process completed.',
        exports: exportResults,
    };
  }
);
