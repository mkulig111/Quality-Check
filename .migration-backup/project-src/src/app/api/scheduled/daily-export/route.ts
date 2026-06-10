
import { dailyExportFlow } from '@/ai/flows/daily-export-flow';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // We can add a "cron secret" validation here for security if needed,
  // by checking a header sent from the Cloud Scheduler job.
  // For now, any GET request will trigger the flow.

  try {
    console.log('Starting daily export flow...');
    const result = await dailyExportFlow();
    console.log('Daily export flow completed:', result);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Error running daily export flow:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// Required for POST, PUT, PATCH, DELETE, but good practice to include
export async function HEAD(request: NextRequest) {
  return new Response(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  return new Response(null, { status: 405 });
}
