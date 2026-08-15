// ─── BRAND PROFILES API ────────────────────────────────────────────────────
// CRUD operations for brand profiles.
// GET: list all brands or get a single brand by id
// POST: create brand from extracted data (use /api/brand/extract first for preview)
// PATCH: update brand profile fields
// DELETE: delete brand (cascades to platform_strategies, review_queue, etc.)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { brandProfiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  extractFromURL,
  extractFromText,
  extractFromSocial,
  toNewBrandProfile,
} from "@/lib/brand-extraction";

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const brand = await db.query.brandProfiles.findFirst({
        where: eq(brandProfiles.id, parseInt(id)),
      });

      if (!brand) {
        return NextResponse.json(
          { error: "Brand not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(brand);
    }

    // List all brands
    const brands = await db.query.brandProfiles.findMany({
      orderBy: (b, { desc }) => [desc(b.createdAt)],
    });

    return NextResponse.json(brands);
  } catch (error) {
    console.error("Brand GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch brands" },
      { status: 500 }
    );
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { source, value, extractedData } = body as {
      source: "url" | "text" | "social" | "manual";
      value?: string;
      extractedData?: Record<string, unknown>;
    };

    let brandData: Record<string, unknown>;

    if (extractedData) {
      // User already extracted & reviewed — save directly
      brandData = toNewBrandProfile(extractedData as unknown as Parameters<typeof toNewBrandProfile>[0]);
    } else if (source === "url" && value) {
      const extracted = await extractFromURL(value);
      brandData = toNewBrandProfile(extracted);
    } else if (source === "text" && value) {
      const extracted = await extractFromText(value);
      brandData = toNewBrandProfile(extracted);
    } else if (source === "social" && value) {
      const extracted = await extractFromSocial(value);
      brandData = toNewBrandProfile(extracted);
    } else if (source === "manual") {
      // Direct manual creation with provided fields
      brandData = {
        name: body.name || "Unnamed Brand",
        industry: body.industry || "General",
        description: body.description || "",
        valueProposition: body.valueProposition || "",
        tone: body.tone || { primary: "Professional" },
        languagePreference: body.languagePreference || "english",
        automationMode: body.automationMode || "full_auto_generate",
        platformsActive: body.platformsActive || [
          "twitter",
          "linkedin",
          "instagram",
          "facebook",
        ],
        postsPerDayPerPlatform: body.postsPerDayPerPlatform || 1,
      };
    } else {
      return NextResponse.json(
        { error: "Invalid source or missing value" },
        { status: 400 }
      );
    }

    const [brand] = await db
      .insert(brandProfiles)
      .values(brandData as typeof brandProfiles.$inferInsert)
      .returning();

    return NextResponse.json(brand, { status: 201 });
  } catch (error) {
    console.error("Brand POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to create brand",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Brand id is required" },
        { status: 400 }
      );
    }

    // Set updatedAt
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(brandProfiles)
      .set(updates)
      .where(eq(brandProfiles.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Brand PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update brand" },
      { status: 500 }
    );
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Brand id is required" },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(brandProfiles)
      .where(eq(brandProfiles.id, parseInt(id)))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("Brand DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete brand" },
      { status: 500 }
    );
  }
}
