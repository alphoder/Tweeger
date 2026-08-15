// ─── SELF-LEARNING AI SYSTEM ─────────────────────────────────────────────────
// Analyzes performance data, generates actionable insights, and gets smarter
// over time. Runs periodically via scheduler.

import { db } from "@/lib/db";
import { posted, aiInsights, drafts, queue } from "@/lib/schema";
import { eq, desc, gte, and, sql, count, avg, lt, isNull, isNotNull } from "drizzle-orm";

// ─── ANALYZE PERFORMANCE (called daily) ──────────────────────────────────────

export async function analyzePerformance(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let insightsGenerated = 0;

  try {
    // ── TIMING ANALYSIS ──────────────────────────────────────────────────
    const timingData = await db
      .select({
        platform: posted.platform,
        dow: sql<number>`extract(dow from ${posted.postedAt} at time zone 'Asia/Kolkata')`,
        hour: sql<number>`extract(hour from ${posted.postedAt} at time zone 'Asia/Kolkata')`,
        avgEngagement: avg(posted.engagementRate),
        postCount: count(),
      })
      .from(posted)
      .where(gte(posted.postedAt, thirtyDaysAgo))
      .groupBy(
        posted.platform,
        sql`extract(dow from ${posted.postedAt} at time zone 'Asia/Kolkata')`,
        sql`extract(hour from ${posted.postedAt} at time zone 'Asia/Kolkata')`
      );

    // Find best time per platform
    const bestByPlatform: Record<string, typeof timingData[0]> = {};
    for (const row of timingData) {
      const p = row.platform;
      if (
        Number(row.postCount) >= 3 &&
        (!bestByPlatform[p] ||
          Number(row.avgEngagement) > Number(bestByPlatform[p].avgEngagement))
      ) {
        bestByPlatform[p] = row;
      }
    }

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (const [platform, best] of Object.entries(bestByPlatform)) {
      const confidence = Math.min(0.5 + Number(best.postCount) * 0.05, 0.95);
      const avgEng = (Number(best.avgEngagement) * 100).toFixed(1);

      await db.insert(aiInsights).values({
        type: "timing",
        platform: platform as "twitter" | "linkedin" | "instagram" | "facebook",
        insight: `${platform} posts on ${dayNames[Number(best.dow)]} at ${Number(best.hour)}:00 IST get ${avgEng}% engagement — your best time slot`,
        data: {
          bestHour: Number(best.hour),
          bestDow: Number(best.dow),
          avgEngagement: Number(best.avgEngagement),
          sampleSize: Number(best.postCount),
        },
        confidence,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
      });
      insightsGenerated++;
    }

    // ── CONTENT ANALYSIS ─────────────────────────────────────────────────
    const contentData = await db
      .select({
        source: drafts.source,
        avgEngagement: avg(posted.engagementRate),
        postCount: count(),
      })
      .from(posted)
      .leftJoin(queue, eq(posted.queueId, queue.id))
      .leftJoin(drafts, eq(queue.draftId, drafts.id))
      .where(gte(posted.postedAt, thirtyDaysAgo))
      .groupBy(drafts.source);

    const overallAvg =
      contentData.reduce(
        (s, d) => s + Number(d.avgEngagement || 0) * Number(d.postCount),
        0
      ) /
      Math.max(
        contentData.reduce((s, d) => s + Number(d.postCount), 0),
        1
      );

    for (const row of contentData) {
      if (Number(row.postCount) < 3 || !row.source) continue;

      const diff =
        ((Number(row.avgEngagement) - overallAvg) / Math.max(overallAvg, 0.001)) * 100;

      if (Math.abs(diff) > 20) {
        const direction = diff > 0 ? "outperform" : "underperform";
        const confidence = Math.min(0.5 + Number(row.postCount) * 0.03, 0.9);

        await db.insert(aiInsights).values({
          type: "content",
          insight: `${row.source} posts ${direction} average by ${Math.abs(diff).toFixed(0)}% (based on ${row.postCount} posts)`,
          data: {
            source: row.source,
            avgEngagement: Number(row.avgEngagement),
            overallAvg,
            diff,
            sampleSize: Number(row.postCount),
          },
          confidence,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        });
        insightsGenerated++;
      }
    }

    // ── INDUSTRY ANALYSIS ────────────────────────────────────────────────
    const industryData = await db
      .select({
        industry: posted.targetIndustry,
        platform: posted.platform,
        avgEngagement: avg(posted.engagementRate),
        postCount: count(),
      })
      .from(posted)
      .where(
        and(gte(posted.postedAt, thirtyDaysAgo), isNotNull(posted.targetIndustry))
      )
      .groupBy(posted.targetIndustry, posted.platform);

    for (const row of industryData) {
      if (Number(row.postCount) < 2 || !row.industry) continue;

      const avgEng = (Number(row.avgEngagement) * 100).toFixed(1);

      await db.insert(aiInsights).values({
        type: "audience",
        platform: row.platform,
        insight: `${row.industry}-focused content on ${row.platform} averages ${avgEng}% engagement (${row.postCount} posts)`,
        data: {
          industry: row.industry,
          platform: row.platform,
          avgEngagement: Number(row.avgEngagement),
          sampleSize: Number(row.postCount),
        },
        confidence: Math.min(0.4 + Number(row.postCount) * 0.05, 0.85),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });
      insightsGenerated++;
    }

    // ── TREND vs NON-TREND ANALYSIS ──────────────────────────────────────
    const trendComparison = await db
      .select({
        isTrend: sql<boolean>`${drafts.source} = 'trend'`,
        avgEngagement: avg(posted.engagementRate),
        postCount: count(),
      })
      .from(posted)
      .leftJoin(queue, eq(posted.queueId, queue.id))
      .leftJoin(drafts, eq(queue.draftId, drafts.id))
      .where(gte(posted.postedAt, thirtyDaysAgo))
      .groupBy(sql`${drafts.source} = 'trend'`);

    const trendRow = trendComparison.find((r) => r.isTrend === true);
    const nonTrendRow = trendComparison.find((r) => r.isTrend === false);

    if (
      trendRow &&
      nonTrendRow &&
      Number(trendRow.postCount) >= 2 &&
      Number(nonTrendRow.postCount) >= 2
    ) {
      const multiplier =
        Number(trendRow.avgEngagement) /
        Math.max(Number(nonTrendRow.avgEngagement), 0.001);

      if (multiplier > 1.2 || multiplier < 0.8) {
        await db.insert(aiInsights).values({
          type: "trend",
          insight:
            multiplier > 1
              ? `Trend-based posts get ${multiplier.toFixed(1)}x more engagement than regular posts`
              : `Trend-based posts are underperforming — focus on quality over speed`,
          data: {
            trendAvg: Number(trendRow.avgEngagement),
            nonTrendAvg: Number(nonTrendRow.avgEngagement),
            multiplier,
          },
          confidence: 0.7,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        });
        insightsGenerated++;
      }
    }
  } catch (err) {
    console.error("[Learning] Analysis failed:", err);
  }

  return insightsGenerated;
}

// ─── GET RELEVANT INSIGHTS ───────────────────────────────────────────────────

export async function getRelevantInsights(
  platform?: string,
  type?: string,
  limit = 20
) {
  const conditions = [];

  // Exclude expired
  conditions.push(
    sql`(${aiInsights.expiresAt} IS NULL OR ${aiInsights.expiresAt} > now())`
  );

  if (platform) {
    conditions.push(
      eq(aiInsights.platform, platform as "twitter" | "linkedin" | "instagram" | "facebook")
    );
  }
  if (type) {
    conditions.push(
      eq(aiInsights.type, type as "performance" | "timing" | "content" | "audience" | "trend" | "competitor")
    );
  }

  return db
    .select()
    .from(aiInsights)
    .where(and(...conditions))
    .orderBy(desc(aiInsights.confidence), desc(aiInsights.createdAt))
    .limit(limit);
}

// ─── APPLY INSIGHTS TO DRAFT ─────────────────────────────────────────────────

export async function applyInsights(
  platform: string,
  targetIndustry?: string
): Promise<{ suggestions: string[] }> {
  const insights = await getRelevantInsights(platform, undefined, 10);
  const suggestions: string[] = [];

  for (const insight of insights) {
    if (insight.type === "timing") {
      const data = insight.data as Record<string, number>;
      suggestions.push(
        `Schedule for ${data.bestHour}:00 IST (${insight.insight})`
      );
    } else if (insight.type === "content") {
      suggestions.push(insight.insight);
    } else if (insight.type === "audience" && targetIndustry) {
      const data = insight.data as Record<string, string>;
      if (data.industry === targetIndustry) {
        suggestions.push(insight.insight);
      }
    } else if (insight.type === "trend") {
      suggestions.push(insight.insight);
    }
  }

  return { suggestions };
}

// ─── MEASURE INSIGHT IMPACT ──────────────────────────────────────────────────

export async function measureInsightImpact(insightId: number): Promise<number | null> {
  const [insight] = await db
    .select()
    .from(aiInsights)
    .where(eq(aiInsights.id, insightId));

  if (!insight || !insight.applied) return null;

  const data = insight.data as Record<string, unknown>;
  const appliedAt = insight.createdAt;

  // Compare posts after insight was applied vs before
  const [afterStats] = await db
    .select({
      avgEngagement: avg(posted.engagementRate),
      postCount: count(),
    })
    .from(posted)
    .where(
      and(
        gte(posted.postedAt, appliedAt),
        insight.platform
          ? eq(posted.platform, insight.platform)
          : undefined
      )
    );

  const [beforeStats] = await db
    .select({
      avgEngagement: avg(posted.engagementRate),
      postCount: count(),
    })
    .from(posted)
    .where(
      and(
        lt(posted.postedAt, appliedAt),
        gte(
          posted.postedAt,
          new Date(appliedAt.getTime() - 30 * 24 * 60 * 60 * 1000)
        ),
        insight.platform
          ? eq(posted.platform, insight.platform)
          : undefined
      )
    );

  if (
    Number(afterStats.postCount) < 3 ||
    Number(beforeStats.postCount) < 3
  ) {
    return null;
  }

  const impact =
    ((Number(afterStats.avgEngagement) - Number(beforeStats.avgEngagement)) /
      Math.max(Number(beforeStats.avgEngagement), 0.001)) *
    100;

  // Update impact score
  await db
    .update(aiInsights)
    .set({ impactScore: impact })
    .where(eq(aiInsights.id, insightId));

  return impact;
}
