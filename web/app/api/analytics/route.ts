import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analytics, posted, drafts, queue } from "@/lib/schema";
import { eq, desc, gte, and, sql, count, avg } from "drizzle-orm";

/**
 * GET /api/analytics
 * Query types: overview, growth, posting_times, content_performance,
 * platform_comparison, industry_performance, heatmap, weekly_report
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "overview";
    const platform = searchParams.get("platform") || "all";
    const days = parseInt(searchParams.get("days") || "7");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const platformFilter = platform !== "all"
      ? eq(posted.platform, platform as "twitter" | "linkedin" | "instagram" | "facebook")
      : undefined;

    switch (type) {
      // ─── OVERVIEW ──────────────────────────────────────────────────────
      case "overview": {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [latestSnapshots, todayPosts, topPost] = await Promise.all([
          // Latest snapshot per platform
          db.execute(sql`
            SELECT DISTINCT ON (platform) *
            FROM analytics
            ORDER BY platform, recorded_at DESC
          `),
          // Today's posts
          db
            .select({ total: count(), platform: posted.platform })
            .from(posted)
            .where(gte(posted.postedAt, todayStart))
            .groupBy(posted.platform),
          // Top post today
          db
            .select()
            .from(posted)
            .where(gte(posted.postedAt, todayStart))
            .orderBy(desc(posted.engagementRate))
            .limit(1),
        ]);

        return NextResponse.json({
          snapshots: latestSnapshots.rows,
          todayPosts,
          topPost: topPost[0] || null,
        });
      }

      // ─── GROWTH ────────────────────────────────────────────────────────
      case "growth": {
        const conditions = [gte(analytics.recordedAt, startDate)];
        if (platform !== "all") {
          conditions.push(
            eq(analytics.platform, platform as "twitter" | "linkedin" | "instagram" | "facebook")
          );
        }

        const data = await db
          .select()
          .from(analytics)
          .where(and(...conditions))
          .orderBy(analytics.recordedAt);

        // Calculate change
        const first = data[0];
        const last = data[data.length - 1];
        const followerChange = first && last
          ? last.followers - first.followers
          : 0;
        const growthRate = first && first.followers > 0
          ? ((followerChange / first.followers) * 100).toFixed(2)
          : "0";

        return NextResponse.json({
          data,
          followerChange,
          growthRate,
          postsInPeriod: data.reduce((s, d) => s + d.postCount, 0),
        });
      }

      // ─── POSTING TIMES ─────────────────────────────────────────────────
      case "posting_times": {
        const conditions = [];
        if (platformFilter) conditions.push(platformFilter);

        const hourlyData = await db
          .select({
            hour: sql<number>`extract(hour from ${posted.postedAt} at time zone 'Asia/Kolkata')`,
            avgEngagement: avg(posted.engagementRate),
            postCount: count(),
            avgLikes: avg(posted.likes),
            avgShares: avg(posted.shares),
          })
          .from(posted)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .groupBy(sql`extract(hour from ${posted.postedAt} at time zone 'Asia/Kolkata')`)
          .orderBy(desc(avg(posted.engagementRate)))
          .limit(24);

        return NextResponse.json({ hourlyData });
      }

      // ─── CONTENT PERFORMANCE ───────────────────────────────────────────
      case "content_performance": {
        const data = await db
          .select({
            source: drafts.source,
            contentType: posted.contentType,
            avgEngagement: avg(posted.engagementRate),
            postCount: count(),
            avgLikes: avg(posted.likes),
          })
          .from(posted)
          .leftJoin(queue, eq(posted.queueId, queue.id))
          .leftJoin(drafts, eq(queue.draftId, drafts.id))
          .where(gte(posted.postedAt, startDate))
          .groupBy(drafts.source, posted.contentType);

        return NextResponse.json({ data });
      }

      // ─── PLATFORM COMPARISON ───────────────────────────────────────────
      case "platform_comparison": {
        const data = await db
          .select({
            platform: posted.platform,
            avgEngagement: avg(posted.engagementRate),
            postCount: count(),
            avgLikes: avg(posted.likes),
            avgShares: avg(posted.shares),
            avgComments: avg(posted.comments),
            avgImpressions: avg(posted.impressions),
          })
          .from(posted)
          .where(gte(posted.postedAt, startDate))
          .groupBy(posted.platform);

        return NextResponse.json({ data });
      }

      // ─── INDUSTRY PERFORMANCE ──────────────────────────────────────────
      case "industry_performance": {
        const data = await db
          .select({
            industry: posted.targetIndustry,
            avgEngagement: avg(posted.engagementRate),
            postCount: count(),
            avgLikes: avg(posted.likes),
          })
          .from(posted)
          .where(gte(posted.postedAt, startDate))
          .groupBy(posted.targetIndustry);

        return NextResponse.json({
          data: data.filter((d) => d.industry),
        });
      }

      // ─── HEATMAP ───────────────────────────────────────────────────────
      case "heatmap": {
        const conditions = [];
        if (platformFilter) conditions.push(platformFilter);

        const data = await db
          .select({
            dow: sql<number>`extract(dow from ${posted.postedAt} at time zone 'Asia/Kolkata')`,
            hour: sql<number>`extract(hour from ${posted.postedAt} at time zone 'Asia/Kolkata')`,
            avgEngagement: avg(posted.engagementRate),
            postCount: count(),
          })
          .from(posted)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .groupBy(
            sql`extract(dow from ${posted.postedAt} at time zone 'Asia/Kolkata')`,
            sql`extract(hour from ${posted.postedAt} at time zone 'Asia/Kolkata')`
          );

        return NextResponse.json({ data });
      }

      // ─── WEEKLY REPORT ─────────────────────────────────────────────────
      case "weekly_report": {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const [postsByPlatform, topPosts, worstPosts] = await Promise.all([
          db
            .select({
              platform: posted.platform,
              postCount: count(),
              avgEngagement: avg(posted.engagementRate),
              totalLikes: sql<number>`sum(${posted.likes})`,
              totalShares: sql<number>`sum(${posted.shares})`,
              totalImpressions: sql<number>`sum(${posted.impressions})`,
            })
            .from(posted)
            .where(gte(posted.postedAt, weekAgo))
            .groupBy(posted.platform),
          db
            .select()
            .from(posted)
            .where(gte(posted.postedAt, weekAgo))
            .orderBy(desc(posted.engagementRate))
            .limit(5),
          db
            .select()
            .from(posted)
            .where(gte(posted.postedAt, weekAgo))
            .orderBy(posted.engagementRate)
            .limit(3),
        ]);

        return NextResponse.json({
          postsByPlatform,
          topPosts,
          worstPosts,
          period: { start: weekAgo.toISOString(), end: new Date().toISOString() },
        });
      }

      default:
        return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analytics query failed" },
      { status: 500 }
    );
  }
}
