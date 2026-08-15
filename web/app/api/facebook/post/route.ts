import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/platforms";
import { db } from "@/lib/db";
import { posted, queue, drafts } from "@/lib/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/facebook/post
 * Publish to a Facebook Page. Body: { text, imagePath?, queueId?, draftId? }
 * Text-only and photo posts are both supported.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, imagePath, queueId, draftId } = body;

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "Post text is required" },
        { status: 400 }
      );
    }

    const client = getClient("facebook");

    if (!client.isConfigured()) {
      return NextResponse.json(
        {
          error:
            "Facebook API not configured. Set FACEBOOK_PAGE_ID and META_ACCESS_TOKEN in .env",
        },
        { status: 503 }
      );
    }

    const result = await client.post(text, imagePath);

    // Save to posted table
    const [postedItem] = await db
      .insert(posted)
      .values({
        queueId: queueId || null,
        draftId: draftId || null,
        postId: result.postId,
        platform: "facebook",
        text,
        imagePath,
        postedAt: new Date(),
      })
      .returning();

    // Update queue item if from queue
    if (queueId) {
      await db
        .update(queue)
        .set({
          status: "posted",
          postedAt: new Date(),
          postId: result.postId,
          postUrl: result.postUrl,
        })
        .where(eq(queue.id, queueId));
    }

    // Update draft status if from draft
    if (draftId) {
      await db
        .update(drafts)
        .set({ status: "posted" })
        .where(eq(drafts.id, draftId));
    }

    return NextResponse.json({
      success: true,
      postId: result.postId,
      postUrl: result.postUrl,
      posted: postedItem,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to post to Facebook",
      },
      { status: 500 }
    );
  }
}
