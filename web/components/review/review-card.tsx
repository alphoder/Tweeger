"use client";

// ─── REVIEW CARD ──────────────────────────────────────────────────────────────
// A single review card showing platform preview + AI intelligence panel.
// Used in both mobile and desktop Review Deck views.

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Brain,
  Target,
  Clock,
  BarChart3,
  Zap,
} from "lucide-react";
import { PlatformPreview, PlatformBadge } from "./platform-preview";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ReviewItem {
  id: number;
  draftId: number;
  brandId?: number | null;
  platform: string;
  reviewStatus: string;
  content: string;
  hashtags?: string[];
  aiReasoning?: string | null;
  aiScore?: number | null;
  scoreBreakdown?: Record<string, number> | null;
  targetSignal?: string | null;
  suggestedTime?: string | null;
  researchSummary?: string | null;
  reviewOrder?: number | null;
  brandName?: string;
}

interface ReviewCardProps {
  item: ReviewItem;
  className?: string;
}

export function ReviewCard({ item, className }: ReviewCardProps) {
  const [showIntelligence, setShowIntelligence] = useState(false);

  return (
    <div
      className={cn(
        "rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-xl",
        className
      )}
    >
      {/* Platform badge header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <PlatformBadge platform={item.platform} />
        {item.aiScore && (
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-zinc-200" />
            <span className="text-sm font-semibold text-zinc-200">{item.aiScore}/100</span>
          </div>
        )}
      </div>

      {/* Platform preview */}
      <div className="p-4">
        <PlatformPreview
          content={item.content}
          platform={item.platform}
          brandName={item.brandName}
          hashtags={item.hashtags}
        />
      </div>

      {/* AI Intelligence panel (collapsible) */}
      <div className="border-t border-zinc-800">
        <button
          onClick={() => setShowIntelligence(!showIntelligence)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-zinc-200" />
            <span className="font-medium">AI Intelligence</span>
          </div>
          {showIntelligence ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {showIntelligence && (
          <div className="px-4 pb-4 space-y-3">
            {/* AI Reasoning */}
            {item.aiReasoning && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Reasoning</span>
                <p className="text-sm text-zinc-300 leading-relaxed">{item.aiReasoning}</p>
              </div>
            )}

            {/* Score Breakdown */}
            {item.scoreBreakdown && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Score Breakdown</span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(item.scoreBreakdown).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-1.5">
                      <span className="text-xs text-zinc-400 capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="text-xs font-medium text-zinc-200">{value as number}/100</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Target Signal + Suggested Time */}
            <div className="flex flex-wrap gap-2">
              {item.targetSignal && (
                <Badge variant="outline" className="text-xs border-zinc-600/30 text-zinc-200">
                  <Target className="h-3 w-3 mr-1" />
                  Target: {item.targetSignal}
                </Badge>
              )}
              {item.suggestedTime && (
                <Badge variant="outline" className="text-xs border-zinc-500/30 text-zinc-400">
                  <Clock className="h-3 w-3 mr-1" />
                  {new Date(item.suggestedTime).toLocaleString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                    weekday: "short",
                    hour12: true,
                  })}
                </Badge>
              )}
            </div>

            {/* Research Summary */}
            {item.researchSummary && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Research Backing</span>
                <p className="text-xs text-zinc-400 leading-relaxed">{item.researchSummary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
