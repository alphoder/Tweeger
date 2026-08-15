// ─── BRAND EXTRACTION PREVIEW API ──────────────────────────────────────────
// Extracts brand data from URL/text/social WITHOUT saving to database.
// Use this for preview mode in the Brand Setup onboarding flow.
// After user reviews and edits, POST to /api/brand to save.

import { NextRequest, NextResponse } from "next/server";
import {
  extractFromURL,
  extractFromText,
  extractFromSocial,
} from "@/lib/brand-extraction";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { source, value } = body as {
      source: "url" | "text" | "social";
      value: string;
    };

    if (!source || !value) {
      return NextResponse.json(
        { error: "source and value are required" },
        { status: 400 }
      );
    }

    let extracted;

    switch (source) {
      case "url":
        extracted = await extractFromURL(value);
        break;
      case "text":
        extracted = await extractFromText(value);
        break;
      case "social":
        extracted = await extractFromSocial(value);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid source. Must be 'url', 'text', or 'social'." },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      brand: extracted,
      source,
      extractedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Brand extraction error:", error);
    return NextResponse.json(
      {
        error: "Failed to extract brand data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
