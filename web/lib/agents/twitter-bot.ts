// ─── TWITTER/X BOT — Platform Specialist ─────────────────────────────────────
// Expert in Twitter's algorithm, culture, character limits, and best practices.

import { v4 as uuid } from "uuid";
import type {
  AgentResult,
  GeneratePostOptions,
  TrendData,
  PlatformPost,
} from "./types";
import { TWITTER_CONFIG, getPlatformSystemPrompt } from "./platform-configs";
import { getBrandPrompt } from "../brand";

type GenerateFn = (systemPrompt: string, userPrompt: string) => Promise<string>;

export class TwitterBot {
  private config = TWITTER_CONFIG;

  /**
   * Generate a single Twitter post.
   */
  async generatePost(
    context: string,
    generateFn: GenerateFn,
    options?: GeneratePostOptions
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const systemPrompt = `${getBrandPrompt("twitter", options?.targetIndustry)}\n\n${getPlatformSystemPrompt("twitter")}`;

    const userPrompt = `Write a tweet about: ${context}
${options?.contentType ? `Style: ${options.contentType}` : ""}
${options?.trendContext?.length ? `Currently trending: ${options.trendContext.map((t) => t.name).join(", ")}` : ""}

Rules:
- MUST be under 280 characters (including hashtags)
- Include 1-3 relevant hashtags
- Start with a hook that stops scrolling
- No generic filler text
- Be specific and data-driven when possible

Respond with ONLY the tweet text. Nothing else.`;

    try {
      const response = await generateFn(systemPrompt, userPrompt);
      const text = response.trim();
      const hashtags = text.match(/#[\w]+/g) || [];

      return {
        taskId: uuid(),
        agent: "twitter",
        success: true,
        data: {
          platform: "twitter",
          text,
          hashtags,
          contentType: options?.contentType || "one_liner",
          targetIndustry: options?.targetIndustry,
        } as PlatformPost,
        reasoning: "Generated Twitter-optimized post with hook and hashtags",
        confidence: 0.85,
        suggestedActions: ["Review", "Schedule", "Generate image"],
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: uuid(),
        agent: "twitter",
        success: false,
        data: null,
        reasoning: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        confidence: 0,
        suggestedActions: ["Retry", "Try different model"],
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate a Twitter thread (multiple connected tweets).
   */
  async generateThread(
    topic: string,
    generateFn: GenerateFn,
    tweetCount: number = 5
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const systemPrompt = `${getBrandPrompt("twitter")}\n\n${getPlatformSystemPrompt("twitter")}`;

    const userPrompt = `Write a Twitter thread of ${tweetCount} tweets about: ${topic}

Rules:
- First tweet MUST be a banger hook — it decides if people read the rest
- Each tweet MUST be under 280 characters
- Number them 1/${tweetCount}, 2/${tweetCount}, etc.
- Build a narrative — each tweet should flow into the next
- Last tweet should have a CTA or key takeaway
- Include hashtags only in the last tweet
- Separate each tweet with "---"

Write ONLY the tweets, separated by "---". No explanations.`;

    try {
      const response = await generateFn(systemPrompt, userPrompt);
      const tweets = response.split("---").map((t) => t.trim()).filter(Boolean);

      return {
        taskId: uuid(),
        agent: "twitter",
        success: true,
        data: {
          type: "thread",
          tweets,
          platform: "twitter",
          tweetCount: tweets.length,
        },
        reasoning: `Generated ${tweets.length}-tweet thread on "${topic}"`,
        confidence: 0.8,
        suggestedActions: ["Review thread", "Schedule thread", "Edit individual tweets"],
      };
    } catch (error) {
      return {
        taskId: uuid(),
        agent: "twitter",
        success: false,
        data: null,
        reasoning: `Thread generation failed: ${error instanceof Error ? error.message : "Unknown"}`,
        confidence: 0,
        suggestedActions: ["Retry"],
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Research trending topics on Twitter.
   * Uses AI to predict/analyze trends when API access is limited.
   */
  async researchTrends(generateFn: GenerateFn): Promise<TrendData[]> {
    const systemPrompt = `You are a Twitter/X trend research analyst focused on the Indian tech, business automation, and AI space.`;

    const userPrompt = `What are the top 10 trending topics on Twitter/X right now that are relevant to:
- AI automation for businesses
- WhatsApp bots
- Indian business technology
- SaaS products
- Startup ecosystem in India

For each trend, provide:
1. Trend name/topic
2. Estimated volume (high/medium/low)
3. Category (tech/business/cultural/industry)
4. How fast it's growing (rising/stable/declining)
5. Relevance score to an AI automation business (0.0 to 1.0)
6. Suggested angle — how the brand could use this trend

Respond in JSON array format:
[{"name": "...", "volume": "...", "category": "...", "velocity": "...", "relevanceScore": 0.0, "suggestedAngle": "..."}]`;

    try {
      const response = await generateFn(systemPrompt, userPrompt);
      const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      return JSON.parse(cleaned) as TrendData[];
    } catch {
      return [];
    }
  }

  /**
   * Suggest optimal hashtags for a topic.
   */
  async analyzeHashtags(
    topic: string,
    generateFn: GenerateFn
  ): Promise<string[]> {
    const systemPrompt = `You are a Twitter hashtag strategist.`;
    const userPrompt = `Suggest 5 optimal Twitter hashtags for a post about: ${topic}
Context: AI automation agency for Indian businesses.
Mix of: 1 broad (high volume), 2 medium, 2 niche.
Respond with ONLY the hashtags, one per line, including the # symbol.`;

    try {
      const response = await generateFn(systemPrompt, userPrompt);
      return response.split("\n").map((h) => h.trim()).filter((h) => h.startsWith("#"));
    } catch {
      return ["#AIAutomation", "#Axon", "#BusinessAutomation"];
    }
  }

  /**
   * Get optimal posting time based on platform config.
   * Enhanced by self-learning data when available.
   */
  getOptimalPostingTime(): { hour: number; reasoning: string } {
    const now = new Date();
    const currentHour = now.getHours();

    const nextPeak = this.config.peakHours.find((h) => h > currentHour) ||
      this.config.peakHours[0];

    return {
      hour: nextPeak,
      reasoning: `Twitter peak engagement hours (IST): ${this.config.peakHours.join(", ")}. Next optimal: ${nextPeak}:00`,
    };
  }
}

export const twitterBot = new TwitterBot();
