// ─── MULTI-AGENT SYSTEM TYPES ────────────────────────────────────────────────
// Shared types for the Manager Bot and all Platform Bots.

export type Platform = "twitter" | "linkedin" | "instagram" | "facebook";
export type Agent = "manager" | "twitter" | "instagram" | "facebook" | "linkedin";

export type TaskType =
  | "generate_post"
  | "research_trends"
  | "analyze_content"
  | "generate_image"
  | "optimize_timing"
  | "analyze_competitor"
  | "generate_thread"
  | "generate_carousel"
  | "generate_ad_copy"
  | "generate_campaign";

export type Priority = "low" | "medium" | "high" | "urgent";

export interface AgentTask {
  id: string;
  type: TaskType;
  platform: Platform;
  input: Record<string, unknown>;
  priority: Priority;
  createdAt: Date;
}

export interface AgentResult {
  taskId: string;
  agent: Agent;
  success: boolean;
  data: unknown;
  reasoning: string;
  confidence: number; // 0 to 1
  suggestedActions: string[];
  durationMs?: number;
  tokensUsed?: number;
}

export interface PlatformConfig {
  name: string;
  platform: Platform;
  charLimit: number;
  hashtagLimit: number;
  emojiLimit: number;
  bestPractices: string;
  contentStyles: string[];
  audienceType: string;
  peakHours: number[]; // IST hours
  imageSpecs: {
    width: number;
    height: number;
    formats: string[];
  };
}

export interface ContentPlan {
  id: string;
  topic: string;
  platforms: Platform[];
  posts: PlatformPost[];
  createdAt: Date;
}

export interface PlatformPost {
  platform: Platform;
  text: string;
  hashtags: string[];
  imagePrompt?: string;
  imagePath?: string;
  scheduledTime?: Date;
  contentType: string;
  aiScore?: number;
  reasoning?: string;
  targetIndustry?: string;
}

export interface TrendData {
  name: string;
  volume?: number;
  category?: string;
  velocity?: string;
  relevanceScore?: number;
  suggestedAngle?: string;
}

export interface InsightData {
  type: string;
  platform?: Platform;
  insight: string;
  data: Record<string, unknown>;
  confidence: number;
}

// AI provider abstraction
export type AIProvider = "puter" | "gemini";

export interface AICallOptions {
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface GeneratePostOptions {
  topic?: string;
  targetIndustry?: string;
  contentType?: string;
  trendContext?: TrendData[];
  insightContext?: InsightData[];
  tone?: string;
  includeImage?: boolean;
}

export interface SchedulingRecommendation {
  platform: Platform;
  recommendedTime: Date;
  confidence: number;
  reasoning: string;
  alternativeTimes: Date[];
}
