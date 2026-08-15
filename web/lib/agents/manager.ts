// ─── MANAGER BOT — CENTRAL ORCHESTRATOR ──────────────────────────────────────
// The brain of the system. Receives user commands, distributes tasks to
// Platform Bots, aggregates results, handles scheduling, and delivers reports.

import { v4 as uuid } from "uuid";
import type {
  AgentTask,
  AgentResult,
  Platform,
  ContentPlan,
  PlatformPost,
  GeneratePostOptions,
  SchedulingRecommendation,
  TrendData,
} from "./types";
import { PLATFORM_CONFIGS, getPlatformSystemPrompt } from "./platform-configs";
import { getBrandPrompt, getSmartBrandPrompt } from "../brand";

export class ManagerBot {
  /**
   * Plan content across multiple platforms from a user request.
   * This is the main entry point for content generation.
   */
  async planContent(
    userRequest: string,
    platforms: Platform[],
    options?: GeneratePostOptions & {
      generateFn?: (systemPrompt: string, userPrompt: string) => Promise<string>;
      brandId?: number;
    }
  ): Promise<ContentPlan> {
    const planId = uuid();

    // Create tasks for each platform
    const tasks: AgentTask[] = platforms.map((platform) => ({
      id: uuid(),
      type: "generate_post" as const,
      platform,
      input: {
        userRequest,
        targetIndustry: options?.targetIndustry,
        contentType: options?.contentType,
        tone: options?.tone,
        trendContext: options?.trendContext,
        insightContext: options?.insightContext,
        brandId: options?.brandId,
      },
      priority: "medium" as const,
      createdAt: new Date(),
    }));

    // Distribute tasks and collect results
    const results = await this.distributeTasks(tasks, options?.generateFn);

    // Aggregate into a content plan
    const posts = this.aggregateResults(results);

    return {
      id: planId,
      topic: userRequest,
      platforms,
      posts,
      createdAt: new Date(),
    };
  }

  /**
   * Distribute tasks to the correct platform bots.
   * Runs all platform tasks in parallel for speed.
   */
  async distributeTasks(
    tasks: AgentTask[],
    generateFn?: (systemPrompt: string, userPrompt: string) => Promise<string>
  ): Promise<AgentResult[]> {
    const results = await Promise.allSettled(
      tasks.map(async (task) => {
        const startTime = Date.now();

        try {
          const result = await this.executeTask(task, generateFn);
          return {
            ...result,
            durationMs: Date.now() - startTime,
          };
        } catch (error) {
          return {
            taskId: task.id,
            agent: task.platform as AgentResult["agent"],
            success: false,
            data: null,
            reasoning: `Task failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            confidence: 0,
            suggestedActions: ["Retry task", "Check AI provider status"],
            durationMs: Date.now() - startTime,
          } satisfies AgentResult;
        }
      })
    );

    return results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : {
            taskId: "unknown",
            agent: "manager" as const,
            success: false,
            data: null,
            reasoning: "Promise rejected",
            confidence: 0,
            suggestedActions: ["Retry"],
          }
    );
  }

  /**
   * Execute a single task by building the appropriate prompt.
   */
  private async executeTask(
    task: AgentTask,
    generateFn?: (systemPrompt: string, userPrompt: string) => Promise<string>
  ): Promise<AgentResult> {
    const platformPrompt = getPlatformSystemPrompt(task.platform);

    // Use smart brand prompt: DB brand if available, fallback to hardcoded
    const brandId = task.input.brandId as number | undefined;
    const brandPrompt = await getSmartBrandPrompt(
      brandId,
      task.platform,
      task.input.targetIndustry as string | undefined
    );

    const systemPrompt = `${brandPrompt}\n\n${platformPrompt}`;

    const userPrompt = this.buildUserPrompt(task);

    // Use provided generate function (Puter.js or Gemini)
    if (generateFn) {
      const response = await generateFn(systemPrompt, userPrompt);
      return {
        taskId: task.id,
        agent: task.platform as AgentResult["agent"],
        success: true,
        data: this.parseGeneratedContent(response, task.platform),
        reasoning: `Generated ${task.platform} content based on user request`,
        confidence: 0.8,
        suggestedActions: ["Review content", "Schedule post"],
      };
    }

    // Fallback: return a placeholder (caller must provide generateFn)
    return {
      taskId: task.id,
      agent: task.platform as AgentResult["agent"],
      success: false,
      data: null,
      reasoning: "No AI generate function provided",
      confidence: 0,
      suggestedActions: ["Provide a generateFn (Puter.js or Gemini)"],
    };
  }

  /**
   * Build the user-facing prompt for a task.
   */
  private buildUserPrompt(task: AgentTask): string {
    const config = PLATFORM_CONFIGS[task.platform];
    const parts: string[] = [];

    parts.push(`Generate a ${config.name} post about: ${task.input.userRequest}`);

    if (task.input.targetIndustry) {
      parts.push(`Target industry: ${task.input.targetIndustry}`);
    }

    if (task.input.contentType) {
      parts.push(`Content style: ${task.input.contentType}`);
    }

    if (task.input.trendContext) {
      const trends = task.input.trendContext as TrendData[];
      if (trends.length > 0) {
        parts.push(
          `Currently trending: ${trends.map((t) => t.name).join(", ")}`
        );
      }
    }

    parts.push(`\nRespond with ONLY the post text. No explanations, no quotes around it.`);
    parts.push(`Stay within ${config.charLimit} characters.`);
    parts.push(`Include up to ${config.hashtagLimit} relevant hashtags.`);

    return parts.join("\n");
  }

  /**
   * Parse raw AI response into structured content.
   */
  private parseGeneratedContent(
    response: string,
    platform: Platform
  ): PlatformPost {
    const text = response.trim();

    // Extract hashtags from text
    const hashtagRegex = /#[\w]+/g;
    const hashtags = text.match(hashtagRegex) || [];

    return {
      platform,
      text,
      hashtags,
      contentType: "text_only",
      aiScore: undefined,
      reasoning: undefined,
      targetIndustry: undefined,
    };
  }

  /**
   * Aggregate results from multiple platform bots.
   * Merges, deduplicates, and ranks by confidence.
   */
  aggregateResults(results: AgentResult[]): PlatformPost[] {
    return results
      .filter((r) => r.success && r.data)
      .sort((a, b) => b.confidence - a.confidence)
      .map((r) => r.data as PlatformPost);
  }

  /**
   * Get optimal scheduling recommendation for a platform.
   * Uses historical performance data from ai_insights.
   */
  getSchedulingRecommendation(
    platform: Platform,
    _contentType?: string
  ): SchedulingRecommendation {
    const config = PLATFORM_CONFIGS[platform];
    const now = new Date();

    // Default: use platform peak hours
    // In production, this queries ai_insights for historical optimal times
    const nextPeakHour = config.peakHours.find((h) => h > now.getHours()) ||
      config.peakHours[0];

    const recommendedTime = new Date(now);
    if (nextPeakHour <= now.getHours()) {
      recommendedTime.setDate(recommendedTime.getDate() + 1);
    }
    recommendedTime.setHours(nextPeakHour, 0, 0, 0);

    const alternativeTimes = config.peakHours
      .filter((h) => h !== nextPeakHour)
      .map((h) => {
        const d = new Date(now);
        if (h <= now.getHours()) d.setDate(d.getDate() + 1);
        d.setHours(h, 0, 0, 0);
        return d;
      });

    return {
      platform,
      recommendedTime,
      confidence: 0.7, // Default confidence, improves with data
      reasoning: `Based on ${config.name} peak engagement hours (IST): ${config.peakHours.join(", ")}`,
      alternativeTimes,
    };
  }

  /**
   * Handle a trend alert from a platform bot.
   * Evaluates relevance and optionally triggers content generation.
   */
  async handleTrendAlert(
    platform: Platform,
    trend: TrendData,
    generateFn?: (systemPrompt: string, userPrompt: string) => Promise<string>
  ): Promise<{
    isRelevant: boolean;
    urgency: "low" | "medium" | "high";
    suggestedAction: string;
    generatedDraft?: PlatformPost;
  }> {
    const relevance = trend.relevanceScore ?? 0;

    if (relevance < 0.5) {
      return {
        isRelevant: false,
        urgency: "low",
        suggestedAction: "Ignore — low relevance to brand",
      };
    }

    const urgency = relevance > 0.8 ? "high" : "medium";

    if (urgency === "high" && generateFn) {
      // Auto-generate draft for high-relevance trends
      const plan = await this.planContent(
        `Create a post about the trending topic "${trend.name}". Angle: ${trend.suggestedAngle || "relate it to AI automation for businesses"}`,
        [platform],
        { trendContext: [trend], generateFn }
      );

      return {
        isRelevant: true,
        urgency,
        suggestedAction: "High-impact trend detected. Draft auto-generated — review and approve.",
        generatedDraft: plan.posts[0],
      };
    }

    return {
      isRelevant: true,
      urgency,
      suggestedAction: `Trending: "${trend.name}" — consider creating content with angle: ${trend.suggestedAngle || "brand relevance"}`,
    };
  }
}

// Singleton instance
export const managerBot = new ManagerBot();
