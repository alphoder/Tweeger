"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-shell";
import { QueueCard } from "@/components/queue-card";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface QueueItem {
  id: number;
  text: string;
  imagePath: string | null;
  platform: string;
  scheduledTime: string;
  status: string;
  postedAt: string | null;
  postId: string | null;
  postUrl: string | null;
  error: string | null;
  retryCount: number;
  maxRetries: number;
}

const TABS = [
  { key: "scheduled", label: "Scheduled", icon: Clock, color: "text-blue-400" },
  { key: "posted", label: "Posted", icon: CheckCircle2, color: "text-green-400" },
  { key: "failed", label: "Failed", icon: XCircle, color: "text-red-400" },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("scheduled");
  const [total, setTotal] = useState(0);

  // ─── FETCH QUEUE ──────────────────────────────────────────────────────────

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", tab);
      params.set("limit", "30");

      const res = await fetch(`/api/queue?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } catch {
      toast.error("Failed to fetch queue");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // ─── ACTIONS ──────────────────────────────────────────────────────────────

  async function handlePostNow(id: number) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    try {
      const res = await fetch("/api/twitter/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: item.text,
          imagePath: item.imagePath,
          queueId: item.id,
        }),
      });

      if (res.ok) {
        toast.success("Posted successfully!");
        fetchQueue();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to post");
      }
    } catch {
      toast.error("Failed to post");
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/queue?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Removed from queue");
        fetchQueue();
      }
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function handleRetry(id: number) {
    try {
      const res = await fetch("/api/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: "scheduled",
          scheduledTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // retry in 5 min
        }),
      });

      if (res.ok) {
        toast.success("Retry scheduled");
        fetchQueue();
      }
    } catch {
      toast.error("Retry failed");
    }
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader title="Post Queue" description="Everything scheduled, shipped, or stuck" />

      {/* Status Tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-zinc-700 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${tab === t.key ? t.color : ""}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Queue Items */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              {total} {tab} post{total !== 1 ? "s" : ""}
            </span>
            {tab === "scheduled" && (
              <span className="text-zinc-400">Next post at top</span>
            )}
          </div>

          {items.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              onPostNow={tab === "scheduled" ? handlePostNow : undefined}
              onDelete={handleDelete}
              onRetry={tab === "failed" ? handleRetry : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-zinc-600">
          {tab === "scheduled" ? (
            <>
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Queue is empty</p>
              <p className="text-xs mt-1">
                Send /build to the Telegram bot — approved posts land here.
              </p>
            </>
          ) : tab === "posted" ? (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No posted items</p>
              <p className="text-xs mt-1">Posts will appear here after publishing.</p>
            </>
          ) : (
            <>
              <XCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No failed posts</p>
              <p className="text-xs mt-1">That&apos;s a good thing!</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
