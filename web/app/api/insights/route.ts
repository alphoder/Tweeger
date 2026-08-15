import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiInsights } from "@/lib/schema";
import { eq, desc, and, sql } from "drizzle-orm";

/**
 * GET /api/insights
 * Query AI insights with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const platform = searchParams.get("platform");
    const limit = parseInt(searchParams.get("limit") || "50");

    const conditions = [
      sql`(${aiInsights.expiresAt} IS NULL OR ${aiInsights.expiresAt} > now())`,
    ];

    if (type) {
      conditions.push(
        eq(
          aiInsights.type,
          type as
            | "performance"
            | "timing"
            | "content"
            | "audience"
            | "trend"
            | "competitor"
        )
      );
    }

    if (platform) {
      conditions.push(
        eq(
          aiInsights.platform,
          platform as "twitter" | "linkedin" | "instagram" | "facebook"
        )
      );
    }

    const insights = await db
      .select()
      .from(aiInsights)
      .where(and(...conditions))
      .orderBy(desc(aiInsights.confidence), desc(aiInsights.createdAt))
      .limit(limit);

    return NextResponse.json({ insights });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch insights" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/insights
 * Update insight (mark as applied, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, applied } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (applied !== undefined) updates.applied = applied;

    const [updated] = await db
      .update(aiInsights)
      .set(updates)
      .where(eq(aiInsights.id, id))
      .returning();

    return NextResponse.json({ insight: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/insights?id=123
 * Dismiss/delete an insight
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "0");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await db.delete(aiInsights).where(eq(aiInsights.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
