"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  Edit3,
  Trash2,
  Zap,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface QueueCardProps {
  item: {
    id: number;
    text: string;
    imagePath?: string | null;
    platform: string;
    scheduledTime: string;
    status: string;
    postedAt?: string | null;
    postUrl?: string | null;
    error?: string | null;
    retryCount: number;
    maxRetries: number;
    // Posted metrics (optional)
    likes?: number;
    shares?: number;
    comments?: number;
    impressions?: number;
    engagementRate?: number | null;
  };
  onEdit?: (id: number) => void;
  onReschedule?: (id: number) => void;
  onPostNow?: (id: number) => void;
  onDelete?: (id: number) => void;
  onRetry?: (id: number) => void;
}

const PLATFORM_STYLES: Record<string, { icon: string; color: string; bg: string }> = {
  twitter: { icon: "𝕏", color: "text-zinc-400", bg: "bg-zinc-500/20" },
  linkedin: { icon: "in", color: "text-blue-400", bg: "bg-blue-500/20" },
  instagram: { icon: "📷", color: "text-amber-400", bg: "bg-amber-500/20" },
  facebook: { icon: "f", color: "text-blue-500", bg: "bg-blue-600/20" },
};

function useCountdown(targetDate: string, active: boolean) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!active) return;

    function update() {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Posting...");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`in ${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setTimeLeft(`in ${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`in ${minutes}m`);
      }
    }

    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [targetDate, active]);

  return timeLeft;
}

export function QueueCard({
  item,
  onEdit,
  onReschedule,
  onPostNow,
  onDelete,
  onRetry,
}: QueueCardProps) {
  const ps = PLATFORM_STYLES[item.platform] || PLATFORM_STYLES.twitter;
  const isScheduled = item.status === "scheduled";
  const isPosted = item.status === "posted";
  const isFailed = item.status === "failed";

  const countdown = useCountdown(item.scheduledTime, isScheduled);

  const statusBadge = {
    scheduled: { label: "Scheduled", className: "bg-blue-500/20 text-blue-400", icon: Clock },
    posting: { label: "Posting...", className: "bg-amber-500/20 text-amber-400", icon: Zap },
    posted: { label: "Posted", className: "bg-green-500/20 text-green-400", icon: CheckCircle2 },
    failed: { label: "Failed", className: "bg-red-500/20 text-red-400", icon: XCircle },
    cancelled: { label: "Cancelled", className: "bg-zinc-500/20 text-zinc-400", icon: XCircle },
  }[item.status] || { label: item.status, className: "", icon: Clock };

  const StatusIcon = statusBadge.icon;

  return (
    <Card className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900/80 transition-colors">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Platform badge & image */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div
              className={`h-10 w-10 rounded-lg ${ps.bg} flex items-center justify-center ${ps.color} font-bold text-lg`}
            >
              {ps.icon}
            </div>
            {item.imagePath && (
              <img
                src={item.imagePath}
                alt=""
                className="h-14 w-14 rounded-lg object-cover border border-zinc-800"
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm text-zinc-200 line-clamp-3">{item.text}</p>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-[10px] ${statusBadge.className}`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusBadge.label}
              </Badge>

              {isScheduled && countdown && (
                <span className="text-[10px] text-zinc-400 font-medium">
                  {countdown}
                </span>
              )}

              <span className="text-[10px] text-zinc-600">
                {isPosted && item.postedAt
                  ? new Date(item.postedAt).toLocaleString("en-IN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : new Date(item.scheduledTime).toLocaleString("en-IN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
              </span>
            </div>

            {/* Error message */}
            {isFailed && item.error && (
              <div className="flex items-start gap-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg px-2 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{item.error}</span>
              </div>
            )}

            {/* Engagement metrics for posted items */}
            {isPosted && (item.likes || item.shares || item.comments || item.impressions) && (
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                {item.likes !== undefined && <span>❤️ {item.likes}</span>}
                {item.shares !== undefined && <span>🔁 {item.shares}</span>}
                {item.comments !== undefined && <span>💬 {item.comments}</span>}
                {item.impressions !== undefined && (
                  <span>👁 {item.impressions.toLocaleString()}</span>
                )}
                {item.engagementRate != null && (
                  <Badge className="bg-green-500/20 text-green-400 text-[9px]">
                    {(item.engagementRate * 100).toFixed(1)}% ER
                  </Badge>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {isScheduled && (
                <>
                  {onEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] border-zinc-700"
                      onClick={() => onEdit(item.id)}
                    >
                      <Edit3 className="h-3 w-3 mr-1" /> Edit
                    </Button>
                  )}
                  {onReschedule && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] border-zinc-700"
                      onClick={() => onReschedule(item.id)}
                    >
                      <Clock className="h-3 w-3 mr-1" /> Reschedule
                    </Button>
                  )}
                  {onPostNow && (
                    <Button
                      size="sm"
                      className="h-7 text-[10px] bg-zinc-600 hover:bg-zinc-700"
                      onClick={() => onPostNow(item.id)}
                    >
                      <Zap className="h-3 w-3 mr-1" /> Post Now
                    </Button>
                  )}
                </>
              )}

              {isPosted && item.postUrl && (
                <a
                  href={item.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center h-7 px-2 text-[10px] rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <ExternalLink className="h-3 w-3 mr-1" /> View Post
                </a>
              )}

              {isFailed && onRetry && item.retryCount < item.maxRetries && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] border-amber-700 text-amber-400"
                  onClick={() => onRetry(item.id)}
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Retry ({item.retryCount}/{item.maxRetries})
                </Button>
              )}

              {onDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] border-red-800 text-red-400 hover:bg-red-500/20"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
