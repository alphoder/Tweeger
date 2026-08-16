"use client";

// ─── PLATFORM PREVIEW COMPONENTS ──────────────────────────────────────────────
// Pixel-perfect mock previews for each social platform.
// Used in the Review Deck to show how posts will look.

import { cn } from "@/lib/utils";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share,
  ThumbsUp,
  Send,
  MoreHorizontal,
} from "lucide-react";

interface PreviewProps {
  content: string;
  platform: string;
  brandName?: string;
  hashtags?: string[];
  imageUrl?: string;
}

// ─── TWITTER PREVIEW ─────────────────────────────────────────────────────────

function TwitterPreview({ content, brandName, hashtags }: PreviewProps) {
  return (
    <div className="bg-black rounded-xl border border-zinc-800 p-4 font-sans text-[15px]">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-white text-black hover:bg-zinc-200 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-bold text-white text-sm">{brandName || "Brand"}</span>
            <svg viewBox="0 0 22 22" className="h-[18px] w-[18px] text-zinc-400 fill-current shrink-0">
              <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.271.586.702 1.084 1.24 1.438.54.354 1.167.551 1.813.569.647-.019 1.276-.217 1.817-.571s.972-.854 1.245-1.44c.604.225 1.261.272 1.893.143.634-.131 1.22-.434 1.69-.88.445-.47.75-1.055.88-1.69.131-.636.084-1.297-.14-1.9.588-.27 1.084-.7 1.438-1.24.354-.543.553-1.174.57-1.82zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
            </svg>
          </div>
          <span className="text-zinc-500 text-sm">@{(brandName || "brand").toLowerCase().replace(/\s/g, "")}</span>
        </div>
        <MoreHorizontal className="h-5 w-5 text-zinc-600" />
      </div>

      {/* Content */}
      <div className="mt-3 text-white whitespace-pre-wrap leading-relaxed text-[15px]">
        {content}
      </div>

      {/* Hashtags */}
      {hashtags && hashtags.length > 0 && (
        <div className="mt-2 text-zinc-400 text-sm">
          {hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ")}
        </div>
      )}

      {/* Timestamp */}
      <div className="mt-3 text-zinc-500 text-xs">
        2:30 PM · Mar 12, 2026
      </div>

      {/* Engagement bar */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
        <button className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-400 transition-colors">
          <MessageCircle className="h-4 w-4" />
          <span className="text-xs">24</span>
        </button>
        <button className="flex items-center gap-1.5 text-zinc-500 hover:text-green-400 transition-colors">
          <Repeat2 className="h-4 w-4" />
          <span className="text-xs">12</span>
        </button>
        <button className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 transition-colors">
          <Heart className="h-4 w-4" />
          <span className="text-xs">86</span>
        </button>
        <button className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-400 transition-colors">
          <Bookmark className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-400 transition-colors">
          <Share className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── LINKEDIN PREVIEW ────────────────────────────────────────────────────────

function LinkedInPreview({ content, brandName, hashtags }: PreviewProps) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 font-sans text-[14px]">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-2">
        <div className="h-12 w-12 rounded-full bg-white text-black hover:bg-zinc-200 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-zinc-900 text-sm block">{brandName || "Brand"}</span>
          <span className="text-zinc-500 text-xs block">AI Automation Agency · 1,234 followers</span>
          <span className="text-zinc-400 text-xs">2h · 🌐</span>
        </div>
        <MoreHorizontal className="h-5 w-5 text-zinc-400" />
      </div>

      {/* Content */}
      <div className="px-4 pb-3 text-zinc-800 whitespace-pre-wrap leading-relaxed text-[14px]">
        {content.length > 200 ? `${content.slice(0, 200)}... see more` : content}
      </div>

      {/* Hashtags */}
      {hashtags && hashtags.length > 0 && (
        <div className="px-4 pb-3 text-blue-600 text-xs">
          {hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ")}
        </div>
      )}

      {/* Stats */}
      <div className="px-4 py-2 flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-100">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            <span className="inline-flex h-4 w-4 rounded-full bg-blue-500 items-center justify-center text-white text-[8px]">👍</span>
            <span className="inline-flex h-4 w-4 rounded-full bg-red-500 items-center justify-center text-white text-[8px]">❤️</span>
          </div>
          <span>42</span>
        </div>
        <span>8 comments · 3 reposts</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-around px-4 py-2 border-t border-zinc-100">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <button key={label} className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-900 py-1 px-2 rounded transition-colors">
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── INSTAGRAM PREVIEW ───────────────────────────────────────────────────────

function InstagramPreview({ content, brandName, hashtags }: PreviewProps) {
  return (
    <div className="bg-black rounded-xl border border-zinc-800 font-sans text-[14px]">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div className="h-8 w-8 rounded-full bg-white text-black hover:bg-zinc-200 p-[2px]">
          <div className="h-full w-full rounded-full bg-black flex items-center justify-center">
            <div className="h-[26px] w-[26px] rounded-full bg-white text-black hover:bg-zinc-200 " />
          </div>
        </div>
        <span className="font-semibold text-white text-sm">{(brandName || "brand").toLowerCase().replace(/\s/g, "")}</span>
        <MoreHorizontal className="h-5 w-5 text-zinc-500 ml-auto" />
      </div>

      {/* Image placeholder */}
      <div className="aspect-square bg-white text-black hover:bg-zinc-200 flex items-center justify-center">
        <span className="text-zinc-600 text-sm">📷 Image Preview</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-4">
          <Heart className="h-6 w-6 text-white" />
          <MessageCircle className="h-6 w-6 text-white" />
          <Send className="h-6 w-6 text-white" />
        </div>
        <Bookmark className="h-6 w-6 text-white" />
      </div>

      {/* Likes */}
      <div className="px-3 text-white text-sm font-semibold">128 likes</div>

      {/* Caption */}
      <div className="px-3 py-1">
        <span className="text-white text-sm">
          <span className="font-semibold">{(brandName || "brand").toLowerCase().replace(/\s/g, "")} </span>
          {content.length > 150 ? `${content.slice(0, 150)}... more` : content}
        </span>
      </div>

      {/* Hashtags */}
      {hashtags && hashtags.length > 0 && (
        <div className="px-3 pb-2 text-blue-400 text-xs">
          {hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ")}
        </div>
      )}

      {/* Comments */}
      <div className="px-3 pb-3">
        <span className="text-zinc-500 text-xs">View all 12 comments</span>
      </div>
    </div>
  );
}

// ─── FACEBOOK PREVIEW ────────────────────────────────────────────────────────

function FacebookPreview({ content, brandName, hashtags }: PreviewProps) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 font-sans text-[14px]">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-2">
        <div className="h-10 w-10 rounded-full bg-white text-black hover:bg-zinc-200 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-zinc-900 text-sm block">{brandName || "Brand"}</span>
          <div className="flex items-center gap-1 text-zinc-500 text-xs">
            <span>2h</span>
            <span>·</span>
            <span>🌐</span>
          </div>
        </div>
        <MoreHorizontal className="h-5 w-5 text-zinc-400" />
      </div>

      {/* Content */}
      <div className="px-4 pb-3 text-zinc-800 whitespace-pre-wrap leading-relaxed text-[14px]">
        {content}
      </div>

      {/* Hashtags */}
      {hashtags && hashtags.length > 0 && (
        <div className="px-4 pb-3 text-blue-600 text-xs">
          {hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ")}
        </div>
      )}

      {/* Stats */}
      <div className="px-4 py-2 flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-100">
        <div className="flex items-center gap-1">
          <span>👍 ❤️ 56</span>
        </div>
        <span>14 comments · 6 shares</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-around px-4 py-2 border-t border-zinc-100">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Share, label: "Share" },
        ].map(({ icon: Icon, label }) => (
          <button key={label} className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-900 py-1 px-3 rounded transition-colors">
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── PLATFORM PREVIEW WRAPPER ────────────────────────────────────────────────

export function PlatformPreview(props: PreviewProps) {
  const { platform } = props;

  switch (platform) {
    case "twitter":
      return <TwitterPreview {...props} />;
    case "linkedin":
      return <LinkedInPreview {...props} />;
    case "instagram":
      return <InstagramPreview {...props} />;
    case "facebook":
      return <FacebookPreview {...props} />;
    default:
      return <TwitterPreview {...props} />;
  }
}

// ─── PLATFORM BADGE ──────────────────────────────────────────────────────────

const PLATFORM_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  twitter: { bg: "bg-zinc-500/20", text: "text-zinc-400", label: "𝕏 Twitter" },
  linkedin: { bg: "bg-blue-600/20", text: "text-blue-400", label: "in LinkedIn" },
  instagram: { bg: "bg-zinc-600/20", text: "text-zinc-200", label: "📷 Instagram" },
  facebook: { bg: "bg-blue-500/20", text: "text-blue-400", label: "f Facebook" },
};

export function PlatformBadge({ platform }: { platform: string }) {
  const style = PLATFORM_STYLES[platform] || PLATFORM_STYLES.twitter;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        style.bg,
        style.text
      )}
    >
      {style.label}
    </span>
  );
}
