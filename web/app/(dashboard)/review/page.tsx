"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Check,
  X,
  MessageSquare,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  RotateCcw,
  Send,
  ArrowUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ReviewCard, type ReviewItem } from "@/components/review/review-card";
import { agentColor } from "@/lib/agents/colors";

// ─── REVIEW DECK PAGE ────────────────────────────────────────────────────────
// Responsive: mobile swipe deck vs desktop carousel with keyboard shortcuts.

export default function ReviewDeckPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionOverlay, setActionOverlay] = useState<"approve" | "reject" | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [undoItem, setUndoItem] = useState<{ item: ReviewItem; index: number } | null>(null);
  const [reviewStartTime, setReviewStartTime] = useState<number>(Date.now());

  // Touch gesture state
  const touchRef = useRef<{ startX: number; startY: number; currentX: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // ─── FETCH ITEMS ──────────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/review?status=pending_review");
      if (res.ok) {
        const data = await res.json();
        // Enrich with draft content
        const enriched: ReviewItem[] = await Promise.all(
          data.map(async (item: Record<string, unknown>) => {
            const base: ReviewItem = {
              id: item.id as number,
              draftId: item.draftId as number,
              brandId: item.brandId as number | null,
              platform: item.platform as string,
              reviewStatus: item.reviewStatus as string,
              content: "No content available",
              hashtags: [],
              aiReasoning: item.aiReasoning as string | null,
              aiScore: item.aiScore as number | null,
              scoreBreakdown: item.scoreBreakdown as Record<string, number> | null,
              targetSignal: item.targetSignal as string | null,
              suggestedTime: item.suggestedTime as string | null,
              researchSummary: item.researchSummary as string | null,
              reviewOrder: item.reviewOrder as number | null,
            };

            try {
              const draftRes = await fetch(`/api/drafts?id=${item.draftId}`);
              if (draftRes.ok) {
                const draft = await draftRes.json();
                base.content = draft.text || "No content";
                base.hashtags = Array.isArray(draft.hashtags) ? draft.hashtags : [];
              }
            } catch {
              // Try to pull content from previewData as fallback
              const previewData = item.previewData as Record<string, unknown> | null;
              if (previewData?.content) {
                base.content = previewData.content as string;
              }
            }

            return base;
          })
        );
        setItems(enriched);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Live: pick up new team posts without a manual reload
  useEffect(() => {
    const t = setInterval(() => {
      if (!editMode) fetchItems();
    }, 20000);
    return () => clearInterval(t);
  }, [fetchItems, editMode]);

  // Reset review timer when card changes
  useEffect(() => {
    setReviewStartTime(Date.now());
  }, [currentIndex]);

  // ─── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (editMode) return; // Don't capture when editing

      if (e.key === "ArrowRight" || e.key === "a") {
        handleApprove();
      } else if (e.key === "ArrowLeft" || e.key === "r") {
        handleReject();
      } else if (e.key === "ArrowUp" || e.key === "e") {
        setEditMode(true);
      } else if (e.key === "Escape") {
        setEditMode(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, items, editMode]);

  // ─── TOUCH GESTURES ──────────────────────────────────────────────────────

  function handleTouchStart(e: React.TouchEvent) {
    touchRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      currentX: e.touches[0].clientX,
    };
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchRef.current) return;
    touchRef.current.currentX = e.touches[0].clientX;
    const deltaX = touchRef.current.currentX - touchRef.current.startX;

    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${deltaX * 0.5}px) rotate(${deltaX * 0.03}deg)`;
      cardRef.current.style.transition = "none";
    }

    // Show overlay based on direction
    if (deltaX > 60) {
      setActionOverlay("approve");
    } else if (deltaX < -60) {
      setActionOverlay("reject");
    } else {
      setActionOverlay(null);
    }
  }

  function handleTouchEnd() {
    if (!touchRef.current) return;
    const deltaX = touchRef.current.currentX - touchRef.current.startX;
    const deltaY = touchRef.current.startY - (touchRef.current.currentX); // simplified

    if (cardRef.current) {
      cardRef.current.style.transform = "";
      cardRef.current.style.transition = "transform 0.3s ease";
    }

    setActionOverlay(null);

    if (deltaX > 100) {
      handleApprove();
    } else if (deltaX < -100) {
      handleReject();
    }

    touchRef.current = null;
  }

  // ─── ACTIONS ─────────────────────────────────────────────────────────────

  const currentItem = items[currentIndex];

  async function handleApprove() {
    if (!currentItem) return;

    const reviewDurationMs = Date.now() - reviewStartTime;

    try {
      const res = await fetch("/api/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentItem.id,
          action: "approve",
          reviewDurationMs,
        }),
      });

      if (res.ok) {
        toast.success("Post approved! 🎉", { duration: 2000 });
        // Save for undo
        setUndoItem({ item: currentItem, index: currentIndex });
        // Remove from list
        const newItems = items.filter((_, i) => i !== currentIndex);
        setItems(newItems);
        if (currentIndex >= newItems.length && newItems.length > 0) {
          setCurrentIndex(newItems.length - 1);
        }
      }
    } catch {
      toast.error("Failed to approve");
    }
  }

  async function handleReject() {
    if (!currentItem) return;

    const reviewDurationMs = Date.now() - reviewStartTime;

    try {
      const res = await fetch("/api/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentItem.id,
          action: "reject",
          reviewDurationMs,
        }),
      });

      if (res.ok) {
        toast("Post rejected", { duration: 2000 });
        setUndoItem({ item: currentItem, index: currentIndex });
        const newItems = items.filter((_, i) => i !== currentIndex);
        setItems(newItems);
        if (currentIndex >= newItems.length && newItems.length > 0) {
          setCurrentIndex(newItems.length - 1);
        }
      }
    } catch {
      toast.error("Failed to reject");
    }
  }

  async function handleApproveAll() {
    for (const item of items) {
      try {
        await fetch("/api/review", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, action: "approve" }),
        });
      } catch { /* continue */ }
    }
    toast.success(`${items.length} posts approved!`);
    setItems([]);
    setCurrentIndex(0);
  }

  async function handleSendEdit() {
    if (!editMessage.trim() || !currentItem) return;

    setEditLoading(true);

    try {
      const res = await fetch("/api/review/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewQueueId: currentItem.id,
          draftId: currentItem.draftId,
          brandId: currentItem.brandId,
          message: editMessage.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update the current item's content
        const updated = [...items];
        updated[currentIndex] = {
          ...currentItem,
          content: data.revisedContent,
        };
        setItems(updated);
        setEditMessage("");
        toast.success("Content updated!");
      }
    } catch {
      toast.error("Failed to send edit");
    } finally {
      setEditLoading(false);
    }
  }

  // ─── RENDER: LOADING ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-zinc-400 animate-spin" />
      </div>
    );
  }

  // ─── RENDER: EMPTY STATE ───────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Review Deck</h1>
          <p className="text-sm text-zinc-400 mt-1">Approve, reject, or edit AI-generated content before it goes live.</p>
        </div>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
              <CheckCheck className="h-8 w-8 text-zinc-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-zinc-300">All caught up!</h3>
            <p className="mt-2 text-sm text-zinc-500 max-w-md">
              No posts pending review. Send{" "}
              <span className="font-mono text-zinc-300">/build</span> to the Telegram bot and the
              team&apos;s next post will appear here for approval.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── RENDER: REVIEW DECK ──────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Review Deck</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {items.length} post{items.length !== 1 ? "s" : ""} pending review
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
            {currentIndex + 1}/{items.length}
          </Badge>
          {items.length > 1 && (
            <Button
              onClick={handleApproveAll}
              variant="outline"
              size="sm"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
              Approve All
            </Button>
          )}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrentIndex(i); setEditMode(false); }}
            className={`h-2 rounded-full transition-all ${
              i === currentIndex ? "w-6 bg-zinc-400" : "w-2 bg-zinc-700 hover:bg-zinc-600"
            }`}
          />
        ))}
      </div>

      {/* Card container */}
      <div className="relative">
        {/* Swipe overlay */}
        {actionOverlay && (
          <div
            className={`absolute inset-0 z-10 rounded-2xl flex items-center justify-center text-4xl font-bold pointer-events-none ${
              actionOverlay === "approve"
                ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400"
                : "bg-red-500/20 border-2 border-red-500 text-red-400"
            }`}
          >
            {actionOverlay === "approve" ? "✓ APPROVE" : "✗ REJECT"}
          </div>
        )}

        {/* The card */}
        <div
          ref={cardRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="select-none"
        >
          {currentItem && (
            <ReviewCard item={currentItem} />
          )}
        </div>
      </div>

      {/* Team transcript — watch the agents build this post */}
      {currentItem && <TeamTranscript draftId={currentItem.draftId} />}

      {/* Edit mode */}
      {editMode && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-zinc-200" />
              <span className="text-sm font-medium text-zinc-200">Edit & Discuss</span>
              <button
                onClick={() => setEditMode(false)}
                className="ml-auto text-zinc-500 hover:text-zinc-300 text-xs"
              >
                Close
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                placeholder="Tell the AI what to change... (e.g., 'Make it more casual' or 'Add a question at the end')"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
                onKeyDown={(e) => e.key === "Enter" && !editLoading && handleSendEdit()}
              />
              <Button
                onClick={handleSendEdit}
                disabled={editLoading || !editMessage.trim()}
                size="sm"
                className="bg-zinc-600 hover:bg-zinc-600 text-white shrink-0"
              >
                {editLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-4">
        {/* Previous */}
        <Button
          onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setEditMode(false); }}
          disabled={currentIndex === 0}
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full border-zinc-700 text-zinc-400"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {/* Reject */}
        <Button
          onClick={handleReject}
          size="icon"
          className="h-14 w-14 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 shadow-lg shadow-red-500/10"
        >
          <X className="h-6 w-6" />
        </Button>

        {/* Edit */}
        <Button
          onClick={() => setEditMode(!editMode)}
          size="icon"
          className={`h-12 w-12 rounded-full border shadow-lg ${
            editMode
              ? "bg-zinc-600/30 border-zinc-600/50 text-zinc-200"
              : "bg-zinc-600/20 border-zinc-600/30 text-zinc-200 hover:bg-zinc-600/30"
          }`}
        >
          <ArrowUp className="h-5 w-5" />
        </Button>

        {/* Approve */}
        <Button
          onClick={handleApprove}
          size="icon"
          className="h-14 w-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 shadow-lg shadow-emerald-500/10"
        >
          <Check className="h-6 w-6" />
        </Button>

        {/* Next */}
        <Button
          onClick={() => { setCurrentIndex(Math.min(items.length - 1, currentIndex + 1)); setEditMode(false); }}
          disabled={currentIndex === items.length - 1}
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full border-zinc-700 text-zinc-400"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Keyboard hints (desktop only) */}
      <div className="hidden md:flex items-center justify-center gap-6 text-xs text-zinc-600">
        <span>← Reject</span>
        <span>↑ Edit</span>
        <span>→ Approve</span>
        <span>Esc Close</span>
      </div>

      {/* Undo toast */}
      {undoItem && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => {
              // Restore the item
              const newItems = [...items];
              newItems.splice(undoItem.index, 0, undoItem.item);
              setItems(newItems);
              setCurrentIndex(undoItem.index);
              setUndoItem(null);
              toast("Action undone");
            }}
            className="flex items-center gap-2 rounded-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors shadow-xl"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

// ─── TEAM TRANSCRIPT ─────────────────────────────────────────────────────────
// Collapsible thread showing how the agent team built this post.

interface TranscriptMsg {
  agentKey: string;
  name: string;
  designation: string;
  emoji: string;
  content: string;
  timestamp: string;
}

function TeamTranscript({ draftId }: { draftId: number }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TranscriptMsg[] | null>(null);

  useEffect(() => {
    setMessages(null);
    setOpen(false);
  }, [draftId]);

  async function toggle() {
    if (!open && messages === null) {
      try {
        const res = await fetch(`/api/team/run?draftId=${draftId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data?.messages ?? []);
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      }
    }
    setOpen(!open);
  }

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardContent className="p-4">
        <button
          onClick={toggle}
          className="flex w-full items-center gap-2 text-sm font-medium text-zinc-300 hover:text-zinc-100"
        >
          <span>🧠</span>
          <span>Watch the team build this post</span>
          <span className="ml-auto text-xs text-zinc-500">{open ? "Hide" : "Show"}</span>
        </button>

        {open && (
          <div className="mt-4 space-y-3">
            {messages === null ? (
              <p className="text-sm text-zinc-500">Loading transcript...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No transcript for this post — it wasn&apos;t built by the team pipeline.
              </p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className="flex gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base ring-1 ${agentColor(m.agentKey).bg} ${agentColor(m.agentKey).ring}`}>
                    {m.emoji}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className={`font-semibold ${agentColor(m.agentKey).text}`}>{m.name}</span>{" "}
                      <span className="text-xs text-zinc-500">{m.designation}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                      {m.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
