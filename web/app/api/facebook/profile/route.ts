import { NextResponse } from "next/server";
import { getClient } from "@/lib/platforms";

/**
 * GET /api/facebook/profile
 * Fetch Facebook Page profile data
 */
export async function GET() {
  try {
    const client = getClient("facebook");

    if (!client.isConfigured()) {
      return NextResponse.json(
        {
          configured: false,
          error:
            "Facebook not configured. Set FACEBOOK_PAGE_ID and META_ACCESS_TOKEN.",
        },
        { status: 200 }
      );
    }

    const profile = await client.getProfile();
    return NextResponse.json({ configured: true, profile });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to fetch Facebook profile",
      },
      { status: 500 }
    );
  }
}
