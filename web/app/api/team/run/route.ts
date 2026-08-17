import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { drafts, reviewQueue, brandProfiles } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { getTrends } from "@/lib/trends";
import { runTeamPipeline, saveTranscript } from "@/lib/agents/team";
import { generateImage } from "@/lib/ai";
import { saveImage } from "@/lib/storage";
import { getBot } from "@/lib/telegram";
import { reviewLink } from "@/lib/review-token";

/**
 * POST /api/team/run — the agent team produces a post end-to-end:
 * research trends → draft → critique → revise → image → review item →
 * Telegram notification with a swipe-review link.
 *
 * Body: { direction?: string, withImage?: boolean, count?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const count = Math.min(Number(body.count) || 1, 5);

    // Trend context for Nova
    const { trends } = await getTrends("twitter");
    const trendContext =
      trends.length > 0
        ? trends
            .slice(0, 10)
            .map((t: { name: string; volume?: number | null }, i: number) => `${i + 1}. ${t.name}${t.volume ? ` (${t.volume} posts)` : ""}`)
            .join("\n")
        : "No live trend data — pick a strong evergreen angle in AI/ML, blockchain, or startups that feels current.";

    const [brand] = await db.select().from(brandProfiles).orderBy(desc(brandProfiles.createdAt)).limit(1);

    const results = [];
    for (let i = 0; i < count; i++) {
      const run = await runTeamPipeline({
        trendContext,
        userDirection: body.direction,
        withImage: body.withImage !== false,
        deep: !!body.deep,
      });

      // Generate the image Iris briefed
      let imagePath: string | null = null;
      if (run.imagePrompt) {
        try {
          const img = await generateImage(run.imagePrompt, { agent: "twitter", action: "team_image" });
          const saved = await saveImage(img.bytes, img.mimeType, "generated");
          imagePath = saved.url;
        } catch (err) {
          console.warn("[Team] Image generation failed:", err);
        }
      }

      // Create draft
      const [draft] = await db
        .insert(drafts)
        .values({
          brandId: brand?.id ?? null,
          text: run.tweet,
          imagePath,
          imagePrompt: run.imagePrompt,
          platform: "twitter",
          source: "auto_research",
          status: "pending",
          aiScore: run.criticScore,
          generatedBy: "twitter",
          researchBacking: { topic: run.topic, angle: run.angle },
        })
        .returning();

      // Create review item
      const suggestedTime = new Date(Date.now() + (2 + i * 3) * 60 * 60 * 1000);
      const [review] = await db
        .insert(reviewQueue)
        .values({
          brandId: brand?.id ?? draft.brandId ?? 1,
          draftId: draft.id,
          platform: "twitter",
          previewData: { text: run.tweet, imagePath, topic: run.topic, imagePrompt: run.imagePrompt, videoPrompt: run.videoPrompt, pack: run.pack },
          aiReasoning: `Topic: ${run.topic}. Angle: ${run.angle}.`,
          aiScore: run.criticScore,
          targetSignal: "replies",
          suggestedTime,
        })
        .returning();

      const conversationId = await saveTranscript({
        draftId: draft.id,
        reviewQueueId: review.id,
        topic: run.topic,
        transcript: run.transcript,
      });

      // Telegram: link to the swipe review page
      try {
        const link = await reviewLink(review.id);
        const adminId = process.env.TELEGRAM_ADMIN_ID;
        if (adminId) {
          await getBot().api.sendMessage(
            adminId,
            `🧠 *New post built by the team*\n\n_${run.topic}_\n\n"${run.tweet.slice(0, 140)}${run.tweet.length > 140 ? "..." : ""}"\n\nTake a look and swipe:\n${link}`,
            { parse_mode: "Markdown" }
          );
          // Hand the boss Venus's briefs to generate elsewhere
          if (run.imagePrompt && !imagePath) {
            await getBot().api.sendMessage(
              adminId,
              `🎨 Venus's image brief — paste into any generator and send the photo back here for her check:\n\n\`\`\`\n${run.imagePrompt}\n\`\`\`` +
                (run.videoPrompt ? `\n\n🎬 Video brief (reel/short):\n\n\`\`\`\n${run.videoPrompt}\n\`\`\`` : ""),
              { parse_mode: "Markdown" }
            );
          }
        }
      } catch (err) {
        console.warn("[Team] Telegram notify failed:", err);
      }

      results.push({
        draftId: draft.id,
        reviewId: review.id,
        conversationId,
        topic: run.topic,
        tweet: run.tweet,
        imagePath,
        criticScore: run.criticScore,
        transcript: run.transcript,
      });
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Team run failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/team/run?draftId=N — fetch the team transcript for a draft.
 */
export async function GET(request: NextRequest) {
  const { agentConversations } = await import("@/lib/schema");
  const draftId = Number(new URL(request.url).searchParams.get("draftId"));
  if (!draftId) return NextResponse.json({ error: "draftId required" }, { status: 400 });

  const rows = await db
    .select()
    .from(agentConversations)
    .where(eq(agentConversations.draftId, draftId))
    .orderBy(desc(agentConversations.createdAt))
    .limit(1);

  return NextResponse.json(rows[0] ?? null);
}
