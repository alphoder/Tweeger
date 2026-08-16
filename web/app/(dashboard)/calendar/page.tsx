"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface CalendarPost {
  id: number;
  text: string;
  imagePath: string | null;
  platform: string;
  scheduledTime: string;
  status: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "bg-zinc-500",
  linkedin: "bg-blue-500",
  instagram: "bg-zinc-600",
  facebook: "bg-blue-600",
};

const PLATFORM_ICONS: Record<string, string> = {
  twitter: "𝕏",
  linkedin: "in",
  instagram: "📷",
  facebook: "f",
};

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8 AM to 10 PM
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [view, setView] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [activePost, setActivePost] = useState<CalendarPost | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // ─── DATE HELPERS ─────────────────────────────────────────────────────────

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getWeekDays(startDate: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      return d;
    });
  }

  const weekStart = getWeekStart(currentDate);
  const weekDays = getWeekDays(weekStart);

  // ─── FETCH POSTS ──────────────────────────────────────────────────────────

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");

      // Fetch scheduled + posted for the time window
      const [scheduledRes, postedRes] = await Promise.all([
        fetch(`/api/queue?status=scheduled&${params}`),
        fetch(`/api/queue?status=posted&${params}`),
      ]);

      const scheduled = scheduledRes.ok ? (await scheduledRes.json()).items || [] : [];
      const posted = postedRes.ok ? (await postedRes.json()).items || [] : [];

      setPosts([...scheduled, ...posted]);
    } catch {
      toast.error("Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // ─── FILTER POSTS ─────────────────────────────────────────────────────────

  const filteredPosts = posts.filter((p) =>
    platformFilter === "all" ? true : p.platform === platformFilter
  );

  // ─── DRAG AND DROP ────────────────────────────────────────────────────────

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActivePost(null);

    if (!over || !active) return;

    const postId = active.id as number;
    const dropTarget = over.id as string; // format: "slot-2024-03-10-14"

    const parts = dropTarget.split("-");
    if (parts[0] !== "slot" || parts.length < 5) return;

    const dateStr = `${parts[1]}-${parts[2]}-${parts[3]}`;
    const hour = parseInt(parts[4]);

    const newTime = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00`);

    try {
      const res = await fetch("/api/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: postId,
          scheduledTime: newTime.toISOString(),
        }),
      });

      if (res.ok) {
        toast.success("Post rescheduled!");
        fetchPosts();
      } else {
        toast.error("Failed to reschedule");
      }
    } catch {
      toast.error("Failed to reschedule");
    }
  }

  function handleDragStart(event: { active: { id: string | number } }) {
    const post = filteredPosts.find((p) => p.id === event.active.id);
    setActivePost(post || null);
  }

  // ─── NAVIGATION ───────────────────────────────────────────────────────────

  function navigate(direction: number) {
    const d = new Date(currentDate);
    if (view === "week") {
      d.setDate(d.getDate() + direction * 7);
    } else {
      d.setMonth(d.getMonth() + direction);
    }
    setCurrentDate(d);
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-zinc-200" />
            Scheduling Calendar
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Drag posts to reschedule. AI highlights optimal posting slots.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-zinc-800/50 rounded-lg p-0.5">
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                view === "week"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView("month")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                view === "month"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500"
              }`}
            >
              Month
            </button>
          </div>

          {/* Platform filter */}
          <div className="flex bg-zinc-800/50 rounded-lg p-0.5">
            {["all", "twitter", "linkedin", "instagram", "facebook"].map((p) => (
              <button
                key={p}
                onClick={() => setPlatformFilter(p)}
                className={`px-2 py-1.5 rounded-md text-xs transition-all ${
                  platformFilter === p
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-500"
                }`}
              >
                {p === "all" ? "All" : PLATFORM_ICONS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-zinc-700"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-xs"
            onClick={goToToday}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-zinc-700"
            onClick={() => navigate(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h2 className="text-lg font-semibold text-zinc-200">
          {view === "week"
            ? `${weekDays[0].toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
              })} — ${weekDays[6].toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}`
            : currentDate.toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })}
        </h2>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      ) : view === "week" ? (
        <DndContext
          sensors={sensors}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
        >
          <WeekView
            days={weekDays}
            posts={filteredPosts}
            hours={HOURS}
          />
          <DragOverlay>
            {activePost && <DragOverlayCard post={activePost} />}
          </DragOverlay>
        </DndContext>
      ) : (
        <MonthView
          currentDate={currentDate}
          posts={filteredPosts}
        />
      )}
    </div>
  );
}

// ─── WEEK VIEW ───────────────────────────────────────────────────────────────

function WeekView({
  days,
  posts,
  hours,
}: {
  days: Date[];
  posts: CalendarPost[];
  hours: number[];
}) {
  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-zinc-900">
        <div className="p-2 border-r border-zinc-800" />
        {days.map((day, i) => {
          const isToday =
            day.toDateString() === new Date().toDateString();
          return (
            <div
              key={i}
              className={`p-2 text-center border-r border-zinc-800 last:border-r-0 ${
                isToday ? "bg-zinc-500/10" : ""
              }`}
            >
              <p className="text-[10px] text-zinc-500 uppercase">
                {DAY_NAMES[i]}
              </p>
              <p
                className={`text-sm font-semibold ${
                  isToday ? "text-zinc-400" : "text-zinc-300"
                }`}
              >
                {day.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Time slots */}
      <div className="max-h-[600px] overflow-y-auto">
        {hours.map((hour) => (
          <div
            key={hour}
            className="grid grid-cols-[60px_repeat(7,1fr)] border-t border-zinc-800/50"
          >
            {/* Hour label */}
            <div className="p-2 text-[10px] text-zinc-600 text-right pr-3 border-r border-zinc-800">
              {hour}:00
            </div>

            {/* Day slots */}
            {days.map((day, dayIdx) => {
              const dateStr = day.toISOString().split("T")[0];
              const slotId = `slot-${dateStr}-${hour}`;

              // Find posts in this slot
              const slotPosts = posts.filter((p) => {
                const pDate = new Date(p.scheduledTime);
                return (
                  pDate.toISOString().split("T")[0] === dateStr &&
                  pDate.getHours() === hour
                );
              });

              return (
                <DroppableSlot key={slotId} id={slotId}>
                  {slotPosts.map((post) => (
                    <DraggablePost key={post.id} post={post} />
                  ))}
                </DroppableSlot>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MONTH VIEW ──────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  posts,
}: {
  currentDate: Date;
  posts: CalendarPost[];
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0

  const totalDays = lastDay.getDate();
  const weeks = Math.ceil((totalDays + startOffset) / 7);

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 bg-zinc-900">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="p-2 text-center text-[10px] text-zinc-500 uppercase border-r border-zinc-800 last:border-r-0"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Days grid */}
      {Array.from({ length: weeks }, (_, week) => (
        <div key={week} className="grid grid-cols-7 border-t border-zinc-800/50">
          {Array.from({ length: 7 }, (_, dayIdx) => {
            const dayNum = week * 7 + dayIdx - startOffset + 1;
            const isValid = dayNum >= 1 && dayNum <= totalDays;
            const date = isValid ? new Date(year, month, dayNum) : null;
            const isToday =
              date?.toDateString() === new Date().toDateString();

            const dayPosts = date
              ? posts.filter(
                  (p) =>
                    new Date(p.scheduledTime).toDateString() ===
                    date.toDateString()
                )
              : [];

            return (
              <div
                key={dayIdx}
                className={`min-h-[80px] p-1.5 border-r border-zinc-800 last:border-r-0 ${
                  isToday ? "bg-zinc-500/5" : ""
                } ${!isValid ? "bg-zinc-900/30" : ""}`}
              >
                {isValid && (
                  <>
                    <span
                      className={`text-xs font-medium ${
                        isToday ? "text-zinc-400" : "text-zinc-400"
                      }`}
                    >
                      {dayNum}
                    </span>
                    {dayPosts.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {dayPosts.slice(0, 3).map((post) => (
                          <div
                            key={post.id}
                            className="flex items-center gap-1"
                          >
                            <div
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                PLATFORM_COLORS[post.platform] || "bg-zinc-500"
                              }`}
                            />
                            <span className="text-[9px] text-zinc-500 truncate">
                              {new Date(post.scheduledTime).toLocaleTimeString(
                                "en-IN",
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                            </span>
                          </div>
                        ))}
                        {dayPosts.length > 3 && (
                          <span className="text-[9px] text-zinc-600">
                            +{dayPosts.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── DRAG & DROP COMPONENTS ──────────────────────────────────────────────────

function DroppableSlot({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[48px] p-1 border-r border-zinc-800 last:border-r-0 transition-colors ${
        isOver ? "bg-zinc-500/10" : ""
      }`}
    >
      {children}
    </div>
  );
}

function DraggablePost({ post }: { post: CalendarPost }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: post.id });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const statusColor =
    post.status === "posted"
      ? "border-l-green-500"
      : post.status === "failed"
      ? "border-l-red-500"
      : "border-l-blue-500";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-md border-l-2 ${statusColor} bg-zinc-800 px-1.5 py-1 mb-1 cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-1">
        <div
          className={`h-2 w-2 rounded-full shrink-0 ${
            PLATFORM_COLORS[post.platform] || "bg-zinc-500"
          }`}
        />
        <span className="text-[9px] text-zinc-300 truncate">
          {post.text.slice(0, 30)}
        </span>
      </div>
    </div>
  );
}

function DragOverlayCard({ post }: { post: CalendarPost }) {
  return (
    <div className="rounded-lg border border-zinc-500 bg-zinc-800 px-3 py-2 shadow-lg shadow-zinc-500/20 max-w-[200px]">
      <div className="flex items-center gap-1.5 mb-1">
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            PLATFORM_COLORS[post.platform] || "bg-zinc-500"
          }`}
        />
        <span className="text-[10px] text-zinc-400 capitalize">
          {post.platform}
        </span>
      </div>
      <p className="text-xs text-zinc-200 line-clamp-2">{post.text}</p>
    </div>
  );
}
