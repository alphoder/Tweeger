// ─── INSTAGRAM BOT — Platform Specialist ─────────────────────────────────────
// Expert in Instagram's visual-first algorithm, carousel strategy, and hashtag optimization.

import { v4 as uuid } from "uuid";
import type { AgentResult, GeneratePostOptions, TrendData, PlatformPost } from "./types";
import { INSTAGRAM_CONFIG, getPlatformSystemPrompt } from "./platform-configs";
import { getBrandPrompt } from "../brand";

type GenerateFn = (systemPrompt: string, userPrompt: string) => Promise<string>;

export class InstagramBot {
  private config = INSTAGRAM_CONFIG;

  /**
   * Generate an Instagram caption.
   */
  async generateCaption(
    context: string,
    generateFn: GenerateFn,
    options?: GeneratePostOptions
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const systemPrompt = `${getBrandPrompt("instagram", options?.targetIndustry)}\n\n${getPlatformSystemPrompt("instagram")}`;

    const userPrompt = `Write an Instagram caption about: ${context}
${options?.contentType ? `Style: ${options.contentType}` : "Style: engaging post"}

Rules:
- Strong opening line (gets truncated at ~125 chars — make it count)
- Use line breaks for readability
- Include a CTA (save this, share with someone, drop a comment)
- 5-15 relevant hashtags at the end
- 2-3 emojis max, placed naturally
- Under 2200 characters total
- If the topic allows, suggest what image would pair well (as a note at the end after "IMAGE SUGGESTION: ")

Write the caption first, then hashtags, then image suggestion.`;

    try {
      const response = await generateFn(systemPrompt, userPrompt);
      let text = response.trim();

      // Extract image suggestion if present
      let imagePrompt: string | undefined;
      const imgSuggestion = text.match(/IMAGE SUGGESTION:\s*([\s\S]*)/i);
      if (imgSuggestion) {
        imagePrompt = imgSuggestion[1].trim();
        text = text.replace(/IMAGE SUGGESTION:\s*[\s\S]*/i, "").trim();
      }

      const hashtags = text.match(/#[\w]+/g) || [];

      return {
        taskId: uuid(),
        agent: "instagram",
        success: true,
        data: {
          platform: "instagram",
          text,
          hashtags,
          imagePrompt,
          contentType: options?.contentType || "post",
          targetIndustry: options?.targetIndustry,
        } as PlatformPost,
        reasoning: "Generated Instagram caption with hook, CTA, and hashtag strategy",
        confidence: 0.85,
        suggestedActions: ["Generate image", "Review hashtags", "Schedule"],
      };
    } catch (error) {
      return {
        taskId: uuid(),
        agent: "instagram",
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
   * Generate a carousel post plan with slide-by-slide content.
   */
  async generateCarouselPlan(
    topic: string,
    generateFn: GenerateFn,
    slideCount: number = 7
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const systemPrompt = `${getBrandPrompt("instagram")}\n\n${getPlatformSystemPrompt("instagram")}`;

    const userPrompt = `Create a ${slideCount}-slide Instagram carousel about: ${topic}

For each slide provide:
1. Slide number
2. Heading (bold, short — max 8 words)
3. Body text (2-3 short lines)
4. Visual description (what the slide should look like)

Format:
SLIDE 1:
Heading: ...
Body: ...
Visual: ...

Also provide:
- A caption for the post (with CTA and hashtags)

Rules:
- Slide 1 = eye-catching hook/title
- Last slide = CTA (follow, save, share, link in bio)
- Each slide must provide standalone value
- Use simple, scannable text
- Data points and numbers perform well`;

    try {
      const response = await generateFn(systemPrompt, userPrompt);

      return {
        taskId: uuid(),
        agent: "instagram",
        success: true,
        data: {
          type: "carousel",
          rawPlan: response.trim(),
          slideCount,
          topic,
          platform: "instagram",
        },
        reasoning: `Generated ${slideCount}-slide carousel plan for "${topic}"`,
        confidence: 0.8,
        suggestedActions: ["Generate slide images", "Review and edit", "Schedule"],
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: uuid(),
        agent: "instagram",
        success: false,
        data: null,
        reasoning: `Carousel generation failed: ${error instanceof Error ? error.message : "Unknown"}`,
        confidence: 0,
        suggestedActions: ["Retry"],
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Research trending topics on Instagram.
   */
  async researchTrends(generateFn: GenerateFn): Promise<TrendData[]> {
    const systemPrompt = `You are an Instagram trend analyst focused on the Indian business and tech space.`;

    const userPrompt = `What are the top 10 trending topics, formats, and hashtags on Instagram right now in India for business/tech accounts?

For each, provide:
1. Trend name
2. Category (format/topic/hashtag/audio)
3. Velocity (rising/stable/declining)
4. Relevance to AI automation business (0.0-1.0)
5. Suggested content angle

Respond as JSON array:
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
   * Suggest Instagram hashtags with mixed reach strategy.
   */
  async suggestHashtags(
    topic: string,
    generateFn: GenerateFn,
    count: number = 15
  ): Promise<string[]> {
    const systemPrompt = `You are an Instagram hashtag strategist for Indian business accounts.`;

    const userPrompt = `Suggest ${count} Instagram hashtags for a post about: ${topic}
Context: AI automation agency for Indian businesses.

Mix:
- 3 big hashtags (500K+ posts)
- 5 medium hashtags (50K-500K posts)
- 7 niche hashtags (<50K posts)

Respond with ONLY hashtags, one per line.`;

    try {
      const response = await generateFn(systemPrompt, userPrompt);
      return response.split("\n").map((h) => h.trim()).filter((h) => h.startsWith("#")).slice(0, count);
    } catch {
      return ["#AIAutomation", "#BusinessGrowth", "#Axon"];
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
      reasoning: `Instagram peak hours (IST): ${this.config.peakHours.join(", ")}. Best for reels: 19:00-21:00`,
    };
  }
}

export const instagramBot = new InstagramBot();
