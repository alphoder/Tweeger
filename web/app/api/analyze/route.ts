import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posted, aiInsights } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { generate, generateJSON, analyzeImage } from "@/lib/ai";
import { TEAM } from "@/lib/agents/team";

/**
 * POST /api/analyze — the whole agent team audits your Twitter profile:
 * bio/positioning, recent posts, images, ideas, and a prioritized action plan.
 * Protected by session middleware.
 */
export async function POST() {
  try {
    // ── Gather raw material ─────────────────────────────────────────────
    let profileBlock = "Profile data unavailable.";
    let tweetsBlock = "No recent tweets available.";
    const imageUrls: string[] = [];

    try {
      const { getClient } = await import("@/lib/platforms");
      const client = getClient("twitter");
      if (client.isConfigured()) {
        const p = await client.getProfile();
        profileBlock = `Name: ${p.name}\nHandle: @${p.handle}\nBio: ${p.bio || "(none)"}\nFollowers: ${p.followers}\nFollowing: ${p.following}\nTotal posts: ${p.postCount}`;

        // Recent tweets straight from the API (best effort)
        try {
          const { TwitterApi } = await import("twitter-api-v2");
          const api = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY!,
            appSecret: process.env.TWITTER_API_SECRET!,
            accessToken: process.env.TWITTER_ACCESS_TOKEN!,
            accessSecret: process.env.TWITTER_ACCESS_SECRET!,
          });
          const me = await api.v2.me();
          const timeline = await api.v2.userTimeline(me.data.id, {
            max_results: 20,
            "tweet.fields": ["public_metrics", "created_at", "attachments"],
            expansions: ["attachments.media_keys"],
            "media.fields": ["url", "preview_image_url", "type"],
          });
          const tweets = timeline.data.data || [];
          if (tweets.length) {
            tweetsBlock = tweets
              .map((t, i) => {
                const m = t.public_metrics;
                return `${i + 1}. "${t.text.replace(/\n/g, " ").slice(0, 200)}" — ${m?.like_count ?? 0} likes, ${m?.retweet_count ?? 0} RTs, ${m?.reply_count ?? 0} replies, ${m?.impression_count ?? 0} views`;
              })
              .join("\n");
          }
          for (const media of timeline.includes?.media ?? []) {
            const url = media.url || media.preview_image_url;
            if (url && imageUrls.length < 3) imageUrls.push(url);
          }
        } catch (err) {
          console.warn("[Analyze] timeline fetch failed:", err);
        }
      }
    } catch (err) {
      console.warn("[Analyze] profile fetch failed:", err);
    }

    // Fallback: posts made through this app
    if (tweetsBlock === "No recent tweets available.") {
      const recent = await db
        .select()
        .from(posted)
        .where(eq(posted.platform, "twitter"))
        .orderBy(desc(posted.postedAt))
        .limit(15);
      if (recent.length) {
        tweetsBlock = recent
          .map((p, i) => `${i + 1}. "${p.text.replace(/\n/g, " ").slice(0, 200)}" — ${p.likes ?? 0} likes, ${p.shares ?? 0} RTs, ${p.comments ?? 0} replies`)
          .join("\n");
      }
    }

    const material = `PROFILE:\n${profileBlock}\n\nRECENT TWEETS:\n${tweetsBlock}`;
    const goal =
      "Goal: this account must read as a credible builder/pro in AI, ML, blockchain, and entrepreneurship — it is a public showcase profile.";

    const byKey = Object.fromEntries(TEAM.map((a) => [a.key, a]));

    // ── Run the specialists in parallel ─────────────────────────────────
    const [positioning, writing, ideas, imageNotes] = await Promise.all([
      // Saturn: positioning & topic mix
      generate(
        byKey.researcher.systemPrompt,
        `${goal}\n\n${material}\n\nAnalyze the POSITIONING: topic mix, timing, what's missing vs what's hot right now in AI/ML/blockchain/startup Twitter. 4-6 tight bullet points, each actionable.`,
        { action: "analyze_positioning", temperature: 0.6 }
      ),
      // Mars: brutal writing critique
      generate(
        byKey.critic.systemPrompt,
        `${goal}\n\n${material}\n\nCritique the WRITING of these tweets: hooks, AI-smell, voice consistency, engagement patterns. Call out specific tweets by number. 4-6 bullets, brutal and specific.`,
        { action: "analyze_writing", temperature: 0.5 }
      ),
      // Pluto: content ideas that fit
      generate(
        byKey.copywriter.systemPrompt,
        `${goal}\n\n${material}\n\nBased on what performs and what's missing, give 5 concrete NEXT POST ideas (one line each, with the hook written out). Number them.`,
        { action: "analyze_ideas", temperature: 0.9 }
      ),
      // Venus: image critique (vision, best effort)
      (async () => {
        if (!imageUrls.length) return "No recent images found on the timeline to review.";
        const notes: string[] = [];
        for (const url of imageUrls) {
          try {
            const note = await analyzeImage(
              url,
              "You are a visual director. In 2 sentences: does this image look professional and human-made (not AI-slop)? What one change would improve it?"
            );
            notes.push(note.trim());
          } catch {
            /* skip broken image */
          }
        }
        return notes.length ? notes.map((n, i) => `Image ${i + 1}: ${n}`).join("\n") : "Could not analyze recent images.";
      })(),
    ]);

    // ── Jupiter synthesizes the action plan ───────────────────────────────
    const plan = await generateJSON<{
      overallScore: number;
      headline: string;
      topPriorities: string[];
      summary: string;
    }>(
      byKey.manager.systemPrompt,
      `${goal}\n\nYour team reported:\n\nNOVA (positioning):\n${positioning}\n\nDEV (writing):\n${writing}\n\nRHEA (ideas):\n${ideas}\n\nIRIS (images):\n${imageNotes}\n\nSynthesize: score the profile 1-100 for "credible AI/ML/blockchain builder showcase", one headline verdict, top 5 priorities in order, and a 3-sentence summary. Return JSON: {"overallScore": number, "headline": string, "topPriorities": string[], "summary": string}`,
      { action: "analyze_plan", temperature: 0.4 }
    );

    // ── Persist the top priorities as insights ──────────────────────────
    try {
      for (const [i, priority] of plan.topPriorities.slice(0, 5).entries()) {
        await db.insert(aiInsights).values({
          platform: "twitter",
          type: "content",
          insight: priority,
          confidence: 0.9 - i * 0.05,
          data: { source: "profile_analysis", rank: i + 1 },
        });
      }
    } catch (err) {
      console.warn("[Analyze] failed to store insights:", err);
    }

    return NextResponse.json({
      ok: true,
      analyzedAt: new Date().toISOString(),
      overallScore: plan.overallScore,
      headline: plan.headline,
      summary: plan.summary,
      topPriorities: plan.topPriorities,
      sections: [
        { agent: "Saturn", designation: "Trend Researcher", emoji: "🔭", title: "Positioning & Topic Mix", content: positioning },
        { agent: "Mars", designation: "Critic", emoji: "🔎", title: "Writing Critique", content: writing },
        { agent: "Venus", designation: "Visual Director", emoji: "🎨", title: "Image Review", content: imageNotes },
        { agent: "Mercury", designation: "Copywriter", emoji: "✍️", title: "Next Post Ideas", content: ideas },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
