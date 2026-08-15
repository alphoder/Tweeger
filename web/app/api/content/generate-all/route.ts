// ─── GENERATE FOR ALL PLATFORMS ──────────────────────────────────────────────
// Takes a post and generates platform-optimized versions for all 4 platforms,
// saves as drafts, and sends them all to the Review Deck.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { drafts, reviewQueue, brandProfiles } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { generateJSON } from "@/lib/ai";

const PLATFORMS = ["twitter", "linkedin", "instagram", "facebook"] as const;

const PLATFORM_RULES: Record<string, string> = {
  twitter:
    "Max 280 characters. Punchy, direct, hot take style. End with engagement hook or question. 2-3 hashtags inline.",
  linkedin:
    "Max 3000 chars. Professional, thought-leadership tone. Start with a strong hook line. Use line breaks for readability. End with a CTA. 3-5 hashtags at the end.",
  instagram:
    "Max 2200 chars. Visual storytelling tone. Start with a captivating hook. Use line breaks and emojis sparingly. End with a CTA. 20-30 hashtags at the bottom separated by dots.",
  facebook:
    "Conversational, personal tone. Start with a relatable story or question. Encourage comments. 1-2 hashtags max.",
};

interface GeneratedPost {
  platform: string;
  text: string;
  hashtags: string[];
  reasoning: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, hashtags, imagePath, industry, contentType } = body;

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "Post text is required" },
        { status: 400 }
      );
    }

    // Get active brand
    const brand = await db
      .select()
      .from(brandProfiles)
      .orderBy(desc(brandProfiles.createdAt))
      .limit(1);

    if (!brand[0]) {
      return NextResponse.json(
        { error: "No brand profile found. Please set up a brand first." },
        { status: 400 }
      );
    }

    const activeBrand = brand[0];

    // Generate platform-optimized versions using Gemini
    const systemPrompt = `You are a multi-platform social media manager for "${activeBrand.name}" (${activeBrand.industry}).
Brand description: ${activeBrand.description}
Value proposition: ${activeBrand.valueProposition}

Generate an optimized version of a post for EACH of these 4 platforms. Each version should be tailored to the platform's audience, format, and algorithm.

Platform rules:
${Object.entries(PLATFORM_RULES)
  .map(([p, rule]) => `- ${p}: ${rule}`)
  .join("\n")}

Return a JSON array with exactly 4 objects, one per platform:
[
  {
    "platform": "twitter",
    "text": "...",
    "hashtags": ["tag1", "tag2"],
    "reasoning": "One sentence on why this version works for this platform"
  },
  ...
]`;

    const userPrompt = `Original post concept:
"${text}"

${hashtags?.length ? `Suggested hashtags: ${hashtags.join(", ")}` : ""}
${industry ? `Industry focus: ${industry}` : ""}
${contentType ? `Content type: ${contentType}` : ""}

Generate 4 platform-optimized versions now.`;

    const generated = await generateJSON<GeneratedPost[]>(systemPrompt, userPrompt);

    if (!generated || !Array.isArray(generated) || generated.length === 0) {
      return NextResponse.json(
        { error: "AI generation failed" },
        { status: 500 }
      );
    }

    // Save each as a draft and create review queue items
    const createdItems = [];

    for (const post of generated) {
      const platformName = post.platform as (typeof PLATFORMS)[number];
      if (!PLATFORMS.includes(platformName)) continue;

      // Create draft
      const [draft] = await db
        .insert(drafts)
        .values({
          text: post.text,
          platform: platformName,
          source: "ai_generated",
          hashtags: post.hashtags || [],
          status: "pending",
          brandId: activeBrand.id,
          aiAnalysis: post.reasoning,
          imagePath: imagePath || undefined,
        })
        .returning();

      // Get next review order
      const existingItems = await db
        .select({ order: reviewQueue.reviewOrder })
        .from(reviewQueue)
        .orderBy(desc(reviewQueue.reviewOrder))
        .limit(1);

      const nextOrder = (existingItems[0]?.order ?? 0) + 1;

      // Create review queue item
      const [reviewItem] = await db
        .insert(reviewQueue)
        .values({
          brandId: activeBrand.id,
          draftId: draft.id,
          platform: platformName,
          reviewStatus: "pending_review",
          previewData: {
            text: post.text,
            hashtags: post.hashtags,
            imagePath: imagePath || null,
          },
          aiReasoning: post.reasoning || "Multi-platform AI generation",
          aiScore: 75,
          targetSignal: "engagement",
          suggestedTime: new Date(
            Date.now() + Math.random() * 24 * 60 * 60 * 1000
          ),
          reviewOrder: nextOrder,
          autoReplaceOnReject: false,
        })
        .returning();

      createdItems.push({
        draft,
        reviewItem,
        platform: platformName,
      });
    }

    return NextResponse.json({
      success: true,
      count: createdItems.length,
      items: createdItems.map((item) => ({
        draftId: item.draft.id,
        reviewId: item.reviewItem.id,
        platform: item.platform,
      })),
    });
  } catch (error) {
    console.error("Generate all error:", error);
    return NextResponse.json(
      { error: "Failed to generate multi-platform posts" },
      { status: 500 }
    );
  }
}
