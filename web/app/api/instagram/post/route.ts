import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/platforms";
import { db } from "@/lib/db";
import { posted, queue, drafts } from "@/lib/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/instagram/post
 * Publish to Instagram. Body: { text, imagePath, queueId?, draftId? }
 * Instagram REQUIRES an image — text-only posts are not supported.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, imagePath, queueId, draftId } = body;

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "Caption text is required" },
        { status: 400 }
      );
    }

    if (!imagePath) {
      return NextResponse.json(
        { error: "Instagram requires an image. Provide imagePath." },
        { status: 400 }
      );
    }

    const client = getClient("instagram");

    if (!client.isConfigured()) {
      return NextResponse.json(
        {
          error:
            "Instagram API not configured. Set INSTAGRAM_ACCOUNT_ID and META_ACCESS_TOKEN in .env",
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
        platform: "instagram",
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
          err instanceof Error ? err.message : "Failed to post to Instagram",
      },
      { status: 500 }
    );
  }
}
