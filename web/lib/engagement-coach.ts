// ─── ENGAGEMENT COACHING ENGINE ──────────────────────────────────────────────
// AI-powered reply coaching and golden hour monitoring.
// Generates suggested responses when posts get replies.
// Tracks engagement velocity for the critical first 60-90 minutes.

import { db } from "./db";
import { posted, aiInsights } from "./schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { generateJSON } from "./ai";

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface ReplyCoachingSuggestion {
  replyTo: string; // Summary of what user said
  suggestedReply: string;
  strategy: string;
  signalTarget: "reply_chain" | "bookmark" | "share";
  reasoning: string;
}

interface GoldenHourStatus {
  postId: string;
  platform: string;
  minutesSincePost: number;
  engagementVelocity: number; // engagements per minute
  currentEngagement: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    impressions: number;
  };
  performanceRating: "exceptional" | "good" | "average" | "below_average" | "needs_attention";
  recommendation: string;
}

interface CoachingReport {
  postId: number;
  platform: string;
  suggestions: ReplyCoachingSuggestion[];
  goldenHour: GoldenHourStatus | null;
  timestamp: string;
}

// ─── REPLY COACHING ──────────────────────────────────────────────────────────

/**
 * Generate AI-powered reply suggestions for a post that's getting engagement.
 * Platform-specific strategies based on algorithm intelligence.
 */
export async function generateReplyCoaching(
  postId: number,
  platform: string
): Promise<CoachingReport> {
  // Get the original post
  const post = await db.query.posted.findFirst({
    where: eq(posted.id, postId),
  });

  if (!post) {
    return {
      postId,
      platform,
      suggestions: [],
      goldenHour: null,
      timestamp: new Date().toISOString(),
    };
  }

  // Build platform-specific coaching prompt
  const platformRules = getPlatformReplyRules(platform);

  const systemPrompt = `You are an expert social media engagement coach. Your job is to help maximize post performance by suggesting optimal replies to comments/engagement.

PLATFORM: ${platform.toUpperCase()}
${platformRules}

ORIGINAL POST:
"${post.text}"

Current metrics: ${post.likes} likes, ${post.comments} comments, ${post.shares} shares, ${post.saves || 0} saves, ${post.impressions} impressions

Generate 3 suggested reply strategies that would maximize algorithmic boost based on platform-specific signals. Each reply should:
1. Continue the conversation (driving reply chains)
2. Provide additional value
3. Feel natural and human — never robotic

Return JSON array of objects with these fields:
- replyTo: string (what type of comment to reply to)
- suggestedReply: string (the actual reply text)
- strategy: string (what this reply achieves)
- signalTarget: "reply_chain" | "bookmark" | "share"
- reasoning: string (why this helps algorithmically)`;

  try {
    const suggestions = await generateJSON<ReplyCoachingSuggestion[]>(
      systemPrompt,
      `Generate 3 reply coaching suggestions for this ${platform} post. Focus on maximizing the platform's highest-weight engagement signals.`,
      {
        agent: "manager",
        action: "engagement_coaching",
        temperature: 0.8,
      }
    );

    // Calculate golden hour status
    const goldenHour = calculateGoldenHourStatus(post);

    return {
      postId,
      platform,
      suggestions: Array.isArray(suggestions) ? suggestions : [],
      goldenHour,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      postId,
      platform,
      suggestions: [],
      goldenHour: calculateGoldenHourStatus(post),
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── GOLDEN HOUR TRACKING ───────────────────────────────────────────────────

/**
 * Monitor engagement velocity for the critical first 60-90 minutes after posting.
 * This is when the algorithm decides whether to boost or suppress a post.
 */
function calculateGoldenHourStatus(
  post: typeof posted.$inferSelect
): GoldenHourStatus | null {
  if (!post.postId || !post.postedAt) return null;

  const now = new Date();
  const postedAt = new Date(post.postedAt);
  const minutesSincePost = (now.getTime() - postedAt.getTime()) / (1000 * 60);

  // Only track golden hour for posts within 120 minutes
  if (minutesSincePost > 120) return null;

  const totalEngagement =
    (post.likes || 0) +
    (post.comments || 0) +
    (post.shares || 0) +
    (post.saves || 0);

  const velocity = minutesSincePost > 0 ? totalEngagement / minutesSincePost : 0;

  // Performance thresholds (vary by platform)
  let performanceRating: GoldenHourStatus["performanceRating"] = "average";
  const platformThresholds = getGoldenHourThresholds(post.platform);

  if (velocity >= platformThresholds.exceptional) {
    performanceRating = "exceptional";
  } else if (velocity >= platformThresholds.good) {
    performanceRating = "good";
  } else if (velocity >= platformThresholds.average) {
    performanceRating = "average";
  } else if (velocity >= platformThresholds.belowAverage) {
    performanceRating = "below_average";
  } else {
    performanceRating = "needs_attention";
  }

  const recommendations: Record<GoldenHourStatus["performanceRating"], string> = {
    exceptional:
      "🔥 Exceptional performance! Engage with every reply quickly to keep momentum. Consider quote-tweeting/reposting with additional value.",
    good:
      "✅ Good velocity. Reply to comments within 15 minutes. Share the post to Stories/other channels.",
    average:
      "📊 Average start. Engage with all comments immediately. Consider boosting with a follow-up post or story.",
    below_average:
      "⚠️ Below average velocity. Reply to every comment ASAP. Share to Stories. Consider engaging in related conversations to drive traffic.",
    needs_attention:
      "🚨 Low engagement. Immediately engage in related conversations. Reply to your own post with additional value. Cross-promote on other platforms.",
  };

  return {
    postId: post.postId || String(post.id),
    platform: post.platform,
    minutesSincePost: Math.round(minutesSincePost),
    engagementVelocity: Math.round(velocity * 100) / 100,
    currentEngagement: {
      likes: post.likes || 0,
      comments: post.comments || 0,
      shares: post.shares || 0,
      saves: post.saves || 0,
      impressions: post.impressions || 0,
    },
    performanceRating,
    recommendation: recommendations[performanceRating],
  };
}

function getGoldenHourThresholds(platform: string): {
  exceptional: number;
  good: number;
  average: number;
  belowAverage: number;
} {
  const thresholds: Record<string, { exceptional: number; good: number; average: number; belowAverage: number }> = {
    twitter: { exceptional: 2.0, good: 1.0, average: 0.5, belowAverage: 0.2 },
    linkedin: { exceptional: 1.5, good: 0.8, average: 0.3, belowAverage: 0.1 },
    instagram: { exceptional: 3.0, good: 1.5, average: 0.7, belowAverage: 0.3 },
    facebook: { exceptional: 2.0, good: 1.0, average: 0.4, belowAverage: 0.15 },
  };

  return thresholds[platform] || thresholds.twitter;
}

// ─── PLATFORM-SPECIFIC REPLY RULES ──────────────────────────────────────────

function getPlatformReplyRules(platform: string): string {
  const rules: Record<string, string> = {
    twitter: `TWITTER REPLY RULES:
- Reply-to-reply chains have 150x weight vs likes — this is THE most important signal
- Ask follow-up questions that demand a response
- Share additional insights related to the reply
- Tag relevant people who might have interesting perspectives
- Reply within 30 minutes for maximum algorithmic benefit
- NEVER: generic "thanks!", one-word responses, engagement farming`,

    linkedin: `LINKEDIN REPLY RULES:
- Author replies within 30 minutes get +64% more engagement
- Thoughtful replies > quick ones — add genuine value
- Ask "What's been your experience with..." type questions
- Reference your expertise or share a relevant anecdote
- Use professional but warm tone
- Each author reply can double the post's lifetime reach`,

    instagram: `INSTAGRAM REPLY RULES:
- DM sends are the HIGHEST signal (50% more than any other)
- Create replies that make people want to share the conversation
- Ask specific questions, not generic ones
- Reply with additional tips/insights to drive saves
- Use relevant emojis naturally
- Pin the best comment to drive more engagement`,

    facebook: `FACEBOOK REPLY RULES:
- Meaningful interactions (comment replies) boost reach significantly
- Facebook tracks "conversation depth" — longer threads = more reach
- Reply with questions that invite further discussion
- Share relevant resources or additional context
- React to comments with diverse reactions (not just like)
- Community building tone > corporate response`,
  };

  return rules[platform] || rules.twitter;
}

// ─── RECENT POSTS NEEDING COACHING ──────────────────────────────────────────

/**
 * Find posts within the golden hour that need engagement coaching.
 * Returns posts that have received engagement but haven't been coached yet.
 */
export async function getPostsNeedingCoaching(
  brandId?: number
): Promise<{
  posts: {
    id: number;
    platform: string;
    text: string;
    minutesSincePost: number;
    totalEngagement: number;
    postId: string | null;
  }[];
}> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const conditions = [gte(posted.postedAt, twoHoursAgo)];
  if (brandId) {
    conditions.push(eq(posted.brandId, brandId));
  }

  const recentPosts = await db
    .select()
    .from(posted)
    .where(and(...conditions))
    .orderBy(desc(posted.postedAt));

  const postsWithEngagement = recentPosts
    .filter((p) => {
      const total =
        (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
      return total > 0;
    })
    .map((p) => ({
      id: p.id,
      platform: p.platform,
      text: p.text,
      minutesSincePost: Math.round(
        (Date.now() - new Date(p.postedAt).getTime()) / (1000 * 60)
      ),
      totalEngagement:
        (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0),
      postId: p.postId,
    }));

  return { posts: postsWithEngagement };
}

// ─── COACHING NOTIFICATION FORMATTER ─────────────────────────────────────────

/**
 * Format coaching data into a Telegram-friendly notification message.
 */
export function formatCoachingNotification(report: CoachingReport): string {
  let msg = `🎯 *Engagement Coaching — ${report.platform.charAt(0).toUpperCase() + report.platform.slice(1)}*\n\n`;

  if (report.goldenHour) {
    const gh = report.goldenHour;
    msg += `⏱ *Golden Hour Status* (${gh.minutesSincePost}min)\n`;
    msg += `Velocity: ${gh.engagementVelocity} eng/min\n`;
    msg += `${gh.recommendation}\n\n`;
    msg += `📊 ${gh.currentEngagement.likes}❤️ ${gh.currentEngagement.comments}💬 ${gh.currentEngagement.shares}🔁 ${gh.currentEngagement.saves}💾\n\n`;
  }

  if (report.suggestions.length > 0) {
    msg += `💡 *Reply Suggestions:*\n`;
    for (const s of report.suggestions.slice(0, 3)) {
      msg += `\n*When someone says:* ${s.replyTo}\n`;
      msg += `*Reply:* "${s.suggestedReply}"\n`;
      msg += `_${s.reasoning}_\n`;
    }
  }

  return msg;
}
