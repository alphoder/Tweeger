// ─── LINKEDIN BOT — Platform Specialist ──────────────────────────────────────
// Expert in LinkedIn's professional algorithm, thought leadership, and B2B content.

import { v4 as uuid } from "uuid";
import type { AgentResult, GeneratePostOptions, TrendData, PlatformPost } from "./types";
import { LINKEDIN_CONFIG, getPlatformSystemPrompt } from "./platform-configs";
import { getBrandPrompt } from "../brand";

type GenerateFn = (systemPrompt: string, userPrompt: string) => Promise<string>;

export class LinkedInBot {
  private config = LINKEDIN_CONFIG;

  /**
   * Generate a LinkedIn thought leadership post.
   */
  async generatePost(
    context: string,
    generateFn: GenerateFn,
    options?: GeneratePostOptions
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const systemPrompt = `${getBrandPrompt("linkedin", options?.targetIndustry)}\n\n${getPlatformSystemPrompt("linkedin")}`;

    const userPrompt = `Write a LinkedIn post about: ${context}
${options?.contentType ? `Style: ${options.contentType}` : "Style: thought leadership"}

Rules:
- Open with a bold statement or shocking stat — hook in line 1
- Use line breaks aggressively — one thought per line
- Tell a professional story with a lesson
- Back claims with data or specific examples
- End with a question to drive engagement
- 3-5 relevant hashtags at the end
- Under 3000 characters
- No hard selling — value first, product mention only if natural
- Sound like a founder sharing real insights, not a marketer

Write ONLY the post. No meta-commentary.`;

    try {
      const response = await generateFn(systemPrompt, userPrompt);
      const text = response.trim();
      const hashtags = text.match(/#[\w]+/g) || [];

      return {
        taskId: uuid(),
        agent: "linkedin",
        success: true,
        data: {
          platform: "linkedin",
          text,
          hashtags,
          contentType: options?.contentType || "thought_leadership",
          targetIndustry: options?.targetIndustry,
        } as PlatformPost,
        reasoning: "Generated LinkedIn thought leadership post with hook, story, and engagement CTA",
        confidence: 0.85,
        suggestedActions: ["Review", "Add professional image", "Schedule"],
      };
    } catch (error) {
      return {
        taskId: uuid(),
        agent: "linkedin",
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
   * Generate a LinkedIn article outline.
   */
  async generateArticleOutline(
    topic: string,
    generateFn: GenerateFn
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const systemPrompt = `${getBrandPrompt("linkedin")}\n\nYou are a LinkedIn article strategist. LinkedIn articles rank in Google search and position the author as an industry expert.`;

    const userPrompt = `Create a detailed outline for a LinkedIn article about: ${topic}

Include:
1. Title (click-worthy but professional — no clickbait)
2. Subtitle/hook
3. 5-7 section headings with 2-3 bullet points each
4. Suggested data points or case studies to include
5. Conclusion + CTA
6. 5 SEO-friendly hashtags

Format it clearly with headers and bullet points.`;

    try {
      const response = await generateFn(systemPrompt, userPrompt);

      return {
        taskId: uuid(),
        agent: "linkedin",
        success: true,
        data: {
          type: "article_outline",
          rawOutline: response.trim(),
          topic,
          platform: "linkedin",
        },
        reasoning: `Generated LinkedIn article outline for "${topic}"`,
        confidence: 0.8,
        suggestedActions: ["Write full article", "Convert to post series", "Schedule"],
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: uuid(),
        agent: "linkedin",
        success: false,
        data: null,
        reasoning: `Article outline failed: ${error instanceof Error ? error.message : "Unknown"}`,
        confidence: 0,
        suggestedActions: ["Retry"],
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Research trending topics on LinkedIn.
   */
  async researchTrends(generateFn: GenerateFn): Promise<TrendData[]> {
    const systemPrompt = `You are a LinkedIn trend analyst for B2B tech and AI automation companies in India.`;

    const userPrompt = `What are the top 10 trending professional/industry topics on LinkedIn right now?

Focus on: AI, automation, SaaS, B2B, Indian startups, digital transformation, business technology

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
   * Get optimal posting time for LinkedIn.
   */
  getOptimalPostingTime(): { hour: number; reasoning: string } {
    const now = new Date();
    const currentHour = now.getHours();
    const nextPeak = this.config.peakHours.find((h) => h > currentHour) || this.config.peakHours[0];

    return {
      hour: nextPeak,
      reasoning: `LinkedIn peak hours (IST): ${this.config.peakHours.join(", ")}. Tue-Thu mornings get 2x engagement`,
    };
  }
}

export const linkedinBot = new LinkedInBot();
