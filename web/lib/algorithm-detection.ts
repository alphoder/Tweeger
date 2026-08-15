// ─── ALGORITHM CHANGE DETECTION ENGINE ──────────────────────────────────────
// Rolling 14-day z-score analysis of engagement metrics per format.
// Detects statistically significant changes in platform algorithm behavior.
// Auto-adjusts platform_strategies when confidence > 0.7.

import { db } from "./db";
import {
  posted,
  aiInsights,
  platformStrategies,
  type BrandProfile,
} from "./schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface FormatMetrics {
  format: string;
  avgEngagement: number;
  avgReach: number;
  avgSaves: number;
  avgShares: number;
  avgComments: number;
  postCount: number;
}

interface AlgorithmAlert {
  platform: string;
  changeType: "format_boost" | "format_decline" | "signal_shift" | "timing_shift";
  description: string;
  oldValue: number;
  newValue: number;
  zScore: number;
  confidence: number;
  recommendation: string;
  detectedAt: string;
}

interface DetectionResult {
  alerts: AlgorithmAlert[];
  metricsAnalyzed: number;
  platformsChecked: string[];
  timestamp: string;
}

// ─── CORE DETECTION ──────────────────────────────────────────────────────────

/**
 * Detect algorithm changes by analyzing rolling 14-day metrics per format.
 * Uses z-scores to identify statistically significant deviations.
 */
export async function detectAlgorithmChanges(
  brandId?: number,
  platform?: string
): Promise<DetectionResult> {
  const alerts: AlgorithmAlert[] = [];
  const platforms = platform
    ? [platform]
    : ["twitter", "linkedin", "instagram", "facebook"];

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let totalMetrics = 0;

  for (const plat of platforms) {
    // Fetch recent posts (14 days) for this platform
    const recentConditions = [
      eq(posted.platform, plat as "twitter" | "linkedin" | "instagram" | "facebook"),
      gte(posted.postedAt, fourteenDaysAgo),
    ];
    if (brandId) {
      recentConditions.push(eq(posted.brandId, brandId));
    }

    const recentPosts = await db
      .select()
      .from(posted)
      .where(and(...recentConditions));

    // Fetch baseline posts (14-30 days ago) for comparison
    const baselineConditions = [
      eq(posted.platform, plat as "twitter" | "linkedin" | "instagram" | "facebook"),
      gte(posted.postedAt, thirtyDaysAgo),
      sql`${posted.postedAt} < ${fourteenDaysAgo}`,
    ];
    if (brandId) {
      baselineConditions.push(eq(posted.brandId, brandId));
    }

    const baselinePosts = await db
      .select()
      .from(posted)
      .where(and(...baselineConditions));

    totalMetrics += recentPosts.length + baselinePosts.length;

    // Skip if not enough data
    if (recentPosts.length < 3 || baselinePosts.length < 3) continue;

    // ── Compare engagement rates ──
    const recentEngagement = recentPosts
      .map((p) => p.engagementRate || 0)
      .filter((r) => r > 0);
    const baselineEngagement = baselinePosts
      .map((p) => p.engagementRate || 0)
      .filter((r) => r > 0);

    if (recentEngagement.length >= 3 && baselineEngagement.length >= 3) {
      const recentAvg = average(recentEngagement);
      const baselineAvg = average(baselineEngagement);
      const baselineStd = standardDeviation(baselineEngagement);

      if (baselineStd > 0) {
        const zScore = (recentAvg - baselineAvg) / baselineStd;

        if (Math.abs(zScore) > 2) {
          const direction = zScore > 0 ? "boost" : "decline";
          alerts.push({
            platform: plat,
            changeType: zScore > 0 ? "format_boost" : "format_decline",
            description: `Overall engagement rate ${direction} detected on ${plat}. Recent avg: ${(recentAvg * 100).toFixed(2)}% vs baseline: ${(baselineAvg * 100).toFixed(2)}%`,
            oldValue: baselineAvg,
            newValue: recentAvg,
            zScore,
            confidence: Math.min(0.95, 0.5 + Math.abs(zScore) * 0.15),
            recommendation:
              zScore > 0
                ? `${plat} algorithm is favoring your content. Increase posting frequency to capitalize.`
                : `${plat} engagement is declining. Review content format mix and timing.`,
            detectedAt: now.toISOString(),
          });
        }
      }
    }

    // ── Compare save rates (Instagram/LinkedIn signal) ──
    if (plat === "instagram" || plat === "linkedin") {
      const recentSaves = recentPosts
        .map((p) => p.saveRate || 0)
        .filter((r) => r > 0);
      const baselineSaves = baselinePosts
        .map((p) => p.saveRate || 0)
        .filter((r) => r > 0);

      if (recentSaves.length >= 3 && baselineSaves.length >= 3) {
        const recentSaveAvg = average(recentSaves);
        const baselineSaveAvg = average(baselineSaves);
        const baselineSaveStd = standardDeviation(baselineSaves);

        if (baselineSaveStd > 0) {
          const zScore = (recentSaveAvg - baselineSaveAvg) / baselineSaveStd;

          if (Math.abs(zScore) > 2) {
            alerts.push({
              platform: plat,
              changeType: "signal_shift",
              description: `Save rate ${zScore > 0 ? "increase" : "decrease"} on ${plat}. Recent: ${(recentSaveAvg * 100).toFixed(2)}% vs baseline: ${(baselineSaveAvg * 100).toFixed(2)}%`,
              oldValue: baselineSaveAvg,
              newValue: recentSaveAvg,
              zScore,
              confidence: Math.min(0.95, 0.5 + Math.abs(zScore) * 0.15),
              recommendation:
                zScore > 0
                  ? `Saves are up — algorithm may be weighting save signals more. Create more save-worthy content (checklists, guides, reference material).`
                  : `Save rate declining. Audit recent content for save-worthiness. Add "Save for later" CTAs.`,
              detectedAt: now.toISOString(),
            });
          }
        }
      }
    }

    // ── Compare share rates (strong signal on all platforms) ──
    const recentShares = recentPosts
      .map((p) => p.shareRate || 0)
      .filter((r) => r > 0);
    const baselineShares = baselinePosts
      .map((p) => p.shareRate || 0)
      .filter((r) => r > 0);

    if (recentShares.length >= 3 && baselineShares.length >= 3) {
      const recentShareAvg = average(recentShares);
      const baselineShareAvg = average(baselineShares);
      const baselineShareStd = standardDeviation(baselineShares);

      if (baselineShareStd > 0) {
        const zScore = (recentShareAvg - baselineShareAvg) / baselineShareStd;

        if (Math.abs(zScore) > 2) {
          alerts.push({
            platform: plat,
            changeType: "signal_shift",
            description: `Share rate shift on ${plat}. Recent: ${(recentShareAvg * 100).toFixed(2)}% vs baseline: ${(baselineShareAvg * 100).toFixed(2)}%`,
            oldValue: baselineShareAvg,
            newValue: recentShareAvg,
            zScore,
            confidence: Math.min(0.95, 0.5 + Math.abs(zScore) * 0.15),
            recommendation:
              zScore > 0
                ? `Shares are up — create more shareable content (relatable observations, useful tips, "send this to someone" posts).`
                : `Share rate declining. Focus on creating content people want to forward — practical tips, relatable insights.`,
            detectedAt: now.toISOString(),
          });
        }
      }
    }

    // ── Reply depth analysis (Twitter signal) ──
    if (plat === "twitter") {
      const recentReplyDepth = recentPosts.map((p) => p.replyDepth || 0);
      const baselineReplyDepth = baselinePosts.map((p) => p.replyDepth || 0);

      if (recentReplyDepth.length >= 3 && baselineReplyDepth.length >= 3) {
        const recentDepthAvg = average(recentReplyDepth);
        const baselineDepthAvg = average(baselineReplyDepth);
        const baselineDepthStd = standardDeviation(baselineReplyDepth);

        if (baselineDepthStd > 0) {
          const zScore = (recentDepthAvg - baselineDepthAvg) / baselineDepthStd;

          if (Math.abs(zScore) > 1.5) {
            alerts.push({
              platform: plat,
              changeType: "signal_shift",
              description: `Reply chain depth ${zScore > 0 ? "increase" : "decrease"} on Twitter. Recent avg: ${recentDepthAvg.toFixed(1)} vs baseline: ${baselineDepthAvg.toFixed(1)}`,
              oldValue: baselineDepthAvg,
              newValue: recentDepthAvg,
              zScore,
              confidence: Math.min(0.9, 0.5 + Math.abs(zScore) * 0.15),
              recommendation:
                zScore > 0
                  ? `Great reply engagement! Keep asking questions and responding quickly to build conversation chains (150x weight in Twitter algo).`
                  : `Reply depth declining. End tweets with specific questions. Reply to responses within 30 minutes.`,
              detectedAt: now.toISOString(),
            });
          }
        }
      }
    }
  }

  // ── Auto-apply strategy adjustments for high-confidence alerts ──
  for (const alert of alerts) {
    // Log to ai_insights
    await db.insert(aiInsights).values({
      brandId: brandId || null,
      type: "algorithm_change",
      platform: alert.platform as "twitter" | "linkedin" | "instagram" | "facebook",
      insight: alert.description,
      data: {
        changeType: alert.changeType,
        oldValue: alert.oldValue,
        newValue: alert.newValue,
        zScore: alert.zScore,
        recommendation: alert.recommendation,
      },
      confidence: alert.confidence,
      applied: false,
      autoApplied: alert.confidence >= 0.7,
      strategyChange: alert.confidence >= 0.7 ? alert.recommendation : null,
    });

    // Auto-adjust strategy if confidence is high enough
    if (alert.confidence >= 0.7 && brandId) {
      await autoAdjustStrategy(
        brandId,
        alert.platform as "twitter" | "linkedin" | "instagram" | "facebook",
        alert
      );
    }
  }

  return {
    alerts,
    metricsAnalyzed: totalMetrics,
    platformsChecked: platforms,
    timestamp: now.toISOString(),
  };
}

// ─── AUTO-ADJUST STRATEGY ────────────────────────────────────────────────────

async function autoAdjustStrategy(
  brandId: number,
  platform: "twitter" | "linkedin" | "instagram" | "facebook",
  alert: AlgorithmAlert
) {
  try {
    const strategy = await db.query.platformStrategies.findFirst({
      where: and(
        eq(platformStrategies.brandId, brandId),
        eq(platformStrategies.platform, platform)
      ),
    });

    if (!strategy) return;

    const currentStrategy = strategy.strategy;

    // Adjust algorithm focus based on signal shift
    if (alert.changeType === "signal_shift") {
      const updatedStrategy = {
        ...currentStrategy,
        algorithmFocus: {
          ...currentStrategy.algorithmFocus,
          primarySignal: alert.newValue > alert.oldValue
            ? (alert.description.includes("Save") ? "saves" : alert.description.includes("Share") ? "shares" : "replies")
            : currentStrategy.algorithmFocus?.primarySignal,
        },
      };

      await db
        .update(platformStrategies)
        .set({
          strategy: updatedStrategy,
          updatedAt: new Date(),
        })
        .where(eq(platformStrategies.id, strategy.id));
    }
  } catch {
    console.error("Failed to auto-adjust strategy:", alert.platform);
  }
}

// ─── STATISTICAL HELPERS ─────────────────────────────────────────────────────

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = average(values);
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
}

// ─── GET ALGORITHM INSIGHTS ──────────────────────────────────────────────────

/**
 * Fetch recent algorithm change insights for display in dashboard.
 */
export async function getAlgorithmInsights(
  brandId?: number,
  limit = 10
): Promise<{
  insights: {
    id: number;
    platform: string | null;
    insight: string;
    confidence: number;
    autoApplied: boolean;
    strategyChange: string | null;
    createdAt: Date;
    data: Record<string, unknown>;
  }[];
}> {
  const conditions = [eq(aiInsights.type, "algorithm_change")];

  if (brandId) {
    conditions.push(eq(aiInsights.brandId, brandId));
  }

  const insights = await db
    .select()
    .from(aiInsights)
    .where(and(...conditions))
    .orderBy(desc(aiInsights.createdAt))
    .limit(limit);

  return {
    insights: insights.map((i) => ({
      id: i.id,
      platform: i.platform,
      insight: i.insight,
      confidence: i.confidence,
      autoApplied: i.autoApplied,
      strategyChange: i.strategyChange || null,
      createdAt: i.createdAt,
      data: i.data as Record<string, unknown>,
    })),
  };
}

// ─── FORMAT PERFORMANCE ANALYSIS ─────────────────────────────────────────────

/**
 * Analyze which content formats are performing best right now.
 * Returns ranked format performance for strategy decisions.
 */
export async function analyzeFormatPerformance(
  brandId?: number,
  platform?: string,
  dayRange = 14
): Promise<FormatMetrics[]> {
  const since = new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000);

  const conditions = [gte(posted.postedAt, since)];

  if (brandId) {
    conditions.push(eq(posted.brandId, brandId));
  }
  if (platform) {
    conditions.push(
      eq(posted.platform, platform as "twitter" | "linkedin" | "instagram" | "facebook")
    );
  }

  const posts = await db
    .select()
    .from(posted)
    .where(and(...conditions));

  // Group by content type/format
  const formatGroups: Record<string, typeof posts> = {};
  for (const post of posts) {
    const format = post.contentType || "text";
    if (!formatGroups[format]) formatGroups[format] = [];
    formatGroups[format].push(post);
  }

  const metrics: FormatMetrics[] = Object.entries(formatGroups).map(
    ([format, formatPosts]) => ({
      format,
      avgEngagement: average(formatPosts.map((p) => p.engagementRate || 0)),
      avgReach: average(formatPosts.map((p) => p.reach || 0)),
      avgSaves: average(formatPosts.map((p) => p.saves || 0)),
      avgShares: average(formatPosts.map((p) => p.shares || 0)),
      avgComments: average(formatPosts.map((p) => p.comments || 0)),
      postCount: formatPosts.length,
    })
  );

  // Sort by engagement rate descending
  metrics.sort((a, b) => b.avgEngagement - a.avgEngagement);

  return metrics;
}

// ─── SIGNAL SUCCESS TRACKING ─────────────────────────────────────────────────

/**
 * Track whether AI-targeted engagement signals are being hit.
 * e.g., if AI targeted "saves" — did the post actually get high saves?
 */
export async function trackSignalSuccess(
  brandId?: number,
  dayRange = 30
): Promise<{
  totalTracked: number;
  successRate: number;
  bySignal: Record<string, { total: number; successful: number; rate: number }>;
}> {
  const since = new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000);

  const conditions = [gte(posted.postedAt, since)];
  if (brandId) {
    conditions.push(eq(posted.brandId, brandId));
  }

  const posts = await db
    .select()
    .from(posted)
    .where(and(...conditions));

  const signalPosts = posts.filter((p) => p.primarySignalTarget);

  const bySignal: Record<string, { total: number; successful: number; rate: number }> = {};

  for (const post of signalPosts) {
    const signal = post.primarySignalTarget!;
    if (!bySignal[signal]) {
      bySignal[signal] = { total: 0, successful: 0, rate: 0 };
    }
    bySignal[signal].total++;

    if (post.signalSuccess) {
      bySignal[signal].successful++;
    }
  }

  // Calculate rates
  for (const signal of Object.keys(bySignal)) {
    bySignal[signal].rate =
      bySignal[signal].total > 0
        ? bySignal[signal].successful / bySignal[signal].total
        : 0;
  }

  const totalTracked = signalPosts.length;
  const totalSuccessful = signalPosts.filter((p) => p.signalSuccess).length;

  return {
    totalTracked,
    successRate: totalTracked > 0 ? totalSuccessful / totalTracked : 0,
    bySignal,
  };
}
