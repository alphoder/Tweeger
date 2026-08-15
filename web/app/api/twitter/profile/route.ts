import { NextResponse } from "next/server";
import { getClient } from "@/lib/platforms";

/**
 * GET /api/twitter/profile
 * Get the authenticated Twitter profile.
 */
export async function GET() {
  try {
    const client = getClient("twitter");
    const profile = await client.getProfile();
    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
