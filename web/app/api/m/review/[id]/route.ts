import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reviewQueue, drafts, queue } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { verifyReviewToken } from "@/lib/review-token";

/**
 * Token-authenticated mobile review API.
 * GET  /api/m/review/[id]?t=token → review item + profile info for the preview
 * POST /api/m/review/[id]?t=token  { action: "approve" | "reject" }
 */

async function authed(request: NextRequest, id: number): Promise<boolean> {
  const token = new URL(request.url).searchParams.get("t");
  return verifyReviewToken(id, token);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (!id || !(await authed(request, id))) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const [item] = await db.select().from(reviewQueue).where(eq(reviewQueue.id, id)).limit(1);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Profile info for the tweet mockup (best effort)
  let profile: { name: string; handle: string; avatar: string | null } = {
    name: process.env.BRAND_NAME || "You",
    handle: "you",
    avatar: null,
  };
  try {
    const { getClient } = await import("@/lib/platforms");
    const client = getClient("twitter");
    if (client.isConfigured()) {
      const p = await client.getProfile();
      profile = {
        name: p.name || profile.name,
        handle: p.handle || profile.handle,
        avatar: p.profileImageUrl || null,
      };
    }
  } catch {
    // preview still works without live profile
  }

  return NextResponse.json({ item, profile });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (!id || !(await authed(request, id))) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as "approve" | "reject";
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }

  const [item] = await db.select().from(reviewQueue).where(eq(reviewQueue.id, id)).limit(1);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.reviewStatus !== "pending_review" && item.reviewStatus !== "in_discussion") {
    return NextResponse.json({ error: `Already ${item.reviewStatus}`, status: item.reviewStatus }, { status: 409 });
  }

  const now = new Date();

  if (action === "approve") {
    await db
      .update(reviewQueue)
      .set({ reviewStatus: "approved", reviewedAt: now })
      .where(eq(reviewQueue.id, id));
    await db.update(drafts).set({ status: "approved", reviewedAt: now }).where(eq(drafts.id, item.draftId));

    // Schedule into the queue at the suggested time (→ shows on the calendar)
    const preview = item.previewData as { text?: string; imagePath?: string | null };
    await db.insert(queue).values({
      draftId: item.draftId,
      platform: item.platform,
      text: preview.text || "",
      imagePath: preview.imagePath || null,
      scheduledTime: item.suggestedTime > now ? item.suggestedTime : new Date(now.getTime() + 60 * 60 * 1000),
      status: "scheduled",
    });

    return NextResponse.json({ ok: true, status: "approved", scheduledTime: item.suggestedTime });
  }

  await db
    .update(reviewQueue)
    .set({ reviewStatus: "rejected", reviewedAt: now })
    .where(eq(reviewQueue.id, id));
  await db.update(drafts).set({ status: "rejected", reviewedAt: now }).where(eq(drafts.id, item.draftId));

  return NextResponse.json({ ok: true, status: "rejected" });
}
