import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  boolean,
  real,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── ENUMS ──────────────────────────────────────────────────────────────────

export const platformEnum = pgEnum("platform", [
  "twitter",
  "linkedin",
  "instagram",
  "facebook",
]);

export const draftSourceEnum = pgEnum("draft_source", [
  "manual",
  "ai_generated",
  "trend",
  "event",
  "campaign",
  "ad_copy",
  "manager_bot",
  "auto_research",
]);

export const draftStatusEnum = pgEnum("draft_status", [
  "pending",
  "approved",
  "rejected",
  "posted",
  "archived",
]);

export const queueStatusEnum = pgEnum("queue_status", [
  "scheduled",
  "posting",
  "posted",
  "failed",
  "cancelled",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "completed",
  "paused",
  "cancelled",
]);

export const eventCategoryEnum = pgEnum("event_category", [
  "industry",
  "sale",
  "product_launch",
  "cultural",
  "webinar",
  "conference",
]);

export const imageSourceEnum = pgEnum("image_source", [
  "ai_generated",
  "uploaded",
  "researched",
  "stock",
]);

export const insightTypeEnum = pgEnum("insight_type", [
  "performance",
  "timing",
  "content",
  "audience",
  "trend",
  "competitor",
  "algorithm_change",
  "format",
]);

export const agentEnum = pgEnum("agent", [
  "manager",
  "twitter",
  "instagram",
  "facebook",
  "linkedin",
]);

export const automationModeEnum = pgEnum("automation_mode", [
  "full_auto_generate",
  "semi_auto",
  "on_demand",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending_review",
  "in_discussion",
  "approved",
  "rejected",
  "replacement_pending",
]);

// ─── NEW TABLE: BRAND PROFILES ──────────────────────────────────────────────

export const brandProfiles = pgTable(
  "brand_profiles",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    websiteUrl: text("website_url"),
    industry: text("industry").notNull(),
    subIndustry: text("sub_industry"),
    description: text("description").notNull(),
    valueProposition: text("value_proposition").notNull(),
    products: jsonb("products")
      .$type<
        {
          name: string;
          description: string;
          price?: string;
          targetAudience?: string;
        }[]
      >()
      .default([]),
    tone: jsonb("tone")
      .$type<{
        primary: string;
        secondary?: string;
        avoidWords?: string[];
        powerWords?: string[];
      }>()
      .notNull(),
    targetAudiences: jsonb("target_audiences")
      .$type<
        {
          persona: string;
          painPoints?: string[];
          desires?: string[];
          platforms?: string[];
        }[]
      >()
      .default([]),
    competitors: jsonb("competitors")
      .$type<
        {
          name: string;
          url?: string;
          handle?: string;
          platform?: string;
        }[]
      >()
      .default([]),
    brandKeywords: jsonb("brand_keywords").$type<string[]>().default([]),
    industryKeywords: jsonb("industry_keywords").$type<string[]>().default([]),
    uniqueSellingPoints: jsonb("unique_selling_points")
      .$type<string[]>()
      .default([]),
    contentThemes: jsonb("content_themes").$type<string[]>().default([]),
    contentPillars: jsonb("content_pillars")
      .$type<
        {
          pillar: string;
          percentage: number;
          platforms?: string[];
        }[]
      >()
      .default([]),
    languagePreference: text("language_preference").notNull().default("english"),
    location: jsonb("location").$type<{
      city?: string;
      state?: string;
      country?: string;
    }>(),
    festivals: jsonb("festivals").$type<string[]>().default([]),
    socialLinks: jsonb("social_links")
      .$type<
        {
          platform: string;
          url: string;
          handle?: string;
        }[]
      >()
      .default([]),
    automationMode: automationModeEnum("automation_mode")
      .notNull()
      .default("full_auto_generate"),
    platformsActive: jsonb("platforms_active")
      .$type<string[]>()
      .default(["twitter", "linkedin", "instagram", "facebook"]),
    postsPerDayPerPlatform: integer("posts_per_day_per_platform")
      .notNull()
      .default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("brand_profiles_industry_idx").on(table.industry)]
);

// ─── NEW TABLE: PLATFORM STRATEGIES ─────────────────────────────────────────

export const platformStrategies = pgTable(
  "platform_strategies",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id")
      .references(() => brandProfiles.id, { onDelete: "cascade" })
      .notNull(),
    platform: platformEnum("platform").notNull(),
    strategy: jsonb("strategy")
      .$type<{
        contentMix?: { type: string; percentage: number }[];
        postingFrequency?: number;
        hashtagStrategy?: {
          count: number;
          placement: string;
          clusters?: string[][];
        };
        visualStyle?: {
          aesthetic?: string;
          colorPalette?: string[];
          imageTypes?: string[];
        };
        ctaStrategy?: {
          primary?: string;
          secondary?: string;
          ratio?: string;
        };
        algorithmFocus?: {
          primarySignal?: string;
          secondarySignal?: string;
          avoidSignals?: string[];
        };
        formatPriority?: {
          format: string;
          weight: number;
          reasoning?: string;
        }[];
        timingWindows?: {
          dayOfWeek: string;
          hours: number[];
          confidence?: number;
        }[];
      }>()
      .notNull(),
    active: boolean("active").notNull().default(true),
    lastResearchAt: timestamp("last_research_at", { withTimezone: true }),
    researchConfidence: real("research_confidence").notNull().default(0.5),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("platform_strategies_brand_platform_uniq").on(
      table.brandId,
      table.platform
    ),
  ]
);

// ─── EXISTING TABLES (ENHANCED) ─────────────────────────────────────────────

export const drafts = pgTable(
  "drafts",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id").references(() => brandProfiles.id, {
      onDelete: "set null",
    }),
    text: text("text").notNull(),
    imagePath: text("image_path"),
    imagePrompt: text("image_prompt"),
    platform: platformEnum("platform").notNull().default("twitter"),
    source: draftSourceEnum("source").notNull().default("manual"),
    hashtags: jsonb("hashtags").$type<string[]>().default([]),
    status: draftStatusEnum("status").notNull().default("pending"),
    aiAnalysis: text("ai_analysis"),
    aiScore: real("ai_score"),
    scoreBreakdown: jsonb("score_breakdown").$type<{
      hookStrength?: number;
      ctaClarity?: number;
      platformFit?: number;
      hashtagStrategy?: number;
      saveability?: number;
      shareability?: number;
      replyPotential?: number;
      dwellTimeEstimate?: number;
    }>(),
    targetIndustry: text("target_industry"),
    targetAudience: text("target_audience"),
    contentType: text("content_type"),
    contentPillar: text("content_pillar"),
    primarySignalTarget: text("primary_signal_target"),
    researchBacking: jsonb("research_backing").$type<Record<string, unknown>>(),
    generatedBy: agentEnum("generated_by"),
    parentDraftId: integer("parent_draft_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    index("drafts_status_platform_idx").on(table.status, table.platform),
    index("drafts_created_at_idx").on(table.createdAt),
    index("drafts_brand_id_idx").on(table.brandId),
  ]
);

export const queue = pgTable(
  "queue",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id").references(() => brandProfiles.id, {
      onDelete: "set null",
    }),
    draftId: integer("draft_id").references(() => drafts.id, {
      onDelete: "set null",
    }),
    text: text("text").notNull(),
    imagePath: text("image_path"),
    // Per-platform copy-paste pack + creative prompts (delivered, not posted)
    pack: jsonb("pack").$type<{
      twitter?: string;
      linkedin?: string;
      instagram?: string;
      facebook?: string;
      imagePrompt?: string;
      videoPrompt?: string;
    }>(),
    platform: platformEnum("platform").notNull().default("twitter"),
    scheduledTime: timestamp("scheduled_time", {
      withTimezone: true,
    }).notNull(),
    status: queueStatusEnum("status").notNull().default("scheduled"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postId: text("post_id"),
    postUrl: text("post_url"),
    error: text("error"),
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),
    schedulingReasoning: text("scheduling_reasoning"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("queue_status_scheduled_idx").on(
      table.status,
      table.scheduledTime
    ),
    index("queue_platform_idx").on(table.platform),
    index("queue_brand_id_idx").on(table.brandId),
  ]
);

export const posted = pgTable(
  "posted",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id").references(() => brandProfiles.id, {
      onDelete: "set null",
    }),
    queueId: integer("queue_id").references(() => queue.id, {
      onDelete: "set null",
    }),
    draftId: integer("draft_id").references(() => drafts.id, {
      onDelete: "set null",
    }),
    postId: text("post_id").unique(),
    platform: platformEnum("platform").notNull().default("twitter"),
    text: text("text").notNull(),
    imagePath: text("image_path"),
    postedAt: timestamp("posted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    likes: integer("likes").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    saves: integer("saves").notNull().default(0),
    bookmarks: integer("bookmarks").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    engagementRate: real("engagement_rate"),
    saveRate: real("save_rate"),
    shareRate: real("share_rate"),
    replyDepth: integer("reply_depth").notNull().default(0),
    clickThroughRate: real("click_through_rate"),
    targetIndustry: text("target_industry"),
    contentType: text("content_type"),
    contentPillar: text("content_pillar"),
    primarySignalTarget: text("primary_signal_target"),
    signalSuccess: boolean("signal_success"),
    bestPerforming: boolean("best_performing").notNull().default(false),
    lastMetricsUpdate: timestamp("last_metrics_update", {
      withTimezone: true,
    }),
  },
  (table) => [
    index("posted_platform_date_idx").on(table.platform, table.postedAt),
    uniqueIndex("posted_post_id_idx").on(table.postId),
    index("posted_brand_id_idx").on(table.brandId),
  ]
);

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id").references(() => brandProfiles.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
    category: eventCategoryEnum("category").notNull(),
    description: text("description").notNull().default(""),
    targetIndustries: jsonb("target_industries").$type<string[]>(),
    contentIdeas: jsonb("content_ideas").$type<string[]>(),
    contentGenerated: boolean("content_generated").notNull().default(false),
    platforms: jsonb("platforms")
      .$type<string[]>()
      .default(["twitter", "linkedin", "instagram", "facebook"]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("events_date_idx").on(table.eventDate)]
);

export const analytics = pgTable(
  "analytics",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id").references(() => brandProfiles.id, {
      onDelete: "set null",
    }),
    platform: platformEnum("platform").notNull(),
    type: text("type").notNull().default("daily_snapshot"),
    followers: integer("followers").notNull().default(0),
    following: integer("following").notNull().default(0),
    postCount: integer("post_count").notNull().default(0),
    engagementRate: real("engagement_rate"),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    profileViews: integer("profile_views").notNull().default(0),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("analytics_platform_date_idx").on(
      table.platform,
      table.recordedAt
    ),
  ]
);

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => brandProfiles.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  theme: text("theme").notNull(),
  description: text("description").notNull().default(""),
  targetIndustry: text("target_industry"),
  platforms: jsonb("platforms").$type<string[]>().default(["twitter"]),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  contentPlan: jsonb("content_plan")
    .$type<
      {
        day: number;
        platform: string;
        postText: string;
        contentType: string;
        hashtags: string[];
        imagePrompt?: string;
        status: string;
      }[]
    >()
    .default([]),
  targetAudience: text("target_audience"),
  hashtagStrategy: text("hashtag_strategy"),
  totalEngagement: integer("total_engagement").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const adCopies = pgTable("ad_copies", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => brandProfiles.id, {
    onDelete: "set null",
  }),
  productName: text("product_name").notNull(),
  platform: platformEnum("platform").notNull(),
  targetIndustry: text("target_industry"),
  variants: jsonb("variants")
    .$type<
      {
        angle: string;
        copyText: string;
        cta: string;
        selected: boolean;
        engagementScore?: number;
      }[]
    >()
    .default([]),
  campaignId: integer("campaign_id").references(() => campaigns.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const competitors = pgTable("competitors", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => brandProfiles.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  handle: text("handle").notNull(),
  platform: text("platform").notNull().default("twitter"),
  profileData: jsonb("profile_data").$type<Record<string, unknown>>(),
  analysis: jsonb("analysis").$type<{
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    recommendations: string[];
  }>(),
  contentPatterns: jsonb("content_patterns").$type<{
    postingFrequency: string;
    commonHashtags: string[];
    contentTypes: string[];
    engagementPatterns: string;
    industriesTargeted?: string[];
  }>(),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contentCalendars = pgTable("content_calendars", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => brandProfiles.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull().default("Untitled Calendar"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  weeks: integer("weeks").notNull().default(1),
  platforms: jsonb("platforms").$type<string[]>().default(["twitter"]),
  targetIndustries: jsonb("target_industries").$type<string[]>().default([]),
  items: jsonb("items")
    .$type<
      {
        date: string;
        time: string;
        platform: string;
        text: string;
        contentType: string;
        hashtags: string[];
        targetIndustry?: string;
        imagePrompt?: string;
        status: string;
        aiScore?: number;
      }[]
    >()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const images = pgTable(
  "images",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id").references(() => brandProfiles.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    source: imageSourceEnum("source").notNull().default("uploaded"),
    prompt: text("prompt"),
    platformFit: jsonb("platform_fit").$type<string[]>().default([]),
    tags: jsonb("tags").$type<string[]>().default([]),
    category: text("category"),
    usedCount: integer("used_count").notNull().default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    aiDescription: text("ai_description"),
    width: integer("width"),
    height: integer("height"),
    fileSize: integer("file_size"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("images_source_idx").on(table.source)]
);

export const aiInsights = pgTable(
  "ai_insights",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id").references(() => brandProfiles.id, {
      onDelete: "set null",
    }),
    type: insightTypeEnum("type").notNull(),
    platform: platformEnum("platform"),
    insight: text("insight").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    confidence: real("confidence").notNull().default(0.5),
    applied: boolean("applied").notNull().default(false),
    autoApplied: boolean("auto_applied").notNull().default(false),
    impactScore: real("impact_score"),
    strategyChange: text("strategy_change"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("insights_type_platform_idx").on(table.type, table.platform),
    index("insights_brand_id_idx").on(table.brandId),
  ]
);

export const trendCache = pgTable(
  "trend_cache",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id").references(() => brandProfiles.id, {
      onDelete: "set null",
    }),
    platform: platformEnum("platform").notNull(),
    trends: jsonb("trends")
      .$type<
        {
          name: string;
          volume?: number;
          category?: string;
          velocity?: string;
          relevanceScore?: number;
          suggestedAngle?: string;
        }[]
      >()
      .notNull(),
    hashtags: jsonb("hashtags")
      .$type<{ tag: string; count?: number; trendingSince?: string }[]>()
      .notNull()
      .default([]),
    viralFormats: jsonb("viral_formats").$type<
      { formatType: string; example: string; engagementAvg?: number }[]
    >(),
    competitorSignals: jsonb("competitor_signals").$type<
      Record<string, unknown>
    >(),
    audiencePatterns: jsonb("audience_patterns").$type<
      Record<string, unknown>
    >(),
    contentRecommendations: jsonb("content_recommendations").$type<
      Record<string, unknown>
    >(),
    algorithmSignals: jsonb("algorithm_signals").$type<{
      currentWeights?: Record<string, number>;
      formatBoosts?: { format: string; multiplier: number }[];
      detectedChanges?: {
        signal: string;
        oldWeight: number;
        newWeight: number;
        detectedAt: string;
      }[];
    }>(),
    researchConfidence: real("research_confidence").notNull().default(0.5),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("trends_platform_fetched_idx").on(
      table.platform,
      table.fetchedAt
    ),
    index("trends_brand_id_idx").on(table.brandId),
  ]
);

export const agentLogs = pgTable(
  "agent_logs",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id").references(() => brandProfiles.id, {
      onDelete: "set null",
    }),
    agent: agentEnum("agent").notNull(),
    action: text("action").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>(),
    output: jsonb("output").$type<Record<string, unknown>>(),
    tokensUsed: integer("tokens_used"),
    durationMs: integer("duration_ms"),
    success: boolean("success").notNull().default(true),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("agent_logs_agent_date_idx").on(table.agent, table.createdAt),
    index("agent_logs_brand_id_idx").on(table.brandId),
  ]
);

// ─── NEW TABLE: REVIEW QUEUE ────────────────────────────────────────────────

export const reviewQueue = pgTable(
  "review_queue",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id")
      .references(() => brandProfiles.id, { onDelete: "cascade" })
      .notNull(),
    draftId: integer("draft_id")
      .references(() => drafts.id, { onDelete: "cascade" })
      .notNull(),
    platform: platformEnum("platform").notNull(),
    reviewStatus: reviewStatusEnum("review_status")
      .notNull()
      .default("pending_review"),
    previewData: jsonb("preview_data")
      .$type<Record<string, unknown>>()
      .notNull(),
    aiReasoning: text("ai_reasoning").notNull(),
    aiScore: real("ai_score").notNull().default(0),
    scoreBreakdown: jsonb("score_breakdown").$type<{
      hookStrength?: number;
      ctaClarity?: number;
      platformFit?: number;
      hashtagStrategy?: number;
      saveability?: number;
      shareability?: number;
      replyPotential?: number;
      dwellTimeEstimate?: number;
    }>(),
    targetSignal: text("target_signal").notNull(),
    suggestedTime: timestamp("suggested_time", {
      withTimezone: true,
    }).notNull(),
    researchSummary: text("research_summary"),
    reviewOrder: integer("review_order").notNull().default(0),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewDurationMs: integer("review_duration_ms"),
    approvedVersion: integer("approved_version").notNull().default(1),
    autoReplaceOnReject: boolean("auto_replace_on_reject")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("review_queue_brand_status_idx").on(
      table.brandId,
      table.reviewStatus
    ),
    index("review_queue_order_idx").on(table.reviewOrder),
  ]
);

// ─── NEW TABLE: REVIEW CONVERSATIONS ────────────────────────────────────────

export const reviewConversations = pgTable(
  "review_conversations",
  {
    id: serial("id").primaryKey(),
    reviewQueueId: integer("review_queue_id")
      .references(() => reviewQueue.id, { onDelete: "cascade" })
      .notNull(),
    draftId: integer("draft_id")
      .references(() => drafts.id, { onDelete: "cascade" })
      .notNull(),
    brandId: integer("brand_id")
      .references(() => brandProfiles.id, { onDelete: "cascade" })
      .notNull(),
    messages: jsonb("messages")
      .$type<
        {
          role: "user" | "manager_bot";
          content: string;
          timestamp: string;
          attachments?: { type: "image" | "preview"; url: string }[];
        }[]
      >()
      .notNull()
      .default([]),
    editRequests: jsonb("edit_requests")
      .$type<
        {
          request: string;
          changesMade: string;
          oldVersion: string;
          newVersion: string;
          oldImage?: string;
          newImage?: string;
          timestamp: string;
        }[]
      >()
      .default([]),
    totalEdits: integer("total_edits").notNull().default(0),
    userPreferencesLearned: jsonb("user_preferences_learned")
      .$type<string[]>()
      .default([]),
    resolved: boolean("resolved").notNull().default(false),
    resolvedAction: text("resolved_action"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("review_conversations_brand_resolved_idx").on(
      table.brandId,
      table.resolved
    ),
  ]
);

// ─── NEW TABLE: USAGE METERS ────────────────────────────────────────────────

// ─── AGENT CONVERSATIONS ────────────────────────────────────────────────────
// Transcripts of the agent team collaborating on a post.

export const agentConversations = pgTable(
  "agent_conversations",
  {
    id: serial("id").primaryKey(),
    draftId: integer("draft_id").references(() => drafts.id, {
      onDelete: "cascade",
    }),
    reviewQueueId: integer("review_queue_id").references(() => reviewQueue.id, {
      onDelete: "set null",
    }),
    topic: text("topic").notNull(),
    messages: jsonb("messages")
      .$type<
        {
          agentKey: string;
          name: string;
          designation: string;
          emoji: string;
          content: string;
          timestamp: string;
        }[]
      >()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("agent_conversations_draft_idx").on(table.draftId)]
);

// ─── AGENT MEMORY ───────────────────────────────────────────────────────────
// Per-agent persistent context. `constant` holds standing knowledge that
// never auto-changes (edited only deliberately); `working` is the agent's
// own evolving notebook, updated as it works.

export const agentMemory = pgTable("agent_memory", {
  agentKey: text("agent_key").primaryKey(),
  constant: text("constant").notNull().default(""),
  working: text("working").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── TEAM FEED ──────────────────────────────────────────────────────────────
// The shared team room: one global stream every agent reads and posts to,
// with attachments (drafts, research briefs, image briefs, results).

export const teamFeed = pgTable(
  "team_feed",
  {
    id: serial("id").primaryKey(),
    agentKey: text("agent_key").notNull(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("🤖"),
    content: text("content").notNull(),
    attachments: jsonb("attachments")
      .$type<{ type: string; label: string; content?: string; url?: string; draftId?: number }[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("team_feed_created_idx").on(table.createdAt)]
);

export const usageMeters = pgTable(
  "usage_meters",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id")
      .references(() => brandProfiles.id, { onDelete: "cascade" })
      .notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    postsUsed: integer("posts_used").notNull().default(0),
    postsLimit: integer("posts_limit").notNull(),
    insightsUsed: integer("insights_used").notNull().default(0),
    insightsLimit: integer("insights_limit").notNull(),
    overagePosts: integer("overage_posts").notNull().default(0),
    overageInsights: integer("overage_insights").notNull().default(0),
    planTier: text("plan_tier").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("usage_meters_brand_period_uniq").on(
      table.brandId,
      table.periodStart
    ),
  ]
);

// ─── RELATIONS ──────────────────────────────────────────────────────────────

export const brandProfilesRelations = relations(
  brandProfiles,
  ({ many }) => ({
    platformStrategies: many(platformStrategies),
    drafts: many(drafts),
    queueItems: many(queue),
    postedItems: many(posted),
    reviewQueue: many(reviewQueue),
    reviewConversations: many(reviewConversations),
    usageMeters: many(usageMeters),
    campaigns: many(campaigns),
    aiInsights: many(aiInsights),
    agentLogs: many(agentLogs),
  })
);

export const platformStrategiesRelations = relations(
  platformStrategies,
  ({ one }) => ({
    brand: one(brandProfiles, {
      fields: [platformStrategies.brandId],
      references: [brandProfiles.id],
    }),
  })
);

export const draftsRelations = relations(drafts, ({ many, one }) => ({
  brand: one(brandProfiles, {
    fields: [drafts.brandId],
    references: [brandProfiles.id],
  }),
  queueItems: many(queue),
  postedItems: many(posted),
  reviewQueueItems: many(reviewQueue),
  parentDraft: one(drafts, {
    fields: [drafts.parentDraftId],
    references: [drafts.id],
    relationName: "draftVariants",
  }),
  variants: many(drafts, { relationName: "draftVariants" }),
}));

export const queueRelations = relations(queue, ({ one }) => ({
  brand: one(brandProfiles, {
    fields: [queue.brandId],
    references: [brandProfiles.id],
  }),
  draft: one(drafts, { fields: [queue.draftId], references: [drafts.id] }),
  postedItem: one(posted),
}));

export const postedRelations = relations(posted, ({ one }) => ({
  brand: one(brandProfiles, {
    fields: [posted.brandId],
    references: [brandProfiles.id],
  }),
  queueItem: one(queue, {
    fields: [posted.queueId],
    references: [queue.id],
  }),
  draft: one(drafts, { fields: [posted.draftId], references: [drafts.id] }),
}));

export const reviewQueueRelations = relations(
  reviewQueue,
  ({ one, many }) => ({
    brand: one(brandProfiles, {
      fields: [reviewQueue.brandId],
      references: [brandProfiles.id],
    }),
    draft: one(drafts, {
      fields: [reviewQueue.draftId],
      references: [drafts.id],
    }),
    conversations: many(reviewConversations),
  })
);

export const reviewConversationsRelations = relations(
  reviewConversations,
  ({ one }) => ({
    reviewQueueItem: one(reviewQueue, {
      fields: [reviewConversations.reviewQueueId],
      references: [reviewQueue.id],
    }),
    draft: one(drafts, {
      fields: [reviewConversations.draftId],
      references: [drafts.id],
    }),
    brand: one(brandProfiles, {
      fields: [reviewConversations.brandId],
      references: [brandProfiles.id],
    }),
  })
);

export const usageMetersRelations = relations(usageMeters, ({ one }) => ({
  brand: one(brandProfiles, {
    fields: [usageMeters.brandId],
    references: [brandProfiles.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  brand: one(brandProfiles, {
    fields: [campaigns.brandId],
    references: [brandProfiles.id],
  }),
  adCopies: many(adCopies),
}));

export const adCopiesRelations = relations(adCopies, ({ one }) => ({
  brand: one(brandProfiles, {
    fields: [adCopies.brandId],
    references: [brandProfiles.id],
  }),
  campaign: one(campaigns, {
    fields: [adCopies.campaignId],
    references: [campaigns.id],
  }),
}));

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type BrandProfile = typeof brandProfiles.$inferSelect;
export type NewBrandProfile = typeof brandProfiles.$inferInsert;
export type PlatformStrategy = typeof platformStrategies.$inferSelect;
export type NewPlatformStrategy = typeof platformStrategies.$inferInsert;
export type Draft = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
export type QueueItem = typeof queue.$inferSelect;
export type NewQueueItem = typeof queue.$inferInsert;
export type PostedItem = typeof posted.$inferSelect;
export type Event = typeof events.$inferSelect;
export type AnalyticsSnapshot = typeof analytics.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type AdCopy = typeof adCopies.$inferSelect;
export type Competitor = typeof competitors.$inferSelect;
export type ContentCalendar = typeof contentCalendars.$inferSelect;
export type ImageRecord = typeof images.$inferSelect;
export type AiInsight = typeof aiInsights.$inferSelect;
export type TrendCacheEntry = typeof trendCache.$inferSelect;
export type AgentLog = typeof agentLogs.$inferSelect;
export type ReviewQueueItem = typeof reviewQueue.$inferSelect;
export type NewReviewQueueItem = typeof reviewQueue.$inferInsert;
export type ReviewConversation = typeof reviewConversations.$inferSelect;
export type NewReviewConversation = typeof reviewConversations.$inferInsert;
export type UsageMeter = typeof usageMeters.$inferSelect;
export type NewUsageMeter = typeof usageMeters.$inferInsert;
