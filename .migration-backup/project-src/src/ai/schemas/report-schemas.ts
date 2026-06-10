
import { z } from 'zod';

export const GenerateReportOutputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    reportsGenerated: z.number(),
});

export type GenerateReportOutput = z.infer<typeof GenerateReportOutputSchema>;
