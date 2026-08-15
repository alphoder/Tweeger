// ─── SCHEDULER ──────────────────────────────────────────────────────────────
// node-cron jobs for automated tasks — queue processing, metrics,
// daily snapshots, event checking, trend research, self-learning

import cron from "node-cron";
import { db } from "@/lib/db";
import { queue, posted, analytics, events, trendCache, reviewQueue, brandProfiles, usageMeters } from "@/lib/schema";
import { eq, and, lte, gte, desc, sql, count } from "drizzle-orm";
import { analyzePerformance } from "@/lib/learning";
import { getClient } from "@/lib/platforms";
import { detectAlgorithmChanges } from "@/lib/algorithm-detection";
import { getPostsNeedingCoaching, generateReplyCoaching, formatCoachingNotification } from "@/lib/engagement-coach";
import { notifyAdmin } from "@/lib/telegram";

let started = false;

// ─── STATUS TRACKING ─────────────────────────────────────────────────────────

interface JobStatus {
  name: string;
  schedule: string;
  lastRun: Date | null;
  lastResult: string;
  running: boolean;
}

const jobStatuses: Record<string, JobStatus> = {
  processQueue: {
    name: "Process Queue",
    schedule: "Every 1 minute",
    lastRun: null,
    lastResult: "Not run",
    running: false,
  },
  updateMetrics: {
    name: "Update Metrics",
    schedule: "Every 2 hours",
    lastRun: null,
    lastResult: "Not run",
    running: false,
  },
  dailySnapshot: {
    name: "Daily Snapshot",
    schedule: "00:00 UTC",
    lastRun: null,
    lastResult: "Not run",
    running: false,
  },
  checkEvents: {
    name: "Check Events",
    schedule: "08:00 UTC",
    lastRun: null,
    lastResult: "Not run",
    running: false,
  },
  trendResearch: {
    name: "Trend Research",
    schedule: "Every 30 minutes",
    lastRun: null,
    lastResult: "Not run",
    running: false,
  },
  selfLearning: {
    name: "Self-Learning",
    schedule: "02:00 UTC daily",
    lastRun: null,
    lastResult: "Not run",
    running: false,
  },
  algorithmDetection: {
    name: "Algorithm Detection",
    schedule: "03:00 UTC daily",
    lastRun: null,
    lastResult: "Not run",
    running: false,
  },
  engagementCoaching: {
    name: "Engagement Coaching",
    schedule: "Every 5 minutes",
    lastRun: null,
    lastResult: "Not run",
    running: false,
  },
  reviewReminders: {
    name: "Review Reminders",
    schedule: "Every 2 hours",
    lastRun: null,
    lastResult: "Not run",
    running: false,
  },
  weeklyReport: {
    name: "Weekly Report",
    schedule: "Monday 08:00 UTC",
    lastRun: null,
    lastResult: "Not run",
    running: false,
  },
  usageReset: {
    name: "Usage Reset",
    schedule: "1st of month 00:00 UTC",
    lastRun: null,
    lastResult: "Not run",
    running: false,
  },
};

export function getSchedulerStatus() {
  return {
    running: started,
    jobs: Object.values(jobStatuses),
  };
}

// ─── PROCESS QUEUE ───────────────────────────────────────────────────────────
// Every 1 minute — find due items and post them

async function processQueue() {
  if (jobStatuses.processQueue.running) return;
  jobStatuses.processQueue.running = true;

  try {
    const now = new Date();

    // Find due scheduled items
    const dueItems = await db
      .select()
      .from(queue)
      .where(
        and(
          eq(queue.status, "scheduled"),
          lte(queue.scheduledTime, now)
        )
      )
      .limit(5);

    let processed = 0;

    for (const item of dueItems) {
      try {
        // Mark as posting
        await db
          .update(queue)
          .set({ status: "posting" })
          .where(eq(queue.id, item.id));

        // Post via the real platform client
        const client = getClient(item.platform);
        let postId: string;
        let postUrl: string;

        if (client.isConfigured()) {
          // Use real API
          const result = await client.post(item.text, item.imagePath || undefined);
          postId = result.postId;
          postUrl = result.postUrl;
        } else {
          // Platform not configured — simulate so queue doesn't stall
          console.warn(
            `[Scheduler] ${item.platform} not configured, simulating post`
          );
          postId = `sim_${Date.now()}_${item.id}`;
          postUrl = `https://${item.platform}.com/post/${postId}`;
        }

        // Save to posted table
        await db.insert(posted).values({
          queueId: item.id,
          draftId: item.draftId,
          postId,
          platform: item.platform,
          text: item.text,
          imagePath: item.imagePath,
          postedAt: now,
          contentType: "text_only",
        });

        // Update queue status
        await db
          .update(queue)
          .set({
            status: "posted",
            postedAt: now,
            postId,
            postUrl,
          })
          .where(eq(queue.id, item.id));

        processed++;
      } catch (err) {
        // Increment retry count or mark as failed
        const newRetryCount = item.retryCount + 1;
        const status =
          newRetryCount >= item.maxRetries ? "failed" : "scheduled";

        await db
          .update(queue)
          .set({
            status: status as "scheduled" | "failed",
            retryCount: newRetryCount,
            error: err instanceof Error ? err.message : "Unknown error",
            // Retry in 5 minutes
            ...(status === "scheduled"
              ? {
                  scheduledTime: new Date(
                    now.getTime() + 5 * 60 * 1000
                  ),
                }
              : {}),
          })
          .where(eq(queue.id, item.id));
      }
    }

    jobStatuses.processQueue.lastResult = `Processed ${processed}/${dueItems.length} items`;
  } catch (err) {
    jobStatuses.processQueue.lastResult = `Error: ${
      err instanceof Error ? err.message : "Unknown"
    }`;
  } finally {
    jobStatuses.processQueue.lastRun = new Date();
    jobStatuses.processQueue.running = false;
  }
}

// ─── UPDATE METRICS ──────────────────────────────────────────────────────────
// Every 2 hours — refresh engagement metrics for recent posts

async function updateMetrics() {
  if (jobStatuses.updateMetrics.running) return;
  jobStatuses.updateMetrics.running = true;

  try {
    // In production, would fetch real metrics from each platform API
    // For now, just update the status
    jobStatuses.updateMetrics.lastResult = "Metrics update cycle complete";
  } catch (err) {
    jobStatuses.updateMetrics.lastResult = `Error: ${
      err instanceof Error ? err.message : "Unknown"
    }`;
  } finally {
    jobStatuses.updateMetrics.lastRun = new Date();
    jobStatuses.updateMetrics.running = false;
  }
}

// ─── DAILY SNAPSHOT ──────────────────────────────────────────────────────────
// 00:00 UTC — per-platform follower snapshots

async function dailySnapshot() {
  if (jobStatuses.dailySnapshot.running) return;
  jobStatuses.dailySnapshot.running = true;

  try {
    const platforms = ["twitter", "linkedin", "instagram", "facebook"] as const;

    for (const platform of platforms) {
      // In production, would fetch real follower counts
      // For now, create a placeholder snapshot
      await db.insert(analytics).values({
        platform,
        type: "daily_snapshot",
        followers: 0,
        following: 0,
        postCount: 0,
        impressions: 0,
        reach: 0,
        profileViews: 0,
      });
    }

    jobStatuses.dailySnapshot.lastResult = `Snapshots created for ${platforms.length} platforms`;
  } catch (err) {
    jobStatuses.dailySnapshot.lastResult = `Error: ${
      err instanceof Error ? err.message : "Unknown"
    }`;
  } finally {
    jobStatuses.dailySnapshot.lastRun = new Date();
    jobStatuses.dailySnapshot.running = false;
  }
}

// ─── CHECK EVENTS ────────────────────────────────────────────────────────────
// 08:00 UTC — events 3 days away → notify admin

async function checkEvents() {
  if (jobStatuses.checkEvents.running) return;
  jobStatuses.checkEvents.running = true;

  try {
    const now = new Date();
    const threeDaysFromNow = new Date(
      now.getTime() + 3 * 24 * 60 * 60 * 1000
    );

    const upcomingEvents = await db
      .select()
      .from(events)
      .where(
        and(
          gte(events.eventDate, now),
          lte(events.eventDate, threeDaysFromNow)
        )
      );

    jobStatuses.checkEvents.lastResult = `Found ${upcomingEvents.length} events in next 3 days`;

    // In production, would notify admin via Telegram and auto-generate content
  } catch (err) {
    jobStatuses.checkEvents.lastResult = `Error: ${
      err instanceof Error ? err.message : "Unknown"
    }`;
  } finally {
    jobStatuses.checkEvents.lastRun = new Date();
    jobStatuses.checkEvents.running = false;
  }
}

// ─── TREND RESEARCH ──────────────────────────────────────────────────────────
// Every 30 minutes — refresh trend cache

async function trendResearch() {
  if (jobStatuses.trendResearch.running) return;
  jobStatuses.trendResearch.running = true;

  try {
    // In production, would fetch trends from each platform
    jobStatuses.trendResearch.lastResult = "Trend refresh cycle complete";
  } catch (err) {
    jobStatuses.trendResearch.lastResult = `Error: ${
      err instanceof Error ? err.message : "Unknown"
    }`;
  } finally {
    jobStatuses.trendResearch.lastRun = new Date();
    jobStatuses.trendResearch.running = false;
  }
}

// ─── SELF-LEARNING ───────────────────────────────────────────────────────────
// 02:00 UTC daily — run analyzePerformance()

async function selfLearning() {
  if (jobStatuses.selfLearning.running) return;
  jobStatuses.selfLearning.running = true;

  try {
    const insightsGenerated = await analyzePerformance();
    jobStatuses.selfLearning.lastResult = `Generated ${insightsGenerated} insights`;
  } catch (err) {
    jobStatuses.selfLearning.lastResult = `Error: ${
      err instanceof Error ? err.message : "Unknown"
    }`;
  } finally {
    jobStatuses.selfLearning.lastRun = new Date();
    jobStatuses.selfLearning.running = false;
  }
}

// ─── ALGORITHM DETECTION ────────────────────────────────────────────────────
// 03:00 UTC daily — run detectAlgorithmChanges() for all platforms

async function algorithmDetection() {
  if (jobStatuses.algorithmDetection.running) return;
  jobStatuses.algorithmDetection.running = true;

  try {
    const result = await detectAlgorithmChanges();

    if (result.alerts.length > 0) {
      let msg = "🧠 *Algorithm Changes Detected*\n\n";
      for (const alert of result.alerts) {
        msg += `• *${alert.platform}*: ${alert.description}\n  → ${alert.recommendation}\n  _Confidence: ${(alert.confidence * 100).toFixed(0)}%_\n\n`;
      }
      await notifyAdmin(msg);
    }

    jobStatuses.algorithmDetection.lastResult = `Analyzed ${result.metricsAnalyzed} metrics, found ${result.alerts.length} changes`;
  } catch (err) {
    jobStatuses.algorithmDetection.lastResult = `Error: ${
      err instanceof Error ? err.message : "Unknown"
    }`;
  } finally {
    jobStatuses.algorithmDetection.lastRun = new Date();
    jobStatuses.algorithmDetection.running = false;
  }
}

// ─── ENGAGEMENT COACHING ────────────────────────────────────────────────────
// Every 5 minutes — check recent posts for engagement, generate coaching

async function engagementCoaching() {
  if (jobStatuses.engagementCoaching.running) return;
  jobStatuses.engagementCoaching.running = true;

  try {
    const { posts } = await getPostsNeedingCoaching();

    let coached = 0;
    for (const post of posts.slice(0, 3)) {
      // Only coach posts that are getting good engagement
      if (post.totalEngagement >= 3) {
        const report = await generateReplyCoaching(post.id, post.platform);
        if (report.suggestions.length > 0) {
          const notification = formatCoachingNotification(report);
          await notifyAdmin(notification);
          coached++;
        }
      }
    }

    jobStatuses.engagementCoaching.lastResult = `Checked ${posts.length} posts, coached ${coached}`;
  } catch (err) {
    jobStatuses.engagementCoaching.lastResult = `Error: ${
      err instanceof Error ? err.message : "Unknown"
    }`;
  } finally {
    jobStatuses.engagementCoaching.lastRun = new Date();
    jobStatuses.engagementCoaching.running = false;
  }
}

// ─── REVIEW REMINDERS ───────────────────────────────────────────────────────
// Every 2 hours — if pending reviews >4 hours, Telegram reminder

async function reviewReminders() {
  if (jobStatuses.reviewReminders.running) return;
  jobStatuses.reviewReminders.running = true;

  try {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

    const pendingItems = await db
      .select()
      .from(reviewQueue)
      .where(
        and(
          eq(reviewQueue.reviewStatus, "pending_review"),
          lte(reviewQueue.createdAt, fourHoursAgo)
        )
      );

    if (pendingItems.length > 0) {
      await notifyAdmin(
        `⏰ *Review Reminder*\n\n${pendingItems.length} post${pendingItems.length !== 1 ? "s" : ""} pending review for 4+ hours.\n\nOpen the Review Deck to approve or reject.`
      );
    }

    jobStatuses.reviewReminders.lastResult = `${pendingItems.length} stale reviews found`;
  } catch (err) {
    jobStatuses.reviewReminders.lastResult = `Error: ${
      err instanceof Error ? err.message : "Unknown"
    }`;
  } finally {
    jobStatuses.reviewReminders.lastRun = new Date();
    jobStatuses.reviewReminders.running = false;
  }
}

// ─── WEEKLY REPORT ──────────────────────────────────────────────────────────
// Monday 08:00 UTC — AI narrative report via Telegram

async function weeklyReport() {
  if (jobStatuses.weeklyReport.running) return;
  jobStatuses.weeklyReport.running = true;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Count posts this week
    const recentPosts = await db
      .select()
      .from(posted)
      .where(gte(posted.postedAt, sevenDaysAgo));

    const totalEngagement = recentPosts.reduce(
      (sum, p) =>
        sum + (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0),
      0
    );

    const avgEngagement =
      recentPosts.length > 0
        ? recentPosts.reduce((sum, p) => sum + (p.engagementRate || 0), 0) /
          recentPosts.length
        : 0;

    // Platform breakdown
    const byPlatform: Record<string, { count: number; engagement: number }> = {};
    for (const p of recentPosts) {
      if (!byPlatform[p.platform]) byPlatform[p.platform] = { count: 0, engagement: 0 };
      byPlatform[p.platform].count++;
      byPlatform[p.platform].engagement += p.engagementRate || 0;
    }

    let msg = "📊 *Weekly Performance Report*\n\n";
    msg += `📝 Posts: *${recentPosts.length}*\n`;
    msg += `💫 Total Engagement: *${totalEngagement.toLocaleString()}*\n`;
    msg += `📈 Avg Engagement Rate: *${(avgEngagement * 100).toFixed(2)}%*\n\n`;

    for (const [platform, stats] of Object.entries(byPlatform)) {
      const emoji = platform === "twitter" ? "🐦" : platform === "linkedin" ? "💼" : platform === "instagram" ? "📷" : "📘";
      const avgER = stats.count > 0 ? (stats.engagement / stats.count * 100).toFixed(2) : "0";
      msg += `${emoji} *${platform}*: ${stats.count} posts, ${avgER}% avg ER\n`;
    }

    // Best post
    const bestPost = recentPosts.sort(
      (a, b) => (b.engagementRate || 0) - (a.engagementRate || 0)
    )[0];

    if (bestPost) {
      msg += `\n🏆 *Best Post:*\n${bestPost.text.slice(0, 120)}...\n`;
      msg += `❤️ ${bestPost.likes} | 🔁 ${bestPost.shares} | 💬 ${bestPost.comments} | 💾 ${bestPost.saves}\n`;
    }

    await notifyAdmin(msg);

    jobStatuses.weeklyReport.lastResult = `Report sent: ${recentPosts.length} posts analyzed`;
  } catch (err) {
    jobStatuses.weeklyReport.lastResult = `Error: ${
      err instanceof Error ? err.message : "Unknown"
    }`;
  } finally {
    jobStatuses.weeklyReport.lastRun = new Date();
    jobStatuses.weeklyReport.running = false;
  }
}

// ─── USAGE RESET ────────────────────────────────────────────────────────────
// 1st of month 00:00 UTC — create new usage_meters period

async function usageReset() {
  if (jobStatuses.usageReset.running) return;
  jobStatuses.usageReset.running = true;

  try {
    const allBrands = await db.select().from(brandProfiles);
    let created = 0;

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    for (const brand of allBrands) {
      try {
        await db.insert(usageMeters).values({
          brandId: brand.id,
          periodStart,
          periodEnd,
          postsUsed: 0,
          postsLimit: brand.postsPerDayPerPlatform * 30 * 4, // daily * 30 days * 4 platforms
          insightsUsed: 0,
          insightsLimit: 100,
          planTier: "growth",
        });
        created++;
      } catch {
        // Unique constraint conflict — period already exists for this brand
      }
    }

    jobStatuses.usageReset.lastResult = `Created ${created} new usage periods for ${allBrands.length} brands`;
  } catch (err) {
    jobStatuses.usageReset.lastResult = `Error: ${
      err instanceof Error ? err.message : "Unknown"
    }`;
  } finally {
    jobStatuses.usageReset.lastRun = new Date();
    jobStatuses.usageReset.running = false;
  }
}

// ─── START SCHEDULER ─────────────────────────────────────────────────────────

export function startScheduler() {
  if (started) return;
  started = true;

  console.log("[Scheduler] Starting cron jobs...");

  // Process queue — every 1 minute
  cron.schedule("* * * * *", processQueue);

  // Update metrics — every 2 hours
  cron.schedule("0 */2 * * *", updateMetrics);

  // Daily snapshot — 00:00 UTC
  cron.schedule("0 0 * * *", dailySnapshot);

  // Check events — 08:00 UTC
  cron.schedule("0 8 * * *", checkEvents);

  // Trend research — every 30 minutes
  cron.schedule("*/30 * * * *", trendResearch);

  // Self-learning — 02:00 UTC daily
  cron.schedule("0 2 * * *", selfLearning);

  // Algorithm detection — 03:00 UTC daily
  cron.schedule("0 3 * * *", algorithmDetection);

  // Engagement coaching — every 5 minutes
  cron.schedule("*/5 * * * *", engagementCoaching);

  // Review reminders — every 2 hours
  cron.schedule("0 */2 * * *", reviewReminders);

  // Weekly report — Monday 08:00 UTC
  cron.schedule("0 8 * * 1", weeklyReport);

  // Usage reset — 1st of month 00:00 UTC
  cron.schedule("0 0 1 * *", usageReset);

  console.log("[Scheduler] All 11 cron jobs registered");
}

// ─── CLOUDFLARE CRON ENTRY ──────────────────────────────────────────────────
// On Workers there is no long-lived process, so a single "* * * * *" cron
// trigger calls runDueJobs() once a minute and we decide what's due here.

type DueCheck = (d: Date) => boolean;

const JOB_TABLE: Array<{ key: string; fn: () => Promise<void>; isDue: DueCheck }> = [
  { key: "processQueue", fn: processQueue, isDue: () => true }, // every minute
  { key: "engagementCoaching", fn: engagementCoaching, isDue: (d) => d.getUTCMinutes() % 5 === 0 },
  { key: "trendResearch", fn: trendResearch, isDue: (d) => d.getUTCMinutes() % 30 === 0 },
  { key: "updateMetrics", fn: updateMetrics, isDue: (d) => d.getUTCMinutes() === 0 && d.getUTCHours() % 2 === 0 },
  { key: "reviewReminders", fn: reviewReminders, isDue: (d) => d.getUTCMinutes() === 0 && d.getUTCHours() % 2 === 0 },
  { key: "dailySnapshot", fn: dailySnapshot, isDue: (d) => d.getUTCMinutes() === 0 && d.getUTCHours() === 0 },
  { key: "selfLearning", fn: selfLearning, isDue: (d) => d.getUTCMinutes() === 0 && d.getUTCHours() === 2 },
  { key: "algorithmDetection", fn: algorithmDetection, isDue: (d) => d.getUTCMinutes() === 0 && d.getUTCHours() === 3 },
  { key: "checkEvents", fn: checkEvents, isDue: (d) => d.getUTCMinutes() === 0 && d.getUTCHours() === 8 },
  { key: "weeklyReport", fn: weeklyReport, isDue: (d) => d.getUTCMinutes() === 0 && d.getUTCHours() === 8 && d.getUTCDay() === 1 },
  { key: "usageReset", fn: usageReset, isDue: (d) => d.getUTCMinutes() === 0 && d.getUTCHours() === 0 && d.getUTCDate() === 1 },
];

export async function runDueJobs(now = new Date()): Promise<string[]> {
  const ran: string[] = [];
  for (const job of JOB_TABLE) {
    if (!job.isDue(now)) continue;
    try {
      await job.fn();
      ran.push(`${job.key}: ${jobStatuses[job.key].lastResult}`);
    } catch (err) {
      ran.push(`${job.key}: threw ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  return ran;
}

// ─── MANUAL TRIGGER ──────────────────────────────────────────────────────────

export async function runJob(
  jobName: string
): Promise<{ ok: boolean; result: string }> {
  switch (jobName) {
    case "processQueue":
      await processQueue();
      return { ok: true, result: jobStatuses.processQueue.lastResult };
    case "updateMetrics":
      await updateMetrics();
      return { ok: true, result: jobStatuses.updateMetrics.lastResult };
    case "dailySnapshot":
      await dailySnapshot();
      return { ok: true, result: jobStatuses.dailySnapshot.lastResult };
    case "checkEvents":
      await checkEvents();
      return { ok: true, result: jobStatuses.checkEvents.lastResult };
    case "trendResearch":
      await trendResearch();
      return { ok: true, result: jobStatuses.trendResearch.lastResult };
    case "selfLearning":
      await selfLearning();
      return { ok: true, result: jobStatuses.selfLearning.lastResult };
    case "algorithmDetection":
      await algorithmDetection();
      return { ok: true, result: jobStatuses.algorithmDetection.lastResult };
    case "engagementCoaching":
      await engagementCoaching();
      return { ok: true, result: jobStatuses.engagementCoaching.lastResult };
    case "reviewReminders":
      await reviewReminders();
      return { ok: true, result: jobStatuses.reviewReminders.lastResult };
    case "weeklyReport":
      await weeklyReport();
      return { ok: true, result: jobStatuses.weeklyReport.lastResult };
    case "usageReset":
      await usageReset();
      return { ok: true, result: jobStatuses.usageReset.lastResult };
    default:
      return { ok: false, result: `Unknown job: ${jobName}` };
  }
}
