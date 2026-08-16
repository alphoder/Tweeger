// ─── REVIEW QUEUE API ─────────────────────────────────────────────────────
// GET: fetch pending review items for a brand, sorted by reviewOrder
// PATCH: update review status (approve/reject), record reviewDurationMs
// POST: create a review item from a draft

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reviewQueue, drafts, queue, brandProfiles } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brandId");
    const status = searchParams.get("status") || "pending_review";

    const conditions = [];
    if (brandId) {
      conditions.push(eq(reviewQueue.brandId, parseInt(brandId)));
    }

    if (status && status !== "all") {
      conditions.push(
        eq(
          reviewQueue.reviewStatus,
          status as "pending_review" | "in_discussion" | "approved" | "rejected" | "replacement_pending"
        )
      );
    }

    const items = await db
      .select()
      .from(reviewQueue)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(reviewQueue.reviewOrder, desc(reviewQueue.createdAt));

    return NextResponse.json(items);
  } catch (error) {
    console.error("Review GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch review items" },
      { status: 500 }
    );
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let {
      brandId,
      draftId,
      platform,
      previewData,
      aiReasoning,
      aiScore,
      scoreBreakdown,
      targetSignal,
      suggestedTime,
      researchSummary,
    } = body;

    if (!draftId || !platform) {
      return NextResponse.json(
        { error: "draftId and platform are required" },
        { status: 400 }
      );
    }

    // Auto-detect brand if not provided
    if (!brandId) {
      const firstBrand = await db
        .select({ id: brandProfiles.id })
        .from(brandProfiles)
        .orderBy(desc(brandProfiles.createdAt))
        .limit(1);
      if (firstBrand[0]) {
        brandId = firstBrand[0].id;
      } else {
        return NextResponse.json(
          { error: "No brand profile found. Please set up a brand first." },
          { status: 400 }
        );
      }
    }

    // Get current max reviewOrder
    const existingItems = await db
      .select({ order: reviewQueue.reviewOrder })
      .from(reviewQueue)
      .where(eq(reviewQueue.reviewStatus, "pending_review"))
      .orderBy(desc(reviewQueue.reviewOrder))
      .limit(1);

    const nextOrder = (existingItems[0]?.order ?? 0) + 1;

    const [item] = await db
      .insert(reviewQueue)
      .values({
        brandId,
        draftId,
        platform,
        reviewStatus: "pending_review",
        previewData: previewData || {},
        aiReasoning: aiReasoning || "AI-generated content",
        aiScore: aiScore || 70,
        scoreBreakdown: scoreBreakdown || undefined,
        targetSignal: targetSignal || "engagement",
        suggestedTime: suggestedTime ? new Date(suggestedTime) : new Date(),
        researchSummary: researchSummary || undefined,
        reviewOrder: nextOrder,
        autoReplaceOnReject: false,
      })
      .returning();

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Review POST error:", error);
    return NextResponse.json(
      { error: "Failed to create review item" },
      { status: 500 }
    );
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action, reviewDurationMs } = body as {
      id: number;
      action: "approve" | "reject";
      reviewDurationMs?: number;
    };

    if (!id || !action) {
      return NextResponse.json(
        { error: "id and action are required" },
        { status: 400 }
      );
    }

    const item = await db.query.reviewQueue.findFirst({
      where: eq(reviewQueue.id, id),
    });

    if (!item) {
      return NextResponse.json(
        { error: "Review item not found" },
        { status: 404 }
      );
    }

    if (action === "approve") {
      const [updated] = await db
        .update(reviewQueue)
        .set({
          reviewStatus: "approved",
          reviewedAt: new Date(),
          reviewDurationMs: reviewDurationMs || undefined,
        })
        .where(eq(reviewQueue.id, id))
        .returning();

      // Update the draft status
      await db
        .update(drafts)
        .set({ status: "approved" })
        .where(eq(drafts.id, item.draftId));

      // Auto-schedule: move to queue with suggested time
      // Get the draft content for queue insertion
      const draft = await db.query.drafts.findFirst({
        where: eq(drafts.id, item.draftId),
      });

      if (draft) {
        const preview = item.previewData as { imagePath?: string | null } | null;
        await db.insert(queue).values({
          draftId: item.draftId,
          brandId: item.brandId,
          text: draft.text,
          imagePath: draft.imagePath || preview?.imagePath || null,
          platform: draft.platform,
          scheduledTime: item.suggestedTime,
          status: "scheduled",
          schedulingReasoning: "Auto-scheduled from Review Deck approval. AI suggested time.",
        });
      }

      return NextResponse.json({ success: true, item: updated, action: "approved" });
    } else {
      const [updated] = await db
        .update(reviewQueue)
        .set({
          reviewStatus: "rejected",
          reviewedAt: new Date(),
          reviewDurationMs: reviewDurationMs || undefined,
        })
        .where(eq(reviewQueue.id, id))
        .returning();

      await db
        .update(drafts)
        .set({ status: "rejected" })
        .where(eq(drafts.id, item.draftId));

      return NextResponse.json({ success: true, item: updated, action: "rejected" });
    }
  } catch (error) {
    console.error("Review PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update review item" },
      { status: 500 }
    );
  }
}
