"use client";

import { useState } from "react";
import {
  Copy,
  CheckCircle2,
  RefreshCw,
  Send,
  Star,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Variant {
  angle: string;
  copyText: string;
  cta: string;
  selected: boolean;
  engagementScore?: number;
}

interface AdCopyCardProps {
  variant: Variant;
  index: number;
  platform: string;
  onUpdate: (index: number, updated: Variant) => void;
  onRegenerate: (index: number) => void;
  onQueue: (variant: Variant) => void;
}

const ANGLE_COLORS: Record<string, string> = {
  "ROI-Focused": "text-emerald-400 bg-emerald-500/20",
  "Fear/FOMO": "text-red-400 bg-red-500/20",
  "Social Proof": "text-blue-400 bg-blue-500/20",
  "Problem-Solution": "text-zinc-200 bg-zinc-600/20",
};

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
  facebook: 63206,
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export function AdCopyCard({
  variant,
  index,
  platform,
  onUpdate,
  onRegenerate,
  onQueue,
}: AdCopyCardProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(variant.copyText);

  const charLimit = PLATFORM_LIMITS[platform] || 280;
  const charCount = variant.copyText.length;
  const isOverLimit = charCount > charLimit;

  const angleColor =
    ANGLE_COLORS[variant.angle] || "text-zinc-400 bg-zinc-700";

  function handleSaveEdit() {
    onUpdate(index, { ...variant, copyText: editText });
    setEditing(false);
  }

  function handleToggleSelected() {
    onUpdate(index, { ...variant, selected: !variant.selected });
  }

  function handleCopy() {
    navigator.clipboard.writeText(variant.copyText);
    toast.success("Copied to clipboard");
  }

  return (
    <Card
      className={`border-zinc-800 bg-zinc-900/50 transition-all ${
        variant.selected ? "ring-1 ring-emerald-500/50" : ""
      }`}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Badge className={`text-[9px] ${angleColor}`}>
            {variant.angle}
          </Badge>
          <div className="flex items-center gap-2">
            {variant.engagementScore != null && (
              <Badge className="text-[9px] bg-zinc-500/20 text-zinc-400">
                {variant.engagementScore}/10
              </Badge>
            )}
            <button
              onClick={handleToggleSelected}
              className={`p-1 rounded transition-colors ${
                variant.selected
                  ? "text-emerald-400"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
              title={variant.selected ? "Selected as winner" : "Select winner"}
            >
              <Star
                className="h-4 w-4"
                fill={variant.selected ? "currentColor" : "none"}
              />
            </button>
          </div>
        </div>

        {/* Copy Text */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 resize-none focus:outline-none focus:border-zinc-500/50"
            />
            <div className="flex justify-end gap-1.5">
              <button
                onClick={() => setEditing(false)}
                className="px-2 py-1 text-[10px] rounded bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-2 py-1 text-[10px] rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p
            className="text-xs text-zinc-300 leading-relaxed cursor-pointer hover:text-zinc-100 min-h-[60px]"
            onClick={() => {
              setEditText(variant.copyText);
              setEditing(true);
            }}
          >
            {variant.copyText}
          </p>
        )}

        {/* CTA */}
        {variant.cta && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500">CTA:</span>
            <span className="text-[10px] text-zinc-400 font-medium">
              {variant.cta}
            </span>
          </div>
        )}

        {/* Character Count */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isOverLimit ? "bg-red-500" : "bg-zinc-500"
              }`}
              style={{
                width: `${Math.min((charCount / charLimit) * 100, 100)}%`,
              }}
            />
          </div>
          <span
            className={`text-[10px] ${
              isOverLimit ? "text-red-400" : "text-zinc-500"
            }`}
          >
            {charCount}/{charLimit}
          </span>
          {isOverLimit && (
            <AlertCircle className="h-3 w-3 text-red-400" />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 pt-1">
          <button
            onClick={handleCopy}
            className="flex-1 inline-flex items-center justify-center rounded-md text-[10px] font-medium py-1.5 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </button>
          <button
            onClick={() => onRegenerate(index)}
            className="flex-1 inline-flex items-center justify-center rounded-md text-[10px] font-medium py-1.5 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Regenerate
          </button>
          <button
            onClick={() => onQueue(variant)}
            className="flex-1 inline-flex items-center justify-center rounded-md text-[10px] font-medium py-1.5 bg-zinc-500/20 text-zinc-300 hover:bg-zinc-500/30"
          >
            <Send className="h-3 w-3 mr-1" />
            Queue
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
