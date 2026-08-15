import { NextRequest, NextResponse } from "next/server";
import { getTrends, researchTrends } from "@/lib/trends";
import type { Platform } from "@/lib/agents/types";

const VALID_PLATFORMS = ["twitter", "instagram", "facebook", "linkedin"];

/**
 * GET /api/trends?platform=twitter
 * Returns cached trends (or researches fresh if expired).
 */
export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform");

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { error: "Valid platform required: twitter, instagram, facebook, linkedin" },
      { status: 400 }
    );
  }

  try {
    const result = await getTrends(platform as Platform);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch trends" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trends
 * Force-refresh trends for a platform.
 * Body: { platform: "twitter" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform } = body;

    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: "Valid platform required" },
        { status: 400 }
      );
    }

    const trends = await researchTrends(platform as Platform);

    return NextResponse.json({
      trends,
      fromCache: false,
      fetchedAt: new Date(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to research trends" },
      { status: 500 }
    );
  }
}
