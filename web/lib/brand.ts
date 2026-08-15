// ─── AXON BRAND CONFIGURATION ────────────────────────────────────────────────
// Central brand config used by all agents, prompts, and content generation.
// Includes both hardcoded defaults (Axon brand) and DB-backed functions for multi-client.

import { db } from "./db";
import { brandProfiles, type BrandProfile } from "./schema";
import { eq } from "drizzle-orm";

export const BRAND_NAME = "Axon";

export const BRAND_DESCRIPTION =
  "AI automation agency — WhatsApp bots, workflow automation, and ad funnels for Indian businesses";

export const BRAND_TAGLINE =
  "The intelligence layer your business is missing";

export const BRAND_TONE =
  "Direct, no-nonsense, operator-focused. Talk about concrete problems and measurable outcomes. No fluff, no buzzwords.";

export const BRAND_WEBSITE = "https://axon-developer-site.vercel.app/";

export const BRAND_INDUSTRIES = [
  "Restaurants",
  "Hotels",
  "Hospitals",
  "Real Estate",
  "Education",
  "Startups",
] as const;

export type BrandIndustry = (typeof BRAND_INDUSTRIES)[number];

export const BRAND_INDUSTRY_PAIN_POINTS: Record<string, string> = {
  restaurants:
    "28% revenue lost to aggregator commissions, missed orders, manual order management, no direct customer channel",
  hotels:
    "Missed booking inquiries, slow guest response, manual review management, no automated upselling",
  hospitals:
    "40% calls go unanswered, appointment no-shows, manual patient follow-up, no automated reminders",
  real_estate:
    "67% leads go cold, no automated follow-up, manual property matching, slow response to inquiries",
  education:
    "Enrollment queries pile up, manual fee reminders, no automated student communication, admission process bottlenecks",
  startups:
    "Can't scale customer support, manual lead qualification, no 24/7 response capability, burning money on human ops",
};

export const BRAND_KEY_MESSAGES = [
  "Go live in under 72 hours",
  "Zero missed orders, zero missed calls",
  "Under 2-minute response time, 24/7",
  "28% commission savings for restaurants",
  "40% fewer missed calls for hospitals",
  "67% lead recovery for real estate",
  "Works on WhatsApp — where your customers already are",
  "No app downloads. No training. Just results.",
  "Built for Indian businesses, by people who understand Indian businesses.",
];

export const BRAND_HASHTAGS = [
  "#Axon",
  "#AIAutomation",
  "#WhatsAppBot",
  "#BusinessAutomation",
  "#IndianBusiness",
  "#NoCodeAI",
];

export const BRAND_PRICING = {
  starter: { name: "Starter", price: "₹8K/mo" },
  growth: { name: "Growth", price: "₹18K/mo" },
  partner: { name: "Partner", price: "₹35K/mo" },
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
Focus content on how Axon solves these specific problems.`;
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
- Use Indian business context and examples when relevant
- Keep it human, never robotic`;

  return prompt;
}

// ─── DB-BACKED BRAND FUNCTIONS ───────────────────────────────────────────────

/**
 * Get the first active brand from the database.
 * Returns null if no brands exist (falls back to hardcoded Axon brand).
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

  // Fall back to hardcoded Axon brand
  return getBrandPrompt(platform, industry);
}
