import { NextRequest, NextResponse } from "next/server";
import { runDueJobs } from "@/lib/scheduler";

/**
 * POST /api/cron — invoked by the Cloudflare Workers scheduled handler
 * (one "* * * * *" trigger). Authenticated via Bearer CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ran = await runDueJobs();
  return NextResponse.json({ ok: true, ran });
}
