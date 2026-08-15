// ─── AI SCHEDULING ENGINE ────────────────────────────────────────────────────
// Smart scheduling: analyzes historical performance, trends, existing queue,
// and AI insights to recommend optimal posting times.

import { db } from "@/lib/db";
import { posted, queue, aiInsights, trendCache } from "@/lib/schema";
import { eq, desc, gte, and, sql, ne } from "drizzle-orm";
import { OPTIMAL_HOURS } from "@/lib/brand";

interface TimeRecommendation {
  time: Date;
  confidence: number;
  reasoning: string;
  engagementPrediction?: number;
}

interface WeekScheduleSlot {
  day: string; // e.g. "Monday"
  date: string; // ISO date
  hour: number;
  reasoning: string;
  confidence: number;
}

// ─── GET OPTIMAL POSTING TIME ────────────────────────────────────────────────

export async function getOptimalTime(
  platform: string,
  contentType?: string,
  targetIndustry?: string
): Promise<TimeRecommendation> {
  try {
    const reasons: string[] = [];
    let bestHour = OPTIMAL_HOURS[0] || 10;
    let confidence = 0.6;

    // 1. Historical performance — get avg engagement by hour
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const hourlyStats = await db
      .select({
        hour: sql<number>`extract(hour from ${posted.postedAt} at time zone 'Asia/Kolkata')`,
        avgEngagement: sql<number>`avg(coalesce(${posted.engagementRate}, 0))`,
        totalPosts: sql<number>`count(*)`,
      })
      .from(posted)
      .where(
        and(
          eq(posted.platform, platform as "twitter" | "linkedin" | "instagram" | "facebook"),
          gte(posted.postedAt, thirtyDaysAgo)
        )
      )
      .groupBy(
        sql`extract(hour from ${posted.postedAt} at time zone 'Asia/Kolkata')`
      )
      .orderBy(
        desc(
          sql`avg(coalesce(${posted.engagementRate}, 0))`
        )
      )
      .limit(5);

    if (hourlyStats.length > 0 && Number(hourlyStats[0].totalPosts) >= 3) {
      bestHour = Number(hourlyStats[0].hour);
      confidence = 0.8;
      reasons.push(
        `Posts at ${bestHour}:00 IST get the highest engagement on ${platform} (based on ${hourlyStats[0].totalPosts} posts)`
      );
    } else {
      reasons.push(
        `Using default optimal hours for ${platform} (insufficient historical data)`
      );
    }

    // 2. Check AI insights for timing recommendations
    const timingInsights = await db
      .select()
      .from(aiInsights)
      .where(
        and(
          eq(aiInsights.type, "timing"),
          eq(aiInsights.platform, platform as "twitter" | "linkedin" | "instagram" | "facebook")
        )
      )
      .orderBy(desc(aiInsights.createdAt))
      .limit(1);

    if (timingInsights.length > 0) {
      const data = timingInsights[0].data as Record<string, unknown>;
      if (data?.bestHour && typeof data.bestHour === "number") {
        bestHour = data.bestHour;
        confidence = Math.min(confidence + 0.1, 0.95);
        reasons.push(`AI insight: "${timingInsights[0].insight}"`);
      }
    }

    // 3. Check trends for urgency
    const latestTrends = await db
      .select()
      .from(trendCache)
      .where(
        eq(trendCache.platform, platform as "twitter" | "linkedin" | "instagram" | "facebook")
      )
      .orderBy(desc(trendCache.fetchedAt))
      .limit(1);

    if (latestTrends.length > 0) {
      const trends = latestTrends[0].trends || [];
      const hotTrend = trends.find(
        (t) => (t.relevanceScore || 0) > 0.8
      );
      if (hotTrend) {
        reasons.push(
          `High-relevance trend "${hotTrend.name}" detected — consider posting sooner`
        );
        confidence = Math.min(confidence + 0.05, 0.95);
      }
    }

    // 4. Find the next available slot (avoid stacking)
    const recommended = await getNextAvailableSlot(platform, bestHour);

    return {
      time: recommended,
      confidence,
      reasoning: reasons.join(". "),
    };
  } catch (err) {
    // Fallback: next occurrence of first optimal hour
    const now = new Date();
    const fallback = new Date(now);
    const targetHour = OPTIMAL_HOURS[0] || 10;
    fallback.setHours(targetHour, 0, 0, 0);
    if (fallback <= now) {
      fallback.setDate(fallback.getDate() + 1);
    }

    return {
      time: fallback,
      confidence: 0.5,
      reasoning: "Using default time (scheduling engine encountered an error)",
    };
  }
}

// ─── GET NEXT AVAILABLE SLOT ─────────────────────────────────────────────────
// Finds the next slot that doesn't conflict with existing queue items.
// Minimum 2-hour gap between posts on the same platform.

export async function getNextAvailableSlot(
  platform: string,
  preferredHour?: number
): Promise<Date> {
  const now = new Date();
  const candidate = new Date(now);
  const hour = preferredHour ?? OPTIMAL_HOURS[0] ?? 10;

  // Start from the next occurrence of preferred hour
  candidate.setHours(hour, 0, 0, 0);
  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }

  // Get upcoming queue items for this platform
  const upcoming = await db
    .select({ scheduledTime: queue.scheduledTime })
    .from(queue)
    .where(
      and(
        eq(queue.platform, platform as "twitter" | "linkedin" | "instagram" | "facebook"),
        eq(queue.status, "scheduled"),
        gte(queue.scheduledTime, now)
      )
    )
    .orderBy(queue.scheduledTime);

  const scheduledTimes = upcoming.map((q) => q.scheduledTime.getTime());

  // Check for conflicts (2-hour minimum gap)
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  let maxAttempts = 30; // prevent infinite loops

  while (maxAttempts > 0) {
    const candidateTime = candidate.getTime();
    const hasConflict = scheduledTimes.some(
      (t) => Math.abs(t - candidateTime) < TWO_HOURS
    );

    if (!hasConflict) {
      return candidate;
    }

    // Move to next optimal hour or next day
    const currentHourIdx = OPTIMAL_HOURS.indexOf(candidate.getHours());
    if (currentHourIdx >= 0 && currentHourIdx < OPTIMAL_HOURS.length - 1) {
      candidate.setHours(OPTIMAL_HOURS[currentHourIdx + 1], 0, 0, 0);
    } else {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(OPTIMAL_HOURS[0] || 10, 0, 0, 0);
    }

    maxAttempts--;
  }

  return candidate;
}

// ─── SUGGEST WEEK SCHEDULE ───────────────────────────────────────────────────
// Generates a full week posting schedule based on historical data.

export async function suggestWeekSchedule(
  platform: string,
  postsPerDay = 2
): Promise<WeekScheduleSlot[]> {
  const slots: WeekScheduleSlot[] = [];
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get day-of-week performance data
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let dayStats: { dow: number; avgEng: number }[] = [];
  try {
    const result = await db
      .select({
        dow: sql<number>`extract(dow from ${posted.postedAt} at time zone 'Asia/Kolkata')`,
        avgEng: sql<number>`avg(coalesce(${posted.engagementRate}, 0))`,
      })
      .from(posted)
      .where(
        and(
          eq(posted.platform, platform as "twitter" | "linkedin" | "instagram" | "facebook"),
          gte(posted.postedAt, thirtyDaysAgo)
        )
      )
      .groupBy(
        sql`extract(dow from ${posted.postedAt} at time zone 'Asia/Kolkata')`
      );

    dayStats = result.map((r) => ({
      dow: Number(r.dow),
      avgEng: Number(r.avgEng),
    }));
  } catch {
    // Use defaults
  }

  for (let d = 0; d < 7; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const dow = date.getDay();
    const dayName = dayNames[dow];

    const dayStat = dayStats.find((s) => s.dow === dow);
    const isWeekend = dow === 0 || dow === 6;

    // Pick posting hours
    const hours =
      isWeekend
        ? [11, 16] // Weekends: 11 AM, 4 PM
        : OPTIMAL_HOURS.slice(0, postsPerDay);

    for (const hour of hours) {
      const confidence = dayStat
        ? Math.min(0.7 + dayStat.avgEng * 10, 0.95)
        : 0.6;

      const reasoning = dayStat
        ? `${dayName}s at ${hour}:00 IST — historical avg engagement: ${(dayStat.avgEng * 100).toFixed(1)}%`
        : `${dayName} at ${hour}:00 IST — default optimal time for ${platform}`;

      slots.push({
        day: dayName,
        date: date.toISOString().split("T")[0],
        hour,
        reasoning,
        confidence,
      });
    }
  }

  return slots;
}

// ─── GET ALTERNATIVE TIMES ───────────────────────────────────────────────────

export async function getAlternativeTimes(
  platform: string,
  count = 3
): Promise<TimeRecommendation[]> {
  const alternatives: TimeRecommendation[] = [];
  const usedHours = new Set<number>();

  for (let i = 0; i < count + 2 && alternatives.length < count; i++) {
    const hour = OPTIMAL_HOURS[i % OPTIMAL_HOURS.length];
    if (usedHours.has(hour)) continue;
    usedHours.add(hour);

    const slot = await getNextAvailableSlot(platform, hour);
    alternatives.push({
      time: slot,
      confidence: Math.max(0.5, 0.85 - i * 0.1),
      reasoning: `Alternative slot at ${hour}:00 IST`,
    });
  }

  return alternatives;
}
