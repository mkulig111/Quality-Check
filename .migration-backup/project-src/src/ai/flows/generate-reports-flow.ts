
'use server';

/**
 * @fileOverview A flow for generating reports.
 */

import {ai, adminFirestore, adminStorage} from '@/ai/genkit';
import {z} from 'zod';
import {Timestamp} from 'firebase-admin/firestore';
import Papa from 'papaparse';
import {format} from 'date-fns';

const GenerateExportUrlInputSchema = z.object({
  department: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const generateExportUrlFlow = ai.defineFlow(
  {
    name: 'generateExportUrlFlow',
    inputSchema: GenerateExportUrlInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const { department, startDate, endDate } = input;
    
    // 1. Query Firestore
    const measurementsRef = adminFirestore.collection('measurements');
    const q = measurementsRef
      .where('department', '==', department)
      .where('timestamp', '>=', Timestamp.fromDate(new Date(startDate)))
      .where('timestamp', '<=', Timestamp.fromDate(new Date(endDate)));
      
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      throw new Error('No data found for the selected criteria.');
    }

    // 2. Process data for CSV
    const allFieldNames = new Set<string>();
    const measurementsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        if (data.measurements) {
            Object.keys(data.measurements).forEach(field => allFieldNames.add(field));
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

    // 3. Save to Cloud Storage
    const bucket = adminStorage.bucket();
    const filename = `exports/${department}-export-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    const file = bucket.file(filename);

    await file.save(Buffer.from(csv), {
        metadata: {
            contentType: 'text/csv',
        },
    });

    // 4. Generate Signed URL
    const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    return url;
  }
);
