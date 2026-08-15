import { NextRequest, NextResponse } from "next/server";
import { getOptimalTime, getAlternativeTimes } from "@/lib/scheduling";

/**
 * GET /api/scheduling/recommend?platform=twitter
 * Get AI-recommended posting time + alternatives.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") || "twitter";

    const [recommendation, alternatives] = await Promise.all([
      getOptimalTime(platform),
      getAlternativeTimes(platform, 3),
    ]);

    return NextResponse.json({
      recommendation: {
        time: recommendation.time.toISOString(),
        confidence: recommendation.confidence,
        reasoning: recommendation.reasoning,
      },
      alternatives: alternatives.map((a) => ({
        time: a.time.toISOString(),
        confidence: a.confidence,
        reasoning: a.reasoning,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get recommendation" },
      { status: 500 }
    );
  }
}
