// ─── FINETWEET BRAND CONFIGURATION ────────────────────────────────────────────────
// Central brand config used by all agents, prompts, and content generation.
// Includes both hardcoded defaults (personal brand) and DB-backed functions for multi-client.

import { db } from "./db";
import { brandProfiles, type BrandProfile } from "./schema";
import { eq } from "drizzle-orm";

export const BRAND_NAME = "Vedant Singh";

export const BRAND_DESCRIPTION =
  "Personal Twitter/X of Vedant Singh — a builder working on agentic AI products. Focused on AI/ML, blockchain, and entrepreneurship. The account is a public showcase and networking surface: sharp takes, real experiments, builder lessons from the trenches.";

export const BRAND_TAGLINE = "Building agentic AI in public";

export const BRAND_TONE =
  "A sharp builder sharing observations. Specific, opinionated, human. No corporate voice, no AI-sounding filler, no hype words.";

export const BRAND_WEBSITE = "https://x.com/VedantSing43752";

export const BRAND_INDUSTRIES = [
  "AI",
  "Machine Learning",
  "Blockchain",
  "Startups",
  "Developer Tools",
  "Open Source",
] as const;

export type BrandIndustry = (typeof BRAND_INDUSTRIES)[number];

export const BRAND_INDUSTRY_PAIN_POINTS: Record<string, string> = {
  ai: "Model costs, eval difficulty, agents that demo well but fail in production, prompt brittleness",
  machine_learning: "Data quality beats model choice, deployment gap between notebooks and production",
  blockchain: "UX still terrible, real utility vs speculation, infra centralization creep",
  startups: "Distribution beats product, founder burnout, build-vs-buy decisions, fundraising theater",
  developer_tools: "DX as a moat, docs as marketing, open source sustainability",
  open_source: "Maintainer burnout, monetization, corporate free-riding",
};

// Content pillars chosen for engagement + networking ROI in 2026:
// agentic AI engineering is where founder/investor attention is densest,
// evals/production-agents is underserved expertise, build-in-public earns
// follows, and AI x crypto infra bridges both audiences.
export const BRAND_KEY_MESSAGES = [
  "Hands-on with agentic AI: multi-agent systems, evals, production failures",
  "Builds in public — real experiments with numbers, including what broke",
  "Sharp, specific takes on AI/ML research as it lands, not hot-take recycling",
  "Bridges AI and crypto infra when there is real substance",
  "Here to connect with founders, builders, and investors",
];

export const BRAND_HASHTAGS = [
  "#buildinpublic",
  "#AI",
  "#MachineLearning",
  "#blockchain",
];

export const BRAND_PRICING = {
  starter: { name: "n/a", price: "" },
  growth: { name: "n/a", price: "" },
  partner: { name: "n/a", price: "" },
};

export const TARGET_PLATFORMS = [
  "twitter",
  "linkedin",
  "instagram",
  "facebook",
] as const;

export type Platform = (typeof TARGET_PLATFORMS)[number];

export const POSTS_PER_DAY = 3;
export const OPTIMAL_HOURS = [9, 13, 18, 21]; // IST

/**
 * Generate the full brand system prompt for AI agents.
 * Used by ALL agent prompts to maintain consistent voice.
 */
export function getBrandPrompt(
  platform?: string,
  industry?: string
): string {
  let prompt = `You are creating social media content for ${BRAND_NAME}.

ABOUT ${BRAND_NAME.toUpperCase()}:
${BRAND_DESCRIPTION}

TAGLINE: "${BRAND_TAGLINE}"

TONE: ${BRAND_TONE}

KEY MESSAGES TO WEAVE IN:
${BRAND_KEY_MESSAGES.map((m) => `- ${m}`).join("\n")}

INDUSTRIES WE SERVE: ${BRAND_INDUSTRIES.join(", ")}

HASHTAGS TO USE (pick 2-3 relevant ones): ${BRAND_HASHTAGS.join(", ")}`;

  if (industry) {
    const key = industry.toLowerCase().replace(/\s+/g, "_");
    const painPoints = BRAND_INDUSTRY_PAIN_POINTS[key];
    if (painPoints) {
      prompt += `\n\nTARGET INDUSTRY: ${industry}
PAIN POINTS TO ADDRESS: ${painPoints}
Speak to these pain points from firsthand builder experience.`;
    }
  }

  if (platform) {
    prompt += `\n\nPLATFORM: ${platform.charAt(0).toUpperCase() + platform.slice(1)}
Optimize the content for this specific platform's algorithm, culture, and audience expectations.`;
  }

  prompt += `\n\nRULES:
- Never use generic AI buzzwords without substance
- Always tie claims to real outcomes or numbers
- Write as a confident operator, not a salesperson
- Make every post provide VALUE — insight, tip, or perspective
- Keep it human, never robotic`;

  return prompt;
}

// ─── DB-BACKED BRAND FUNCTIONS ───────────────────────────────────────────────

/**
 * Get the first active brand from the database.
 * Returns null if no brands exist (falls back to the hardcoded personal brand).
 */
export async function getActiveBrand(): Promise<BrandProfile | null> {
  try {
    const brand = await db.query.brandProfiles.findFirst({
      orderBy: (b, { desc }) => [desc(b.createdAt)],
    });
    return brand || null;
  } catch {
    return null;
  }
}

/**
 * Get a specific brand by ID.
 */
export async function getBrandById(
  brandId: number
): Promise<BrandProfile | null> {
  try {
    const brand = await db.query.brandProfiles.findFirst({
      where: eq(brandProfiles.id, brandId),
    });
    return brand || null;
  } catch {
    return null;
  }
}

/**
 * Generate a brand system prompt from a DB brand profile.
 * This is the DB-backed equivalent of getBrandPrompt().
 */
export function getBrandPromptFromProfile(
  profile: BrandProfile,
  platform?: string,
  industry?: string
): string {
  const tone =
    typeof profile.tone === "object" && profile.tone !== null
      ? (profile.tone as { primary: string; secondary?: string; avoidWords?: string[]; powerWords?: string[] })
      : { primary: "Professional" };

  const audiences = Array.isArray(profile.targetAudiences)
    ? (profile.targetAudiences as { persona: string; painPoints?: string[] }[])
    : [];

  const usps = Array.isArray(profile.uniqueSellingPoints)
    ? (profile.uniqueSellingPoints as string[])
    : [];

  const themes = Array.isArray(profile.contentThemes)
    ? (profile.contentThemes as string[])
    : [];

  const keywords = Array.isArray(profile.brandKeywords)
    ? (profile.brandKeywords as string[])
    : [];

  let prompt = `You are creating social media content for ${profile.name}.

ABOUT ${profile.name.toUpperCase()}:
${profile.description}

INDUSTRY: ${profile.industry}${profile.subIndustry ? ` (${profile.subIndustry})` : ""}

VALUE PROPOSITION: ${profile.valueProposition}

TONE: ${tone.primary}${tone.secondary ? `. Secondary: ${tone.secondary}` : ""}`;

  if (tone.powerWords && tone.powerWords.length > 0) {
    prompt += `\nPOWER WORDS: ${tone.powerWords.join(", ")}`;
  }

  if (tone.avoidWords && tone.avoidWords.length > 0) {
    prompt += `\nAVOID WORDS: ${tone.avoidWords.join(", ")}`;
  }

  if (usps.length > 0) {
    prompt += `\n\nUNIQUE SELLING POINTS:\n${usps.map((u) => `- ${u}`).join("\n")}`;
  }

  if (themes.length > 0) {
    prompt += `\n\nCONTENT THEMES: ${themes.join(", ")}`;
  }

  if (keywords.length > 0) {
    prompt += `\n\nBRAND KEYWORDS/HASHTAGS: ${keywords.map((k) => `#${k.replace(/^#/, "")}`).join(", ")}`;
  }

  if (audiences.length > 0) {
    prompt += `\n\nTARGET AUDIENCES:`;
    for (const a of audiences) {
      prompt += `\n- ${a.persona}`;
      if (a.painPoints && a.painPoints.length > 0) {
        prompt += ` (Pain points: ${a.painPoints.join(", ")})`;
      }
    }
  }

  if (industry) {
    prompt += `\n\nFOCUS INDUSTRY: ${industry}`;
  }

  if (platform) {
    prompt += `\n\nPLATFORM: ${platform.charAt(0).toUpperCase() + platform.slice(1)}
Optimize the content for this specific platform's algorithm, culture, and audience expectations.`;
  }

  prompt += `\n\nLANGUAGE: ${profile.languagePreference || "english"}`;

  prompt += `\n\nRULES:
- Never use generic AI buzzwords without substance
- Always tie claims to real outcomes or numbers
- Write as a confident operator, not a salesperson
- Make every post provide VALUE — insight, tip, or perspective
- Keep it human, never robotic`;

  return prompt;
}

/**
 * Smart brand prompt: uses DB brand if available, falls back to hardcoded.
 * This is the recommended function for agents to use.
 */
export async function getSmartBrandPrompt(
  brandId?: number,
  platform?: string,
  industry?: string
): Promise<string> {
  // If brandId provided, use that specific brand
  if (brandId) {
    const profile = await getBrandById(brandId);
    if (profile) {
      return getBrandPromptFromProfile(profile, platform, industry);
    }
  }

  // Try to get the first active brand from DB
  const activeBrand = await getActiveBrand();
  if (activeBrand) {
    return getBrandPromptFromProfile(activeBrand, platform, industry);
  }

  // Fall back to the hardcoded personal brand
  return getBrandPrompt(platform, industry);
}
