// ─── USAGE METERING ──────────────────────────────────────────────────────────
// SaaS-ready usage tracking for multi-client billing.
// Tracks posts and insights per brand per billing period.

import { db } from "./db";
import { usageMeters } from "./schema";
import { eq, and, lte, gte } from "drizzle-orm";

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface UsageStatus {
  brandId: number;
  period: {
    start: Date;
    end: Date;
  };
  posts: {
    used: number;
    limit: number;
    remaining: number;
    overage: number;
    percentUsed: number;
  };
  insights: {
    used: number;
    limit: number;
    remaining: number;
    overage: number;
    percentUsed: number;
  };
  planTier: string;
  withinLimits: boolean;
}

// ─── PLAN LIMITS ────────────────────────────────────────────────────────────

const PLAN_LIMITS: Record<string, { postsLimit: number; insightsLimit: number }> = {
  starter: { postsLimit: 30, insightsLimit: 50 },
  growth: { postsLimit: 120, insightsLimit: 200 },
  partner: { postsLimit: 500, insightsLimit: 1000 },
  enterprise: { postsLimit: 9999, insightsLimit: 9999 },
};

// ─── GET CURRENT PERIOD ─────────────────────────────────────────────────────

function getCurrentPeriodDates(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

// ─── METER USAGE ────────────────────────────────────────────────────────────

/**
 * Increment usage counter for a brand.
 * Creates the period if it doesn't exist.
 */
export async function meterUsage(
  brandId: number,
  action: "post" | "insight"
): Promise<{ success: boolean; withinLimits: boolean; usage: UsageStatus | null }> {
  const { start, end } = getCurrentPeriodDates();

  // Find or create usage meter for current period
  let meter = await db.query.usageMeters.findFirst({
    where: and(
      eq(usageMeters.brandId, brandId),
      gte(usageMeters.periodStart, start),
      lte(usageMeters.periodEnd, end)
    ),
  });

  if (!meter) {
    // Create new period
    const [created] = await db
      .insert(usageMeters)
      .values({
        brandId,
        periodStart: start,
        periodEnd: end,
        postsUsed: 0,
        postsLimit: PLAN_LIMITS.growth.postsLimit,
        insightsUsed: 0,
        insightsLimit: PLAN_LIMITS.growth.insightsLimit,
        planTier: "growth",
      })
      .returning();
    meter = created;
  }

  // Increment the appropriate counter
  if (action === "post") {
    const newPostsUsed = meter.postsUsed + 1;
    const isOverage = newPostsUsed > meter.postsLimit;

    await db
      .update(usageMeters)
      .set({
        postsUsed: newPostsUsed,
        overagePosts: isOverage
          ? meter.overagePosts + 1
          : meter.overagePosts,
      })
      .where(eq(usageMeters.id, meter.id));
  } else {
    const newInsightsUsed = meter.insightsUsed + 1;
    const isOverage = newInsightsUsed > meter.insightsLimit;

    await db
      .update(usageMeters)
      .set({
        insightsUsed: newInsightsUsed,
        overageInsights: isOverage
          ? meter.overageInsights + 1
          : meter.overageInsights,
      })
      .where(eq(usageMeters.id, meter.id));
  }

  // Return updated usage
  const usage = await getUsage(brandId);
  return {
    success: true,
    withinLimits: usage?.withinLimits ?? true,
    usage,
  };
}

// ─── GET USAGE ──────────────────────────────────────────────────────────────

/**
 * Get current period usage for a brand.
 */
export async function getUsage(brandId: number): Promise<UsageStatus | null> {
  const { start, end } = getCurrentPeriodDates();

  const meter = await db.query.usageMeters.findFirst({
    where: and(
      eq(usageMeters.brandId, brandId),
      gte(usageMeters.periodStart, start),
      lte(usageMeters.periodEnd, end)
    ),
  });

  if (!meter) return null;

  const postsRemaining = Math.max(0, meter.postsLimit - meter.postsUsed);
  const insightsRemaining = Math.max(0, meter.insightsLimit - meter.insightsUsed);

  return {
    brandId,
    period: {
      start: meter.periodStart,
      end: meter.periodEnd,
    },
    posts: {
      used: meter.postsUsed,
      limit: meter.postsLimit,
      remaining: postsRemaining,
      overage: meter.overagePosts,
      percentUsed: meter.postsLimit > 0
        ? Math.min(100, (meter.postsUsed / meter.postsLimit) * 100)
        : 0,
    },
    insights: {
      used: meter.insightsUsed,
      limit: meter.insightsLimit,
      remaining: insightsRemaining,
      overage: meter.overageInsights,
      percentUsed: meter.insightsLimit > 0
        ? Math.min(100, (meter.insightsUsed / meter.insightsLimit) * 100)
        : 0,
    },
    planTier: meter.planTier,
    withinLimits: postsRemaining > 0 && insightsRemaining > 0,
  };
}

// ─── CHECK QUOTA ────────────────────────────────────────────────────────────

/**
 * Check if a brand is within usage limits for a specific action.
 * Returns true if the brand can proceed.
 */
export async function checkQuota(
  brandId: number,
  action: "post" | "insight"
): Promise<boolean> {
  const usage = await getUsage(brandId);
  if (!usage) return true; // No meter = no limits

  if (action === "post") {
    return usage.posts.remaining > 0;
  }
  return usage.insights.remaining > 0;
}

// ─── CREATE NEW PERIOD ──────────────────────────────────────────────────────

/**
 * Create a new monthly usage period for a brand.
 * Used by the scheduler on the 1st of each month.
 */
export async function createNewPeriod(
  brandId: number,
  tier: string = "growth"
): Promise<void> {
  const { start, end } = getCurrentPeriodDates();
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.growth;

  try {
    await db.insert(usageMeters).values({
      brandId,
      periodStart: start,
      periodEnd: end,
      postsUsed: 0,
      postsLimit: limits.postsLimit,
      insightsUsed: 0,
      insightsLimit: limits.insightsLimit,
      planTier: tier,
    });
  } catch {
    // Unique constraint violation — period already exists
  }
}

// ─── UPDATE PLAN TIER ───────────────────────────────────────────────────────

/**
 * Update a brand's plan tier, adjusting limits for the current period.
 */
export async function updatePlanTier(
  brandId: number,
  newTier: string
): Promise<void> {
  const { start, end } = getCurrentPeriodDates();
  const limits = PLAN_LIMITS[newTier] || PLAN_LIMITS.growth;

  const meter = await db.query.usageMeters.findFirst({
    where: and(
      eq(usageMeters.brandId, brandId),
      gte(usageMeters.periodStart, start),
      lte(usageMeters.periodEnd, end)
    ),
  });

  if (meter) {
    await db
      .update(usageMeters)
      .set({
        planTier: newTier,
        postsLimit: limits.postsLimit,
        insightsLimit: limits.insightsLimit,
      })
      .where(eq(usageMeters.id, meter.id));
  } else {
    await createNewPeriod(brandId, newTier);
  }
}
