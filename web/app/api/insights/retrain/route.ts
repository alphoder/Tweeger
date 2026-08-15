import { NextResponse } from "next/server";
import { analyzePerformance } from "@/lib/learning";

/**
 * POST /api/insights/retrain
 * Force-runs the self-learning analysis
 */
export async function POST() {
  try {
    const insightsGenerated = await analyzePerformance();
    return NextResponse.json({ ok: true, insightsGenerated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Retrain failed" },
      { status: 500 }
    );
  }
}
