// ─── FACEBOOK BOT — Platform Specialist ──────────────────────────────────────
// Expert in Facebook's community-driven algorithm, storytelling, and shareability.

import { v4 as uuid } from "uuid";
import type { AgentResult, GeneratePostOptions, TrendData, PlatformPost } from "./types";
import { FACEBOOK_CONFIG, getPlatformSystemPrompt } from "./platform-configs";
import { getBrandPrompt } from "../brand";

type GenerateFn = (systemPrompt: string, userPrompt: string) => Promise<string>;

export class FacebookBot {
  private config = FACEBOOK_CONFIG;

  /**
   * Generate a Facebook post (storytelling / community style).
   */
  async generatePost(
    context: string,
    generateFn: GenerateFn,
    options?: GeneratePostOptions
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const systemPrompt = `${getBrandPrompt("facebook", options?.targetIndustry)}\n\n${getPlatformSystemPrompt("facebook")}`;

    const userPrompt = `Write a Facebook post about: ${context}
${options?.contentType ? `Style: ${options.contentType}` : "Style: storytelling"}

Rules:
- Use storytelling format — people love narratives on Facebook
- 150-300 words is the sweet spot
- Start with something relatable or surprising
- Use "you" and "your" to make it personal
- Ask a question at the end to drive comments
- Include 2-3 relevant hashtags
- 2-3 emojis max
- Make it shareable — people should want to tag a friend

Write ONLY the post. No explanations.`;

    try {
      const response = await generateFn(systemPrompt, userPrompt);
      const text = response.trim();
      const hashtags = text.match(/#[\w]+/g) || [];

      return {
        taskId: uuid(),
        agent: "facebook",
        success: true,
        data: {
          platform: "facebook",
          text,
          hashtags,
          contentType: options?.contentType || "story",
          targetIndustry: options?.targetIndustry,
        } as PlatformPost,
        reasoning: "Generated Facebook post with storytelling format and engagement hook",
        confidence: 0.85,
        suggestedActions: ["Review", "Add image", "Schedule"],
      };
    } catch (error) {
      return {
        taskId: uuid(),
        agent: "facebook",
        success: false,
        data: null,
        reasoning: `Failed: ${error instanceof Error ? error.message : "Unknown"}`,
        confidence: 0,
        suggestedActions: ["Retry"],
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate a post optimized for Facebook groups.
   */
  async generateGroupPost(
    topic: string,
    generateFn: GenerateFn,
    groupContext?: string
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const systemPrompt = `${getBrandPrompt("facebook")}\n\n${getPlatformSystemPrompt("facebook")}\n\nYou are writing for a Facebook GROUP. Group posts should feel like peer-to-peer sharing, not brand broadcasting. Ask genuine questions, share experiences, invite discussion.`;

    const userPrompt = `Write a Facebook group post about: ${topic}
${groupContext ? `Group context: ${groupContext}` : ""}

Rules:
- NO hard selling — groups hate it
- Share as a peer, not a brand
- Ask a genuine question
- Provide value first (tip, insight, experience)
- Keep it conversational
- No excessive hashtags (max 1-2)

Write ONLY the post.`;

    try {
      const response = await generateFn(systemPrompt, userPrompt);
      const text = response.trim();

      return {
        taskId: uuid(),
        agent: "facebook",
        success: true,
        data: {
          platform: "facebook",
          text,
          hashtags: text.match(/#[\w]+/g) || [],
          contentType: "community_post",
        } as PlatformPost,
        reasoning: "Generated group-friendly Facebook post — peer-to-peer style",
        confidence: 0.8,
        suggestedActions: ["Review tone", "Post to group", "Schedule"],
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: uuid(),
        agent: "facebook",
        success: false,
        data: null,
        reasoning: `Failed: ${error instanceof Error ? error.message : "Unknown"}`,
        confidence: 0,
        suggestedActions: ["Retry"],
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Research trending topics on Facebook.
   */
  async researchTrends(generateFn: GenerateFn): Promise<TrendData[]> {
    const systemPrompt = `You are a Facebook trend analyst for the Indian business community.`;

    const userPrompt = `What are the top 10 trending discussion topics on Facebook right now for Indian business communities?

Focus on: tech, automation, small business, startups, SaaS, AI

For each, provide JSON:
[{"name": "...", "category": "...", "velocity": "...", "relevanceScore": 0.0, "suggestedAngle": "..."}]`;

    try {
      const response = await generateFn(systemPrompt, userPrompt);
      const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      return JSON.parse(cleaned) as TrendData[];
    } catch {
      return [];
    }
  }

  /**
   * Get optimal posting time.
   */
  getOptimalPostingTime(): { hour: number; reasoning: string } {
    const now = new Date();
    const currentHour = now.getHours();
    const nextPeak = this.config.peakHours.find((h) => h > currentHour) || this.config.peakHours[0];

    return {
      hour: nextPeak,
      reasoning: `Facebook peak hours (IST): ${this.config.peakHours.join(", ")}. Best for shares: 13:00-16:00`,
    };
  }
}

export const facebookBot = new FacebookBot();
