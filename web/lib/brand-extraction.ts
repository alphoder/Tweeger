// ─── BRAND EXTRACTION ENGINE ──────────────────────────────────────────────────
// Uses Gemini to extract structured brand data from URLs, text, or social profiles.
// This powers the Brand Setup onboarding flow.

import { generateJSON } from "./ai";
import type { NewBrandProfile } from "./schema";

// ─── TYPES ───────────────────────────────────────────────────────────────────

/** Partial brand data returned by extraction (before saving to DB) */
export interface ExtractedBrand {
  name: string;
  websiteUrl?: string;
  industry: string;
  subIndustry?: string;
  description: string;
  valueProposition: string;
  products: {
    name: string;
    description: string;
    price?: string;
    targetAudience?: string;
  }[];
  tone: {
    primary: string;
    secondary?: string;
    avoidWords?: string[];
    powerWords?: string[];
  };
  targetAudiences: {
    persona: string;
    painPoints?: string[];
    desires?: string[];
    platforms?: string[];
  }[];
  competitors: {
    name: string;
    url?: string;
    handle?: string;
    platform?: string;
  }[];
  brandKeywords: string[];
  industryKeywords: string[];
  uniqueSellingPoints: string[];
  contentThemes: string[];
  contentPillars: {
    pillar: string;
    percentage: number;
    platforms?: string[];
  }[];
  languagePreference: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  festivals: string[];
  socialLinks: {
    platform: string;
    url: string;
    handle?: string;
  }[];
}

// ─── EXTRACTION SYSTEM PROMPT ─────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a brand intelligence extraction engine. Your job is to analyze a business and produce a comprehensive brand profile for social media content generation.

You MUST return a valid JSON object matching the exact schema below. Be thorough but accurate — never fabricate data. If you can't determine something, use reasonable defaults based on the industry.

JSON Schema:
{
  "name": "string — brand/business name",
  "industry": "string — primary industry (e.g., 'Restaurant', 'SaaS', 'Healthcare', 'Real Estate', 'Education', 'E-commerce', 'Technology', 'Consulting')",
  "subIndustry": "string | null — more specific (e.g., 'Fine Dining', 'HR Tech', 'Dental Clinic')",
  "description": "string — 2-3 sentence brand description",
  "valueProposition": "string — core value proposition in one sentence",
  "products": [{ "name": "string", "description": "string", "price": "string | null", "targetAudience": "string | null" }],
  "tone": {
    "primary": "string — main voice (e.g., 'Professional & authoritative', 'Friendly & conversational', 'Bold & disruptive')",
    "secondary": "string | null — secondary tone",
    "avoidWords": ["string — words to never use"],
    "powerWords": ["string — brand-aligned power words"]
  },
  "targetAudiences": [{ "persona": "string", "painPoints": ["string"], "desires": ["string"], "platforms": ["twitter", "linkedin", "instagram", "facebook"] }],
  "competitors": [{ "name": "string", "url": "string | null", "handle": "string | null", "platform": "string | null" }],
  "brandKeywords": ["string — brand-specific keywords for SEO/hashtags"],
  "industryKeywords": ["string — industry keywords"],
  "uniqueSellingPoints": ["string — what makes this brand different"],
  "contentThemes": ["string — recurring content themes (e.g., 'Innovation stories', 'Customer success', 'Industry insights')"],
  "contentPillars": [{ "pillar": "string", "percentage": 0-100, "platforms": ["string"] }],
  "languagePreference": "string — 'english', 'hinglish', 'hindi', or specific language",
  "location": { "city": "string | null", "state": "string | null", "country": "string" },
  "festivals": ["string — relevant festivals/events for content calendar"],
  "socialLinks": [{ "platform": "string", "url": "string", "handle": "string | null" }]
}

Content Pillars should add up to 100%. Typical distribution:
- Educational/Value content: 40%
- Industry insights/thought leadership: 25%
- Product/service showcases: 20%
- Community/engagement: 15%

For Indian businesses, include relevant Indian festivals in the festivals array.
For the tone, analyze the actual website/text to determine voice — don't guess generically.
For competitors, identify 2-4 real competitors in the same space if possible.`;

// ─── EXTRACTION FUNCTIONS ─────────────────────────────────────────────────────

/**
 * Extract brand profile from a website URL.
 * Fetches the website content and uses Gemini to analyze it.
 */
export async function extractFromURL(url: string): Promise<ExtractedBrand> {
  // Fetch website content
  let websiteContent = "";
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AxonSocialAI/1.0; +https://axon.ai)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      const html = await response.text();
      // Strip HTML tags, scripts, styles — extract readable text
      websiteContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 12000); // Limit to ~12k chars for Gemini context
    }
  } catch {
    // If fetch fails, we'll work with just the URL
    websiteContent = `Could not fetch website content. URL: ${url}`;
  }

  const userPrompt = `Analyze this website and extract a complete brand profile for social media content generation.

Website URL: ${url}

Website Content (extracted text):
${websiteContent}

Extract every detail you can about:
1. What the business does and who they serve
2. Their tone of voice and communication style
3. Their products/services
4. Their target audience personas
5. Their competitive landscape
6. Keywords and themes for social media content

Return the JSON brand profile.`;

  const extracted = await generateJSON<ExtractedBrand>(
    EXTRACTION_SYSTEM_PROMPT,
    userPrompt,
    {
      agent: "manager",
      action: "brand_extraction_url",
      temperature: 0.5,
      maxTokens: 4096,
    }
  );

  // Ensure websiteUrl is set
  extracted.websiteUrl = url;

  return validateExtractedBrand(extracted);
}

/**
 * Extract brand profile from a text description.
 * For users who want to describe their brand manually.
 */
export async function extractFromText(
  description: string
): Promise<ExtractedBrand> {
  const userPrompt = `A user has described their business as follows. Extract a complete brand profile for social media content generation.

User's Description:
${description}

Based on this description, fill in as much detail as possible. For anything not explicitly mentioned, make reasonable inferences based on the industry and business type. Mark inferred data clearly in descriptions.

Return the JSON brand profile.`;

  const extracted = await generateJSON<ExtractedBrand>(
    EXTRACTION_SYSTEM_PROMPT,
    userPrompt,
    {
      agent: "manager",
      action: "brand_extraction_text",
      temperature: 0.5,
      maxTokens: 4096,
    }
  );

  return validateExtractedBrand(extracted);
}

/**
 * Extract brand profile from a social media profile URL.
 * Fetches the profile page and analyzes it.
 */
export async function extractFromSocial(
  profileUrl: string
): Promise<ExtractedBrand> {
  let profileContent = "";
  try {
    const response = await fetch(profileUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AxonSocialAI/1.0; +https://axon.ai)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      const html = await response.text();
      profileContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 12000);
    }
  } catch {
    profileContent = `Could not fetch social profile. URL: ${profileUrl}`;
  }

  // Detect platform from URL
  let platform = "unknown";
  if (profileUrl.includes("twitter.com") || profileUrl.includes("x.com"))
    platform = "twitter";
  else if (profileUrl.includes("linkedin.com")) platform = "linkedin";
  else if (profileUrl.includes("instagram.com")) platform = "instagram";
  else if (profileUrl.includes("facebook.com")) platform = "facebook";

  const userPrompt = `Analyze this ${platform} social media profile and extract a complete brand profile for social media content generation.

Profile URL: ${profileUrl}
Platform: ${platform}

Profile Content (extracted text):
${profileContent}

Extract the brand's identity, tone, audience, and content strategy from their social media presence. Infer their industry, products, and competitive positioning.

Return the JSON brand profile.`;

  const extracted = await generateJSON<ExtractedBrand>(
    EXTRACTION_SYSTEM_PROMPT,
    userPrompt,
    {
      agent: "manager",
      action: "brand_extraction_social",
      temperature: 0.5,
      maxTokens: 4096,
    }
  );

  // Add the social link
  if (!extracted.socialLinks) extracted.socialLinks = [];
  extracted.socialLinks.push({
    platform,
    url: profileUrl,
  });

  return validateExtractedBrand(extracted);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Validate and normalize extracted brand data.
 * Ensures all required fields exist with sensible defaults.
 */
function validateExtractedBrand(data: Partial<ExtractedBrand>): ExtractedBrand {
  return {
    name: data.name || "Unnamed Brand",
    websiteUrl: data.websiteUrl || undefined,
    industry: data.industry || "General",
    subIndustry: data.subIndustry || undefined,
    description:
      data.description || "A business looking to grow on social media.",
    valueProposition:
      data.valueProposition || "Delivering value to our customers.",
    products: Array.isArray(data.products) ? data.products : [],
    tone: data.tone || {
      primary: "Professional & friendly",
      avoidWords: [],
      powerWords: [],
    },
    targetAudiences: Array.isArray(data.targetAudiences)
      ? data.targetAudiences
      : [],
    competitors: Array.isArray(data.competitors) ? data.competitors : [],
    brandKeywords: Array.isArray(data.brandKeywords) ? data.brandKeywords : [],
    industryKeywords: Array.isArray(data.industryKeywords)
      ? data.industryKeywords
      : [],
    uniqueSellingPoints: Array.isArray(data.uniqueSellingPoints)
      ? data.uniqueSellingPoints
      : [],
    contentThemes: Array.isArray(data.contentThemes) ? data.contentThemes : [],
    contentPillars: Array.isArray(data.contentPillars)
      ? data.contentPillars
      : [
          { pillar: "Educational Content", percentage: 40 },
          { pillar: "Industry Insights", percentage: 25 },
          { pillar: "Product Showcases", percentage: 20 },
          { pillar: "Community Engagement", percentage: 15 },
        ],
    languagePreference: data.languagePreference || "english",
    location: data.location || { country: "India" },
    festivals: Array.isArray(data.festivals) ? data.festivals : [],
    socialLinks: Array.isArray(data.socialLinks) ? data.socialLinks : [],
  };
}

/**
 * Convert an ExtractedBrand into a NewBrandProfile for database insertion.
 */
export function toNewBrandProfile(
  extracted: ExtractedBrand
): Omit<NewBrandProfile, "id" | "createdAt" | "updatedAt"> {
  return {
    name: extracted.name,
    websiteUrl: extracted.websiteUrl || null,
    industry: extracted.industry,
    subIndustry: extracted.subIndustry || null,
    description: extracted.description,
    valueProposition: extracted.valueProposition,
    products: extracted.products,
    tone: extracted.tone,
    targetAudiences: extracted.targetAudiences,
    competitors: extracted.competitors,
    brandKeywords: extracted.brandKeywords,
    industryKeywords: extracted.industryKeywords,
    uniqueSellingPoints: extracted.uniqueSellingPoints,
    contentThemes: extracted.contentThemes,
    contentPillars: extracted.contentPillars,
    languagePreference: extracted.languagePreference,
    location: extracted.location || null,
    festivals: extracted.festivals,
    socialLinks: extracted.socialLinks,
    automationMode: "full_auto_generate",
    platformsActive: ["twitter", "linkedin", "instagram", "facebook"],
    postsPerDayPerPlatform: 1,
  };
}
