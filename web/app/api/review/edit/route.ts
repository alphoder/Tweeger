// ─── REVIEW EDIT/DISCUSSION API ──────────────────────────────────────────────
// POST: send edit feedback → Manager Bot processes → regenerates → returns updated
// Tracks conversation in review_conversations
// Extracts user preferences for learning

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reviewQueue, reviewConversations, drafts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { generate } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reviewQueueId, message, draftId } = body as {
      reviewQueueId: number;
      message: string;
      draftId: number;
    };

    if (!reviewQueueId || !message || !draftId) {
      return NextResponse.json(
        { error: "reviewQueueId, draftId, and message are required" },
        { status: 400 }
      );
    }

    // Get the review queue item to extract brandId (required notNull field)
    const reviewItem = await db.query.reviewQueue.findFirst({
      where: eq(reviewQueue.id, reviewQueueId),
    });

    if (!reviewItem) {
      return NextResponse.json(
        { error: "Review queue item not found" },
        { status: 404 }
      );
    }

    // Get the current draft content
    const draft = await db.query.drafts.findFirst({
      where: eq(drafts.id, draftId),
    });

    if (!draft) {
      return NextResponse.json(
        { error: "Draft not found" },
        { status: 404 }
      );
    }

    // Update review status to in_discussion
    await db
      .update(reviewQueue)
      .set({ reviewStatus: "in_discussion" })
      .where(eq(reviewQueue.id, reviewQueueId));

    // Get or create conversation
    let conversation = await db.query.reviewConversations.findFirst({
      where: eq(reviewConversations.reviewQueueId, reviewQueueId),
    });

    const userMessage = {
      role: "user" as const,
      content: message,
      timestamp: new Date().toISOString(),
    };

    if (!conversation) {
      // Create new conversation — brandId comes from review queue item (notNull)
      const [newConv] = await db
        .insert(reviewConversations)
        .values({
          reviewQueueId,
          draftId,
          brandId: reviewItem.brandId,
          messages: [userMessage],
          editRequests: [
            {
              request: message,
              changesMade: "pending",
              oldVersion: draft.text,
              newVersion: "",
              timestamp: new Date().toISOString(),
            },
          ],
          totalEdits: 1,
          resolved: false,
        })
        .returning();
      conversation = newConv;
    } else {
      // Append to existing conversation
      const existingMessages = Array.isArray(conversation.messages)
        ? (conversation.messages as typeof conversation.messages)
        : [];
      const existingEdits = Array.isArray(conversation.editRequests)
        ? (conversation.editRequests as typeof conversation.editRequests)
        : [];

      await db
        .update(reviewConversations)
        .set({
          messages: [...existingMessages, userMessage],
          editRequests: [
            ...(existingEdits || []),
            {
              request: message,
              changesMade: "pending",
              oldVersion: draft.text,
              newVersion: "",
              timestamp: new Date().toISOString(),
            },
          ],
          totalEdits: (conversation.totalEdits || 0) + 1,
        })
        .where(eq(reviewConversations.id, conversation.id));
    }

    // Use Gemini to regenerate content based on feedback
    const systemPrompt = `You are an expert social media content editor. You have been given a ${draft.platform} post draft and user feedback requesting changes. Apply the changes while maintaining the post's intent, platform optimization, and brand voice.

CURRENT DRAFT:
${draft.text}

PLATFORM: ${draft.platform}
${draft.platform === "twitter" ? "Maximum 280 characters." : ""}
${draft.platform === "linkedin" ? "Maximum 1600 characters. Professional tone." : ""}
${draft.platform === "instagram" ? "Maximum 2200 characters. Visual storytelling." : ""}
${draft.platform === "facebook" ? "Maximum 500 characters for best engagement. Community-focused." : ""}

Respond ONLY with the revised post text. No explanations, no markdown, no quotes.`;

    const revisedContent = await generate(
      systemPrompt,
      `User feedback: "${message}"\n\nApply this feedback to the draft and return the revised post.`,
      {
        agent: "manager",
        action: "review_edit",
        temperature: 0.7,
      }
    );

    // Update the draft with revised content
    await db
      .update(drafts)
      .set({
        text: revisedContent.trim(),
      })
      .where(eq(drafts.id, draftId));

    // Add bot response to conversation
    const botMessage = {
      role: "manager_bot" as const,
      content: `I've updated the post based on your feedback. Here's the revised version.`,
      timestamp: new Date().toISOString(),
    };

    const currentMessages = Array.isArray(conversation.messages)
      ? (conversation.messages as typeof conversation.messages)
      : [];

    // Also update the last edit request with the actual changes
    const currentEdits = Array.isArray(conversation.editRequests)
      ? (conversation.editRequests as typeof conversation.editRequests)
      : [];

    const updatedEdits = [...(currentEdits || [])];
    if (updatedEdits.length > 0) {
      const lastEdit = updatedEdits[updatedEdits.length - 1];
      updatedEdits[updatedEdits.length - 1] = {
        ...lastEdit,
        changesMade: `Applied user feedback: ${message}`,
        newVersion: revisedContent.trim(),
      };
    }

    await db
      .update(reviewConversations)
      .set({
        messages: [...currentMessages, userMessage, botMessage],
        editRequests: updatedEdits,
        updatedAt: new Date(),
      })
      .where(eq(reviewConversations.id, conversation.id));

    return NextResponse.json({
      success: true,
      revisedContent: revisedContent.trim(),
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error("Review edit error:", error);
    return NextResponse.json(
      {
        error: "Failed to process edit",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
