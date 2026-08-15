import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { queue, drafts } from "@/lib/schema";
import { desc, eq, and, asc, count } from "drizzle-orm";

/**
 * GET /api/queue
 * List queue items with filters, sorted by scheduled_time asc.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const platform = searchParams.get("platform");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) conditions.push(eq(queue.status, status as "scheduled" | "posting" | "posted" | "failed" | "cancelled"));
    if (platform) conditions.push(eq(queue.platform, platform as "twitter" | "linkedin" | "instagram" | "facebook"));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortOrder = status === "posted"
      ? desc(queue.postedAt)
      : asc(queue.scheduledTime);

    const [items, totalResult] = await Promise.all([
      db
        .select()
        .from(queue)
        .where(where)
        .orderBy(sortOrder)
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(queue)
        .where(where),
    ]);

    return NextResponse.json({
      items,
      total: Number(totalResult[0]?.total || 0),
      page,
      limit,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch queue" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/queue
 * Create a queue item. If draftId is provided, update draft status to "approved".
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      draftId,
      text,
      imagePath,
      platform = "twitter",
      scheduledTime,
    } = body;

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "Post text is required" },
        { status: 400 }
      );
    }

    if (!scheduledTime) {
      return NextResponse.json(
        { error: "Scheduled time is required" },
        { status: 400 }
      );
    }

    // Create queue item
    const [item] = await db
      .insert(queue)
      .values({
        draftId: draftId || null,
        text: text.trim(),
        imagePath,
        platform,
        scheduledTime: new Date(scheduledTime),
        status: "scheduled",
      })
      .returning();

    // If from a draft, mark draft as approved
    if (draftId) {
      await db
        .update(drafts)
        .set({ status: "approved", reviewedAt: new Date() })
        .where(eq(drafts.id, draftId));
    }

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create queue item" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/queue
 * Update a queue item (reschedule, change status, update text).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Queue item ID is required" },
        { status: 400 }
      );
    }

    const allowed: Record<string, unknown> = {};
    if (updates.scheduledTime) allowed.scheduledTime = new Date(updates.scheduledTime);
    if (updates.status) allowed.status = updates.status;
    if (updates.text) allowed.text = updates.text;
    if (updates.imagePath !== undefined) allowed.imagePath = updates.imagePath;
    if (updates.error !== undefined) allowed.error = updates.error;

    const [updated] = await db
      .update(queue)
      .set(allowed)
      .where(eq(queue.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update queue item" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/queue?id=123
 * Remove from queue. If linked to a draft, revert draft status to "pending".
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "0");

    if (!id) {
      return NextResponse.json(
        { error: "Queue item ID is required" },
        { status: 400 }
      );
    }

    // Get the item first to check for linked draft
    const [item] = await db
      .select()
      .from(queue)
      .where(eq(queue.id, id));

    if (!item) {
      return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
    }

    // Delete the queue item
    await db.delete(queue).where(eq(queue.id, id));

    // Revert draft status if linked
    if (item.draftId) {
      await db
        .update(drafts)
        .set({ status: "pending", reviewedAt: null })
        .where(eq(drafts.id, item.draftId));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete queue item" },
      { status: 500 }
    );
  }
}
