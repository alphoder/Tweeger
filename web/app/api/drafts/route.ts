import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { drafts } from "@/lib/schema";
import { desc, eq, and, sql, count } from "drizzle-orm";

/**
 * GET /api/drafts
 * List drafts with filters, sorted by created_at desc, with pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const platform = searchParams.get("platform");
    const industry = searchParams.get("industry");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) conditions.push(eq(drafts.status, status as "pending" | "approved" | "rejected" | "posted" | "archived"));
    if (source) conditions.push(eq(drafts.source, source as "manual" | "ai_generated" | "trend" | "event" | "campaign" | "ad_copy" | "manager_bot"));
    if (platform) conditions.push(eq(drafts.platform, platform as "twitter" | "linkedin" | "instagram" | "facebook"));
    if (industry) conditions.push(eq(drafts.targetIndustry, industry));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      db
        .select()
        .from(drafts)
        .where(where)
        .orderBy(desc(drafts.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(drafts)
        .where(where),
    ]);

    return NextResponse.json({
      drafts: items,
      total: Number(totalResult[0]?.total || 0),
      page,
      limit,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch drafts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/drafts
 * Create a new draft.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      text,
      imagePath,
      platform = "twitter",
      source = "manual",
      hashtags = [],
      targetIndustry,
      aiScore,
      aiAnalysis,
      generatedBy,
      parentDraftId,
    } = body;

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "Post text is required" },
        { status: 400 }
      );
    }

    const [draft] = await db
      .insert(drafts)
      .values({
        text: text.trim(),
        imagePath,
        platform,
        source,
        hashtags,
        targetIndustry,
        aiScore,
        aiAnalysis,
        generatedBy,
        parentDraftId,
        status: "pending",
      })
      .returning();

    return NextResponse.json(draft, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create draft" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/drafts
 * Update a draft by ID (pass id in body).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Draft ID is required" }, { status: 400 });
    }

    // Only allow updating known fields
    const allowed: Record<string, unknown> = {};
    const fields = [
      "text",
      "imagePath",
      "platform",
      "hashtags",
      "status",
      "aiAnalysis",
      "aiScore",
      "targetIndustry",
    ];
    for (const f of fields) {
      if (updates[f] !== undefined) allowed[f] = updates[f];
    }

    if (updates.status === "approved" || updates.status === "rejected") {
      (allowed as Record<string, unknown>).reviewedAt = new Date();
    }

    const [updated] = await db
      .update(drafts)
      .set(allowed)
      .where(eq(drafts.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update draft" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/drafts?id=123
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "0");

    if (!id) {
      return NextResponse.json({ error: "Draft ID is required" }, { status: 400 });
    }

    await db.delete(drafts).where(eq(drafts.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete draft" },
      { status: 500 }
    );
  }
}
