// ─── TREND RESEARCH & ALERT SYSTEM ───────────────────────────────────────────
// Coordinates trend research across all platforms and detects high-impact opportunities.

import { db } from "./db";
import { trendCache, drafts } from "./schema";
import { eq, desc } from "drizzle-orm";
import { generateJSON, createServerGenerateFn } from "./ai";
import { getBrandPrompt } from "./brand";
import type { Platform } from "./agents/types";
import { twitterBot } from "./agents/twitter-bot";
import { instagramBot } from "./agents/instagram-bot";
import { facebookBot } from "./agents/facebook-bot";
import { linkedinBot } from "./agents/linkedin-bot";
import { managerBot } from "./agents/manager";

interface TrendResult {
  name: string;
  volume?: number;
  category?: string;
  velocity?: string;
  relevanceScore?: number;
  suggestedAngle?: string;
}

/**
 * Fetch cached trends for a platform.
 * Returns null if cache is expired (>2 hours old).
 */
export async function getCachedTrends(platform: Platform) {
  const results = await db
    .select()
    .from(trendCache)
    .where(eq(trendCache.platform, platform))
    .orderBy(desc(trendCache.fetchedAt))
    .limit(1);

  if (results.length === 0) return null;

  const entry = results[0];
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  if (new Date(entry.fetchedAt) < twoHoursAgo) {
    return null; // Expired
  }

  return entry;
}

/**
 * Research trends for a specific platform using AI.
 */
export async function researchTrends(platform: Platform): Promise<TrendResult[]> {
  const generateFn = createServerGenerateFn(platform as "twitter" | "instagram" | "facebook" | "linkedin", "research_trends");

  let trends: TrendResult[] = [];

  switch (platform) {
    case "twitter":
      trends = await twitterBot.researchTrends(generateFn);
      break;
    case "instagram":
      trends = await instagramBot.researchTrends(generateFn);
      break;
    case "facebook":
      trends = await facebookBot.researchTrends(generateFn);
      break;
    case "linkedin":
      trends = await linkedinBot.researchTrends(generateFn);
      break;
  }

  // Save to trend_cache
  if (trends.length > 0) {
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    await db.insert(trendCache).values({
      platform,
      trends: trends as unknown as { name: string; volume?: number; category?: string; velocity?: string; relevanceScore?: number; suggestedAngle?: string }[],
      hashtags: trends
        .filter((t) => t.name.startsWith("#"))
        .map((t) => ({ tag: t.name })),
      fetchedAt: new Date(),
      expiresAt,
    });
  }

  return trends;
}

/**
 * Get trends for a platform — from cache if fresh, otherwise research.
 */
export async function getTrends(platform: Platform): Promise<{
  trends: TrendResult[];
  fromCache: boolean;
  fetchedAt: Date;
}> {
  const cached = await getCachedTrends(platform);

  if (cached) {
    return {
      trends: cached.trends as unknown as TrendResult[],
      fromCache: true,
      fetchedAt: new Date(cached.fetchedAt),
    };
  }

  const trends = await researchTrends(platform);
  return {
    trends,
    fromCache: false,
    fetchedAt: new Date(),
  };
}

/**
 * Check for high-impact trends across all platforms.
 * Called by scheduler every 30 minutes.
 */
export async function checkForHighImpactTrends(): Promise<{
  alerts: Array<{
    platform: Platform;
    trend: TrendResult;
    urgency: "high" | "medium";
    draftId?: number;
  }>;
}> {
  const platforms: Platform[] = ["twitter", "instagram", "facebook", "linkedin"];
  const alerts: Array<{
    platform: Platform;
    trend: TrendResult;
    urgency: "high" | "medium";
    draftId?: number;
  }> = [];

  for (const platform of platforms) {
    try {
      const { trends } = await getTrends(platform);

      for (const trend of trends) {
        if (trend.relevanceScore && trend.relevanceScore > 0.8) {
          // High-impact trend detected — auto-generate draft
          const generateFn = createServerGenerateFn("manager", "trend_auto_generate");

          const result = await managerBot.handleTrendAlert(
            platform,
            trend,
            generateFn
          );

          let draftId: number | undefined;

          // Save auto-generated draft
          if (result.generatedDraft) {
            const [inserted] = await db
              .insert(drafts)
              .values({
                text: result.generatedDraft.text,
                platform,
                source: "trend",
                hashtags: result.generatedDraft.hashtags,
                status: "pending",
                generatedBy: platform as "twitter" | "instagram" | "facebook" | "linkedin",
                targetIndustry: result.generatedDraft.targetIndustry,
              })
              .returning({ id: drafts.id });

            draftId = inserted?.id;
          }

          alerts.push({
            platform,
            trend,
            urgency: result.urgency as "high" | "medium",
            draftId,
          });
        }
      }
    } catch (err) {
      console.error(`Trend check failed for ${platform}:`, err);
    }
  }

  return { alerts };
}

/**
 * Find trends that appear across multiple platforms.
 */
export async function findCrossPlatformTrends(
  allTrends: Record<Platform, TrendResult[]>
): Promise<TrendResult[]> {
  const trendNames = new Map<string, { count: number; platforms: Platform[]; trend: TrendResult }>();

  for (const [platform, trends] of Object.entries(allTrends) as [Platform, TrendResult[]][]) {
    for (const trend of trends) {
      const key = trend.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const existing = trendNames.get(key);
      if (existing) {
        existing.count++;
        existing.platforms.push(platform);
      } else {
        trendNames.set(key, { count: 1, platforms: [platform], trend });
      }
    }
  }

  return Array.from(trendNames.values())
    .filter((t) => t.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map((t) => ({
      ...t.trend,
      category: `Trending on ${t.platforms.join(", ")}`,
    }));
}
