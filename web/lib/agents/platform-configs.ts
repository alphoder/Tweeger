// ─── PLATFORM KNOWLEDGE BASE ─────────────────────────────────────────────────
// Detailed configs for each social media platform.
// Each Platform Bot uses its config to generate platform-native content.

import type { PlatformConfig, Platform } from "./types";

export const TWITTER_CONFIG: PlatformConfig = {
  name: "Twitter / X",
  platform: "twitter",
  charLimit: 280,
  hashtagLimit: 3,
  emojiLimit: 1,
  bestPractices: `Short punchy statements. Ask questions. Use hooks that stop the scroll.
Thread for long content — first tweet must be a banger.
Quote tweet trending topics with your take.
Engage in conversations, don't just broadcast.
Post 3-5 times daily. Use data and numbers — they get engagement.
Controversial (but defensible) opinions perform best.
Never start with "I" — start with the value.`,
  contentStyles: [
    "hot_take",
    "thread",
    "quote_tweet",
    "poll",
    "controversial_opinion",
    "data_point",
    "one_liner",
    "tip",
    "case_study_snippet",
  ],
  audienceType: "fast-scrolling, opinion-driven, real-time, loves hot takes and data",
  peakHours: [9, 12, 17, 21], // IST
  imageSpecs: {
    width: 1200,
    height: 675,
    formats: ["jpg", "png", "gif"],
  },
};

export const INSTAGRAM_CONFIG: PlatformConfig = {
  name: "Instagram",
  platform: "instagram",
  charLimit: 2200,
  hashtagLimit: 15,
  emojiLimit: 5,
  bestPractices: `Visual-first always. The image/reel is the hook, caption is the conversion.
Strong opening line — gets truncated at ~125 chars.
Use line breaks generously for readability.
Carousel for education content — 5-10 slides, value-packed.
Reels for maximum reach — short, punchy, hook in first 2 seconds.
Stories for engagement — polls, questions, behind-the-scenes.
Hashtags: mix of big (500K+), medium (50K-500K), and niche (<50K).
Put hashtags in first comment or end of caption.
CTA in every post — save, share, comment, link in bio.`,
  contentStyles: [
    "carousel",
    "reel_caption",
    "story_prompt",
    "behind_the_scenes",
    "testimonial",
    "infographic",
    "meme",
    "before_after",
    "tip_series",
  ],
  audienceType: "visual, aspirational, discovery-driven, saves valuable content",
  peakHours: [8, 12, 19, 21], // IST
  imageSpecs: {
    width: 1080,
    height: 1080,
    formats: ["jpg", "png"],
  },
};

export const FACEBOOK_CONFIG: PlatformConfig = {
  name: "Facebook",
  platform: "facebook",
  charLimit: 63206,
  hashtagLimit: 3,
  emojiLimit: 3,
  bestPractices: `Storytelling format — people love narratives on Facebook.
Ask for opinions and spark discussion. "What do you think?"
Share relatable experiences — "We had a client who..."
Use "you" and "your" — make it personal.
Longer posts (150-300 words) actually perform well here.
Tag relevant pages when appropriate.
Share in relevant groups (don't spam).
Native video and images get priority in the algorithm.
Facebook Reels are growing — consider short vertical video.`,
  contentStyles: [
    "story",
    "question",
    "poll",
    "share_worthy",
    "testimonial",
    "community_post",
    "how_to",
    "listicle",
    "client_spotlight",
  ],
  audienceType: "community-oriented, shareable, discussion-friendly, older demographic",
  peakHours: [9, 13, 16, 20], // IST
  imageSpecs: {
    width: 1200,
    height: 630,
    formats: ["jpg", "png"],
  },
};

export const LINKEDIN_CONFIG: PlatformConfig = {
  name: "LinkedIn",
  platform: "linkedin",
  charLimit: 3000,
  hashtagLimit: 5,
  emojiLimit: 2,
  bestPractices: `Lead with a bold statement or shocking stat — hook them in line 1.
Use line breaks aggressively — one sentence per line, blank lines between sections.
Tell professional stories with a lesson: "3 years ago I... Here's what I learned."
Data-backed claims always. Numbers are LinkedIn's love language.
End with a question or CTA — engagement begets reach.
No hard selling — provide value first, mention product second.
Document your journey — "behind the build" content performs well.
Tag 3-5 relevant people or companies for amplification.
Post consistently at the same times each week.`,
  contentStyles: [
    "thought_leadership",
    "lesson_learned",
    "industry_insight",
    "case_study",
    "contrarian_take",
    "career_advice",
    "behind_the_build",
    "founder_journey",
    "data_story",
  ],
  audienceType: "professional, decision-makers, B2B, career-focused, values expertise",
  peakHours: [8, 10, 12, 17], // IST
  imageSpecs: {
    width: 1200,
    height: 627,
    formats: ["jpg", "png"],
  },
};

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  twitter: TWITTER_CONFIG,
  instagram: INSTAGRAM_CONFIG,
  facebook: FACEBOOK_CONFIG,
  linkedin: LINKEDIN_CONFIG,
};

export function getPlatformConfig(platform: Platform): PlatformConfig {
  return PLATFORM_CONFIGS[platform];
}

export function getPlatformSystemPrompt(platform: Platform): string {
  const config = PLATFORM_CONFIGS[platform];
  return `You are an expert ${config.name} content strategist.

PLATFORM: ${config.name}
CHARACTER LIMIT: ${config.charLimit}
HASHTAG LIMIT: ${config.hashtagLimit} max
EMOJI LIMIT: ${config.emojiLimit} max

BEST PRACTICES:
${config.bestPractices}

CONTENT STYLES YOU EXCEL AT: ${config.contentStyles.join(", ")}

AUDIENCE: ${config.audienceType}

IMAGE SPECS: ${config.imageSpecs.width}x${config.imageSpecs.height} (${config.imageSpecs.formats.join("/")})

RULES:
- ALWAYS stay within the character limit
- ALWAYS optimize for this platform's specific algorithm
- NEVER create generic cross-platform content
- ALWAYS include a clear hook in the first line
- Make every word earn its place`;
}

export function getAllPlatforms(): Platform[] {
  return ["twitter", "instagram", "facebook", "linkedin"];
}
