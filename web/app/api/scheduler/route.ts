import { NextRequest, NextResponse } from "next/server";
import { getSchedulerStatus, runJob } from "@/lib/scheduler";

/**
 * GET /api/scheduler — Get scheduler status
 * POST /api/scheduler — Manually trigger a job
 */
export async function GET() {
  try {
    const status = getSchedulerStatus();
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { job } = body;

    if (!job) {
      return NextResponse.json(
        { error: "job name required" },
        { status: 400 }
      );
    }

    const result = await runJob(job);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to run job" },
      { status: 500 }
    );
  }
}
