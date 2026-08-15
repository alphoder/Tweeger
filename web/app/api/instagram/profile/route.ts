import { NextResponse } from "next/server";
import { getClient } from "@/lib/platforms";

/**
 * GET /api/instagram/profile
 * Fetch Instagram Business/Creator account profile data
 */
export async function GET() {
  try {
    const client = getClient("instagram");

    if (!client.isConfigured()) {
      return NextResponse.json(
        {
          configured: false,
          error:
            "Instagram not configured. Set INSTAGRAM_ACCOUNT_ID and META_ACCESS_TOKEN.",
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
            : "Failed to fetch Instagram profile",
      },
      { status: 500 }
    );
  }
}
