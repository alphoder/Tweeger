"use client";

import { Heart, MessageCircle, Repeat2, Bookmark, Share, ThumbsUp, Send } from "lucide-react";

interface PostPreviewProps {
  platform: string;
  text: string;
  imagePath?: string | null;
  hashtags?: string[];
}

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
  facebook: 63206,
};

export function PostPreview({ platform, text, imagePath, hashtags }: PostPreviewProps) {
  const fullText = hashtags?.length
    ? `${text}\n\n${hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
    : text;

  const charLimit = PLATFORM_LIMITS[platform] || 280;
  const charCount = fullText.length;
  const isOverLimit = charCount > charLimit;
  const charPercent = Math.min((charCount / charLimit) * 100, 100);

  return (
    <div className="space-y-3">
      {/* Character counter */}
      <div className="flex items-center justify-between text-xs">
        <span className={isOverLimit ? "text-red-400 font-semibold" : "text-zinc-500"}>
          {charCount} / {charLimit}
        </span>
        <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isOverLimit
                ? "bg-red-500"
                : charPercent > 80
                ? "bg-amber-500"
                : "bg-zinc-500"
            }`}
            style={{ width: `${charPercent}%` }}
          />
        </div>
      </div>

      {/* Platform-specific preview card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        {platform === "twitter" && (
          <TwitterPreview text={fullText} imagePath={imagePath} />
        )}
        {platform === "linkedin" && (
          <LinkedInPreview text={fullText} imagePath={imagePath} />
        )}
        {platform === "instagram" && (
          <InstagramPreview text={fullText} imagePath={imagePath} />
        )}
        {platform === "facebook" && (
          <FacebookPreview text={fullText} imagePath={imagePath} />
        )}
      </div>
    </div>
  );
}

// ─── TWITTER PREVIEW ─────────────────────────────────────────────────────────

function TwitterPreview({ text, imagePath }: { text: string; imagePath?: string | null }) {
  return (
    <div className="p-4">
      <div className="flex gap-3">
        <div className="h-10 w-10 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center text-white text-xs font-bold shrink-0">
          A
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-zinc-100">Axon</span>
            <span className="text-zinc-500 text-sm">@axon_ai · now</span>
          </div>
          <p className="text-sm text-zinc-200 mt-1 whitespace-pre-wrap break-words">
            {text || <span className="text-zinc-600 italic">Your post will appear here...</span>}
          </p>
          {imagePath && (
            <div className="mt-3 rounded-xl overflow-hidden border border-zinc-800">
              <img src={imagePath} alt="Post" className="w-full object-cover max-h-64" />
            </div>
          )}
          <div className="flex items-center justify-between mt-3 text-zinc-600 max-w-[300px]">
            <button className="flex items-center gap-1 hover:text-zinc-400 transition-colors">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">0</span>
            </button>
            <button className="flex items-center gap-1 hover:text-green-400 transition-colors">
              <Repeat2 className="h-4 w-4" />
              <span className="text-xs">0</span>
            </button>
            <button className="flex items-center gap-1 hover:text-amber-400 transition-colors">
              <Heart className="h-4 w-4" />
              <span className="text-xs">0</span>
            </button>
            <button className="flex items-center gap-1 hover:text-zinc-400 transition-colors">
              <Bookmark className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LINKEDIN PREVIEW ────────────────────────────────────────────────────────

function LinkedInPreview({ text, imagePath }: { text: string; imagePath?: string | null }) {
  return (
    <div>
      <div className="p-4">
        <div className="flex gap-3 mb-3">
          <div className="h-12 w-12 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center text-white text-sm font-bold shrink-0">
            A
          </div>
          <div>
            <p className="font-semibold text-sm text-zinc-100">Axon</p>
            <p className="text-xs text-zinc-500">AI Automation Agency · Just now</p>
          </div>
        </div>
        <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">
          {text || <span className="text-zinc-600 italic">Your post will appear here...</span>}
        </p>
      </div>
      {imagePath && (
        <img src={imagePath} alt="Post" className="w-full object-cover max-h-72" />
      )}
      <div className="px-4 py-2 border-t border-zinc-800 flex items-center justify-around text-zinc-500 text-xs">
        <button className="flex items-center gap-1 hover:text-blue-400">
          <ThumbsUp className="h-4 w-4" /> Like
        </button>
        <button className="flex items-center gap-1 hover:text-blue-400">
          <MessageCircle className="h-4 w-4" /> Comment
        </button>
        <button className="flex items-center gap-1 hover:text-blue-400">
          <Repeat2 className="h-4 w-4" /> Repost
        </button>
        <button className="flex items-center gap-1 hover:text-blue-400">
          <Send className="h-4 w-4" /> Send
        </button>
      </div>
    </div>
  );
}

// ─── INSTAGRAM PREVIEW ───────────────────────────────────────────────────────

function InstagramPreview({ text, imagePath }: { text: string; imagePath?: string | null }) {
  return (
    <div>
      <div className="flex items-center gap-3 p-3 border-b border-zinc-800">
        <div className="h-8 w-8 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center text-white text-xs font-bold">
          A
        </div>
        <span className="font-semibold text-sm text-zinc-100">axon.ai</span>
      </div>
      <div className="aspect-square bg-zinc-800 flex items-center justify-center">
        {imagePath ? (
          <img src={imagePath} alt="Post" className="w-full h-full object-cover" />
        ) : (
          <span className="text-zinc-600 text-sm">Image required for Instagram</span>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Heart className="h-5 w-5 text-zinc-400 hover:text-red-400 cursor-pointer" />
            <MessageCircle className="h-5 w-5 text-zinc-400 hover:text-zinc-200 cursor-pointer" />
            <Share className="h-5 w-5 text-zinc-400 hover:text-zinc-200 cursor-pointer" />
          </div>
          <Bookmark className="h-5 w-5 text-zinc-400 hover:text-zinc-200 cursor-pointer" />
        </div>
        <p className="text-xs text-zinc-400">0 likes</p>
        <p className="text-sm text-zinc-200 break-words">
          <span className="font-semibold mr-1">axon.ai</span>
          {text || <span className="text-zinc-600 italic">Your caption here...</span>}
        </p>
      </div>
    </div>
  );
}

// ─── FACEBOOK PREVIEW ────────────────────────────────────────────────────────

function FacebookPreview({ text, imagePath }: { text: string; imagePath?: string | null }) {
  return (
    <div>
      <div className="p-4">
        <div className="flex gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center text-white text-xs font-bold shrink-0">
            A
          </div>
          <div>
            <p className="font-semibold text-sm text-zinc-100">Axon</p>
            <p className="text-xs text-zinc-500">Just now · 🌐</p>
          </div>
        </div>
        <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">
          {text || <span className="text-zinc-600 italic">Your post will appear here...</span>}
        </p>
      </div>
      {imagePath && (
        <img src={imagePath} alt="Post" className="w-full object-cover max-h-72" />
      )}
      <div className="px-4 py-2 border-t border-zinc-800">
        <div className="flex items-center justify-around text-zinc-500 text-sm">
          <button className="flex items-center gap-1.5 hover:text-blue-400 py-1.5">
            <ThumbsUp className="h-4 w-4" /> Like
          </button>
          <button className="flex items-center gap-1.5 hover:text-blue-400 py-1.5">
            <MessageCircle className="h-4 w-4" /> Comment
          </button>
          <button className="flex items-center gap-1.5 hover:text-blue-400 py-1.5">
            <Share className="h-4 w-4" /> Share
          </button>
        </div>
      </div>
    </div>
  );
}
