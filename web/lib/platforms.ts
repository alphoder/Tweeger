// ─── PLATFORM ABSTRACTION LAYER ──────────────────────────────────────────────
// PlatformClient interface + implementations.
// Twitter: real (twitter-api-v2)
// Instagram: real (Meta Graph API — Business/Creator account required)
// Facebook: real (Meta Graph API — Page access required)
// LinkedIn: placeholder (API requires partner-level app review)

export interface PlatformPostResult {
  postId: string;
  postUrl: string;
  platform: string;
}

export interface PlatformMetrics {
  likes: number;
  shares: number;
  comments: number;
  saves: number;
  impressions: number;
  reach: number;
  engagementRate: number | null;
}

export interface PlatformProfile {
  name: string;
  handle: string;
  followers: number;
  following: number;
  postCount: number;
  profileImageUrl?: string;
  bio?: string;
}

export interface PlatformClient {
  platform: string;
  post(text: string, imagePath?: string): Promise<PlatformPostResult>;
  getMetrics(postId: string): Promise<PlatformMetrics>;
  getProfile(): Promise<PlatformProfile>;
  isConfigured(): boolean;
}

// ─── HELPER: Meta Graph API ─────────────────────────────────────────────────
// Shared by Instagram and Facebook clients

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";

interface MetaErrorResponse {
  error?: { message?: string; code?: number; type?: string };
}

async function metaFetch<T = Record<string, unknown>>(
  endpoint: string,
  accessToken: string,
  options?: RequestInit
): Promise<T> {
  const sep = endpoint.includes("?") ? "&" : "?";
  const url = `${META_GRAPH_URL}${endpoint}${sep}access_token=${accessToken}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as MetaErrorResponse;
    const msg = err.error?.message || `Meta API error ${res.status}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// Helper: upload an image to Meta via URL (for both IG and FB)
async function getPublicImageUrl(imagePath: string): Promise<string | null> {
  if (!imagePath) return null;
  // If already a full URL (e.g., AI-generated), return as-is
  if (imagePath.startsWith("http")) return imagePath;
  // Otherwise build from app URL + public path
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const fullUrl = `${appUrl}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
  return fullUrl;
}

const ZERO_METRICS: PlatformMetrics = {
  likes: 0,
  shares: 0,
  comments: 0,
  saves: 0,
  impressions: 0,
  reach: 0,
  engagementRate: null,
};

// ─── TWITTER CLIENT (real) ───────────────────────────────────────────────────

class TwitterClient implements PlatformClient {
  platform = "twitter";

  isConfigured(): boolean {
    return !!(
      process.env.TWITTER_API_KEY &&
      process.env.TWITTER_API_SECRET &&
      process.env.TWITTER_ACCESS_TOKEN &&
      process.env.TWITTER_ACCESS_SECRET
    );
  }

  private getClient() {
    const { TwitterApi } = require("twitter-api-v2");
    return new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    });
  }

  async post(text: string, imagePath?: string): Promise<PlatformPostResult> {
    if (!this.isConfigured()) throw new Error("Twitter API not configured");

    const client = this.getClient();
    const rwClient = client.readWrite;

    let mediaId: string | undefined;
    if (imagePath) {
      try {
        // Fetch image bytes (data URL, R2-backed URL, or absolute URL) —
        // works on Cloudflare Workers where there is no local filesystem.
        if (imagePath.startsWith("data:")) {
          const m = imagePath.match(/^data:([^;]+);base64,(.*)$/);
          if (m) {
            mediaId = await rwClient.v1.uploadMedia(Buffer.from(m[2], "base64"), { mimeType: m[1] });
          }
        } else {
          const imageUrl = await getPublicImageUrl(imagePath);
          if (imageUrl) {
            const res = await fetch(imageUrl);
            if (res.ok) {
              const buffer = Buffer.from(await res.arrayBuffer());
              const mimeType = res.headers.get("content-type") || "image/png";
              mediaId = await rwClient.v1.uploadMedia(buffer, { mimeType });
            }
          }
        }
      } catch (err) {
        console.warn("[Twitter] Failed to upload media:", err);
      }
    }

    const tweetData: Record<string, unknown> = { text };
    if (mediaId) {
      tweetData.media = { media_ids: [mediaId] };
    }

    const result = await rwClient.v2.tweet(tweetData);
    const tweetId = result.data.id;

    return {
      postId: tweetId,
      postUrl: `https://x.com/i/status/${tweetId}`,
      platform: "twitter",
    };
  }

  async getMetrics(postId: string): Promise<PlatformMetrics> {
    try {
      const client = this.getClient();
      const tweet = await client.v2.singleTweet(postId, {
        "tweet.fields": [
          "public_metrics",
          "non_public_metrics",
          "organic_metrics",
        ],
      });

      const pm = tweet.data.public_metrics || {};
      return {
        likes: pm.like_count || 0,
        shares: pm.retweet_count || 0,
        comments: pm.reply_count || 0,
        saves: pm.bookmark_count || 0,
        impressions: pm.impression_count || 0,
        reach: 0,
        engagementRate: null,
      };
    } catch {
      return { ...ZERO_METRICS };
    }
  }

  async getProfile(): Promise<PlatformProfile> {
    try {
      const client = this.getClient();
      const me = await client.v2.me({
        "user.fields": [
          "public_metrics",
          "profile_image_url",
          "description",
        ],
      });

      return {
        name: me.data.name,
        handle: `@${me.data.username}`,
        followers: me.data.public_metrics?.followers_count || 0,
        following: me.data.public_metrics?.following_count || 0,
        postCount: me.data.public_metrics?.tweet_count || 0,
        profileImageUrl: me.data.profile_image_url,
        bio: me.data.description,
      };
    } catch {
      return {
        name: process.env.BRAND_NAME || "Axon",
        handle: "@axon_ai",
        followers: 0,
        following: 0,
        postCount: 0,
      };
    }
  }
}

// ─── INSTAGRAM CLIENT (real — Meta Graph API) ───────────────────────────────
// Requires: INSTAGRAM_ACCOUNT_ID, META_ACCESS_TOKEN
// Setup: Meta Business Suite → Instagram Professional Account → Graph API
//
// How posting works (Instagram Content Publishing API):
//   1. Create a media container (with image_url + caption)
//   2. Publish the container
// For text-only: Instagram requires an image, so we use a branded placeholder
//
// Supported post types:
//   - IMAGE: Single image with caption
//   - CAROUSEL: Multiple images (future)
//   - REELS: Video (future)

class InstagramClient implements PlatformClient {
  platform = "instagram";

  private get accountId() {
    return process.env.INSTAGRAM_ACCOUNT_ID || "";
  }

  private get accessToken() {
    return process.env.META_ACCESS_TOKEN || "";
  }

  isConfigured(): boolean {
    return !!(this.accountId && this.accessToken);
  }

  async post(text: string, imagePath?: string): Promise<PlatformPostResult> {
    if (!this.isConfigured()) {
      throw new Error(
        "Instagram API not configured. Set INSTAGRAM_ACCOUNT_ID and META_ACCESS_TOKEN."
      );
    }

    // Instagram REQUIRES an image for feed posts
    let imageUrl = await getPublicImageUrl(imagePath || "");
    if (!imageUrl) {
      // Use a branded placeholder if no image provided
      // In production, generate one or use a default brand image
      throw new Error(
        "Instagram requires an image for feed posts. Provide an image_url or generate one."
      );
    }

    // Step 1: Create media container
    const container = await metaFetch<{ id: string }>(
      `/${this.accountId}/media`,
      this.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          image_url: imageUrl,
          caption: text,
        }),
      }
    );

    const containerId = container.id;

    // Step 2: Wait for container to be ready (IG processes async)
    let status = "IN_PROGRESS";
    let attempts = 0;
    while (status === "IN_PROGRESS" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      const check = await metaFetch<{
        status_code: string;
        status: string;
      }>(
        `/${containerId}?fields=status_code`,
        this.accessToken
      );
      status = check.status_code || "FINISHED";
      attempts++;
    }

    if (status === "ERROR") {
      throw new Error("Instagram media container processing failed");
    }

    // Step 3: Publish the container
    const published = await metaFetch<{ id: string }>(
      `/${this.accountId}/media_publish`,
      this.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          creation_id: containerId,
        }),
      }
    );

    const postId = published.id;

    // Get the permalink
    let postUrl = `https://www.instagram.com/p/${postId}/`;
    try {
      const media = await metaFetch<{ permalink?: string }>(
        `/${postId}?fields=permalink`,
        this.accessToken
      );
      if (media.permalink) postUrl = media.permalink;
    } catch {
      // permalink fetch is optional
    }

    console.log(`[Instagram] Published post ${postId}: ${postUrl}`);
    return { postId, postUrl, platform: "instagram" };
  }

  async getMetrics(postId: string): Promise<PlatformMetrics> {
    if (!this.isConfigured()) return { ...ZERO_METRICS };

    try {
      // Get basic metrics (available to all IG business accounts)
      const media = await metaFetch<{
        like_count?: number;
        comments_count?: number;
      }>(
        `/${postId}?fields=like_count,comments_count`,
        this.accessToken
      );

      // Get insights (impressions, reach, saved — may require additional permissions)
      let impressions = 0;
      let reach = 0;
      let saved = 0;
      try {
        const insights = await metaFetch<{
          data: Array<{ name: string; values: Array<{ value: number }> }>;
        }>(
          `/${postId}/insights?metric=impressions,reach,saved`,
          this.accessToken
        );
        for (const metric of insights.data) {
          const val = metric.values?.[0]?.value || 0;
          if (metric.name === "impressions") impressions = val;
          if (metric.name === "reach") reach = val;
          if (metric.name === "saved") saved = val;
        }
      } catch {
        // Insights may not be available for all post types
      }

      const likes = media.like_count || 0;
      const comments = media.comments_count || 0;
      const totalEngagements = likes + comments + saved;
      const engagementRate =
        impressions > 0 ? (totalEngagements / impressions) * 100 : null;

      return {
        likes,
        shares: 0, // IG doesn't expose share count via API
        comments,
        saves: saved,
        impressions,
        reach,
        engagementRate,
      };
    } catch {
      return { ...ZERO_METRICS };
    }
  }

  async getProfile(): Promise<PlatformProfile> {
    if (!this.isConfigured()) {
      return {
        name: process.env.BRAND_NAME || "Axon",
        handle: "@axon.ai",
        followers: 0,
        following: 0,
        postCount: 0,
      };
    }

    try {
      const profile = await metaFetch<{
        name?: string;
        username?: string;
        followers_count?: number;
        follows_count?: number;
        media_count?: number;
        profile_picture_url?: string;
        biography?: string;
      }>(
        `/${this.accountId}?fields=name,username,followers_count,follows_count,media_count,profile_picture_url,biography`,
        this.accessToken
      );

      return {
        name: profile.name || process.env.BRAND_NAME || "Axon",
        handle: `@${profile.username || "axon.ai"}`,
        followers: profile.followers_count || 0,
        following: profile.follows_count || 0,
        postCount: profile.media_count || 0,
        profileImageUrl: profile.profile_picture_url,
        bio: profile.biography,
      };
    } catch {
      return {
        name: process.env.BRAND_NAME || "Axon",
        handle: "@axon.ai",
        followers: 0,
        following: 0,
        postCount: 0,
      };
    }
  }
}

// ─── FACEBOOK CLIENT (real — Meta Graph API) ────────────────────────────────
// Requires: FACEBOOK_PAGE_ID, META_ACCESS_TOKEN (Page Access Token)
// Setup: Meta Business Suite → Facebook Page → Generate Page Access Token
//
// How posting works:
//   - Text post: POST /{page-id}/feed with message
//   - Photo post: POST /{page-id}/photos with url + caption
//   - Link post: POST /{page-id}/feed with message + link

class FacebookClient implements PlatformClient {
  platform = "facebook";

  private get pageId() {
    return process.env.FACEBOOK_PAGE_ID || "";
  }

  private get accessToken() {
    // Facebook uses a Page Access Token (can share META_ACCESS_TOKEN if scoped to page)
    return process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || "";
  }

  isConfigured(): boolean {
    return !!(this.pageId && this.accessToken);
  }

  async post(text: string, imagePath?: string): Promise<PlatformPostResult> {
    if (!this.isConfigured()) {
      throw new Error(
        "Facebook API not configured. Set FACEBOOK_PAGE_ID and META_ACCESS_TOKEN."
      );
    }

    let postId: string;
    let postUrl: string;

    const imageUrl = await getPublicImageUrl(imagePath || "");

    if (imageUrl) {
      // Photo post — POST /{page-id}/photos
      const result = await metaFetch<{ id: string; post_id?: string }>(
        `/${this.pageId}/photos`,
        this.accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            url: imageUrl,
            caption: text,
            published: true,
          }),
        }
      );
      // photo endpoint returns {id: "photo_id", post_id: "page_post_id"}
      postId = result.post_id || result.id;
    } else {
      // Text-only post — POST /{page-id}/feed
      const result = await metaFetch<{ id: string }>(
        `/${this.pageId}/feed`,
        this.accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            message: text,
            published: true,
          }),
        }
      );
      postId = result.id;
    }

    // Build the URL — FB post IDs are usually "{page_id}_{post_id}"
    const rawPostId = postId.includes("_")
      ? postId.split("_")[1]
      : postId;
    postUrl = `https://www.facebook.com/${this.pageId}/posts/${rawPostId}`;

    console.log(`[Facebook] Published post ${postId}: ${postUrl}`);
    return { postId, postUrl, platform: "facebook" };
  }

  async getMetrics(postId: string): Promise<PlatformMetrics> {
    if (!this.isConfigured()) return { ...ZERO_METRICS };

    try {
      // Get reactions, comments, shares
      const post = await metaFetch<{
        reactions?: { summary?: { total_count?: number } };
        comments?: { summary?: { total_count?: number } };
        shares?: { count?: number };
      }>(
        `/${postId}?fields=reactions.summary(true),comments.summary(true),shares`,
        this.accessToken
      );

      const likes = post.reactions?.summary?.total_count || 0;
      const comments = post.comments?.summary?.total_count || 0;
      const shares = post.shares?.count || 0;

      // Get insights (page post insights)
      let impressions = 0;
      let reach = 0;
      try {
        const insights = await metaFetch<{
          data: Array<{
            name: string;
            values: Array<{ value: number }>;
          }>;
        }>(
          `/${postId}/insights?metric=post_impressions,post_impressions_unique`,
          this.accessToken
        );
        for (const metric of insights.data) {
          const val = metric.values?.[0]?.value || 0;
          if (metric.name === "post_impressions") impressions = val;
          if (metric.name === "post_impressions_unique") reach = val;
        }
      } catch {
        // Insights may need special permissions
      }

      const totalEngagements = likes + comments + shares;
      const engagementRate =
        impressions > 0 ? (totalEngagements / impressions) * 100 : null;

      return {
        likes,
        shares,
        comments,
        saves: 0, // FB doesn't expose saves via API
        impressions,
        reach,
        engagementRate,
      };
    } catch {
      return { ...ZERO_METRICS };
    }
  }

  async getProfile(): Promise<PlatformProfile> {
    if (!this.isConfigured()) {
      return {
        name: process.env.BRAND_NAME || "Axon",
        handle: "axon.ai",
        followers: 0,
        following: 0,
        postCount: 0,
      };
    }

    try {
      const page = await metaFetch<{
        name?: string;
        fan_count?: number;
        followers_count?: number;
        picture?: { data?: { url?: string } };
        about?: string;
      }>(
        `/${this.pageId}?fields=name,fan_count,followers_count,picture,about`,
        this.accessToken
      );

      return {
        name: page.name || process.env.BRAND_NAME || "Axon",
        handle: this.pageId,
        followers: page.followers_count || page.fan_count || 0,
        following: 0, // Pages don't "follow" others
        postCount: 0, // Would need a separate query
        profileImageUrl: page.picture?.data?.url,
        bio: page.about,
      };
    } catch {
      return {
        name: process.env.BRAND_NAME || "Axon",
        handle: "axon.ai",
        followers: 0,
        following: 0,
        postCount: 0,
      };
    }
  }
}

// ─── LINKEDIN CLIENT (placeholder) ──────────────────────────────────────────
// LinkedIn API requires partner-level review for posting permissions.
// This remains a placeholder until LinkedIn Marketing API access is granted.

class LinkedInClient implements PlatformClient {
  platform = "linkedin";

  isConfigured(): boolean {
    return false; // Not yet implemented
  }

  async post(text: string, _imagePath?: string): Promise<PlatformPostResult> {
    console.warn("[LinkedIn] Placeholder — real API not connected. Post text:", text.slice(0, 50));
    return {
      postId: `li_mock_${Date.now()}`,
      postUrl: `https://linkedin.com/feed/update/li_mock_${Date.now()}`,
      platform: "linkedin",
    };
  }

  async getMetrics(_postId: string): Promise<PlatformMetrics> {
    return { ...ZERO_METRICS };
  }

  async getProfile(): Promise<PlatformProfile> {
    return {
      name: process.env.BRAND_NAME || "Axon",
      handle: "axon-ai",
      followers: 0,
      following: 0,
      postCount: 0,
    };
  }
}

// ─── FACTORY ─────────────────────────────────────────────────────────────────

const clients: Record<string, PlatformClient> = {
  twitter: new TwitterClient(),
  linkedin: new LinkedInClient(),
  instagram: new InstagramClient(),
  facebook: new FacebookClient(),
};

export function getClient(platform: string): PlatformClient {
  const client = clients[platform];
  if (!client) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  return client;
}

export function getAllClients(): PlatformClient[] {
  return Object.values(clients);
}

export function getConfiguredPlatforms(): string[] {
  return Object.entries(clients)
    .filter(([, c]) => c.isConfigured())
    .map(([name]) => name);
}
