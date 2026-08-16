"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays,
  Loader2,
  Plus,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Zap,
  Download,
  Tag,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; dotColor: string }
> = {
  industry: { label: "Industry", color: "text-blue-400", dotColor: "bg-blue-400" },
  sale: { label: "Sale", color: "text-emerald-400", dotColor: "bg-emerald-400" },
  product_launch: { label: "Launch", color: "text-zinc-200", dotColor: "bg-zinc-600" },
  cultural: { label: "Cultural", color: "text-zinc-200", dotColor: "bg-zinc-600" },
  webinar: { label: "Webinar", color: "text-zinc-400", dotColor: "bg-zinc-400" },
  conference: { label: "Conference", color: "text-zinc-200", dotColor: "bg-zinc-600" },
};

const CATEGORY_FILTERS = [
  { key: "all", label: "All" },
  { key: "industry", label: "Industry" },
  { key: "conference", label: "Conference" },
  { key: "cultural", label: "Cultural" },
  { key: "sale", label: "Sale" },
  { key: "webinar", label: "Webinar" },
  { key: "product_launch", label: "Launch" },
];

const INDUSTRIES = [
  "restaurants",
  "hotels",
  "hospitals",
  "real_estate",
  "education",
  "startups",
  "saas",
  "food_tech",
  "healthcare",
];

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface EventItem {
  id: number;
  name: string;
  eventDate: string;
  category: string;
  description: string;
  targetIndustries: string[];
  contentIdeas: string[];
  contentGenerated: boolean;
  platforms: string[];
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formCategory, setFormCategory] = useState("industry");
  const [formDescription, setFormDescription] = useState("");
  const [formIndustries, setFormIndustries] = useState<string[]>([]);

  // ─── FETCH EVENTS ──────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: "365" });
      if (categoryFilter !== "all") params.set("category", categoryFilter);

      const res = await fetch(`/api/events?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ─── LOAD DEFAULTS ─────────────────────────────────────────────────────────

  async function handleLoadDefaults() {
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "load_defaults" }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Loaded ${data.inserted} default events`);
        fetchEvents();
      } else {
        toast.error("Failed to load defaults");
      }
    } catch {
      toast.error("Failed to load defaults");
    }
  }

  // ─── ADD EVENT ─────────────────────────────────────────────────────────────

  async function handleAddEvent() {
    if (!formName || !formDate || !formCategory) {
      toast.error("Name, date, and category are required");
      return;
    }

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          eventDate: new Date(formDate).toISOString(),
          category: formCategory,
          description: formDescription,
          targetIndustries: formIndustries,
        }),
      });

      if (res.ok) {
        toast.success("Event created!");
        setShowAddDialog(false);
        setFormName("");
        setFormDate("");
        setFormDescription("");
        setFormIndustries([]);
        fetchEvents();
      }
    } catch {
      toast.error("Failed to create event");
    }
  }

  // ─── DELETE EVENT ──────────────────────────────────────────────────────────

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/events?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Event deleted");
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      toast.error("Failed to delete event");
    }
  }

  // ─── CALENDAR HELPERS ──────────────────────────────────────────────────────

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  function getEventsForDay(day: number): EventItem[] {
    return events.filter((e) => {
      const d = new Date(e.eventDate);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  function prevMonth() {
    setCurrentMonth(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1));
  }

  // Upcoming events (next 15)
  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.eventDate) >= now)
    .sort(
      (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    )
    .slice(0, 15);

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-zinc-200" />
            Events
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Cultural events, conferences, and content opportunities
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleLoadDefaults}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <Download className="h-4 w-4 mr-2" />
            Load Defaults
          </Button>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-white text-black hover:bg-zinc-200 hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategoryFilter(c.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              categoryFilter === c.key
                ? "bg-zinc-700 text-zinc-100"
                : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={prevMonth}
                    className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <CardTitle className="text-sm font-semibold">
                    {currentMonth.toLocaleDateString("en-IN", {
                      month: "long",
                      year: "numeric",
                    })}
                  </CardTitle>
                  <button
                    onClick={nextMonth}
                    className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (d) => (
                      <div
                        key={d}
                        className="text-center text-[10px] text-zinc-600 font-medium py-1"
                      >
                        {d}
                      </div>
                    )
                  )}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells before first day */}
                  {Array.from({ length: firstDay }, (_, i) => (
                    <div key={`empty-${i}`} className="h-16" />
                  ))}

                  {/* Day cells */}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dayEvents = getEventsForDay(day);
                    const isToday =
                      today.getFullYear() === year &&
                      today.getMonth() === month &&
                      today.getDate() === day;

                    return (
                      <div
                        key={day}
                        className={`h-16 rounded-lg p-1 text-xs transition-colors ${
                          isToday
                            ? "bg-zinc-700/50 ring-1 ring-zinc-600/50"
                            : dayEvents.length > 0
                            ? "bg-zinc-800/50"
                            : "bg-zinc-900/30"
                        }`}
                      >
                        <span
                          className={`text-[10px] font-medium ${
                            isToday ? "text-zinc-200" : "text-zinc-400"
                          }`}
                        >
                          {day}
                        </span>
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {dayEvents.slice(0, 3).map((e) => {
                            const cat =
                              CATEGORY_CONFIG[e.category] ||
                              CATEGORY_CONFIG.industry;
                            return (
                              <div
                                key={e.id}
                                className={`w-1.5 h-1.5 rounded-full ${cat.dotColor}`}
                                title={e.name}
                              />
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <span className="text-[7px] text-zinc-500">
                              +{dayEvents.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-1">
                      <div
                        className={`w-2 h-2 rounded-full ${config.dotColor}`}
                      />
                      <span className="text-[9px] text-zinc-500">
                        {config.label}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Events Sidebar */}
          <div>
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-zinc-200" />
                  Upcoming Events
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                {upcoming.length > 0 ? (
                  upcoming.map((evt) => {
                    const cat =
                      CATEGORY_CONFIG[evt.category] ||
                      CATEGORY_CONFIG.industry;
                    const evtDate = new Date(evt.eventDate);
                    const daysUntil = Math.ceil(
                      (evtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                    );

                    return (
                      <div
                        key={evt.id}
                        className="rounded-lg bg-zinc-800/50 p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                className={`text-[9px] ${cat.color} bg-zinc-700/50`}
                              >
                                {cat.label}
                              </Badge>
                              {daysUntil <= 7 && (
                                <Badge className="text-[9px] bg-red-500/20 text-red-400">
                                  {daysUntil === 0
                                    ? "Today!"
                                    : daysUntil === 1
                                    ? "Tomorrow"
                                    : `${daysUntil}d away`}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium text-zinc-200">
                              {evt.name}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                              {evtDate.toLocaleDateString("en-IN", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDelete(evt.id)}
                            className="text-zinc-600 hover:text-zinc-400 p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>

                        {evt.description && (
                          <p className="text-[10px] text-zinc-500">
                            {evt.description}
                          </p>
                        )}

                        {evt.targetIndustries &&
                          evt.targetIndustries.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {evt.targetIndustries.map((ind) => (
                                <Badge
                                  key={ind}
                                  className="text-[8px] bg-zinc-700/50 text-zinc-400"
                                >
                                  {ind}
                                </Badge>
                              ))}
                            </div>
                          )}

                        {evt.contentIdeas &&
                          evt.contentIdeas.length > 0 && (
                            <div className="pt-1 border-t border-zinc-800">
                              <p className="text-[9px] text-zinc-500 mb-1 flex items-center gap-1">
                                <Sparkles className="h-2.5 w-2.5" />
                                Content Ideas
                              </p>
                              {evt.contentIdeas.slice(0, 2).map((idea, i) => (
                                <p
                                  key={i}
                                  className="text-[10px] text-zinc-400"
                                >
                                  &bull; {idea}
                                </p>
                              ))}
                            </div>
                          )}

                        <a
                          href="/content"
                          className="inline-flex items-center justify-center w-full rounded-md text-[10px] font-medium py-1.5 bg-zinc-600/20 text-zinc-200 hover:bg-zinc-600/30 transition-colors"
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          Generate Content
                        </a>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-zinc-600">
                    <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No upcoming events</p>
                    <p className="text-[10px] mt-1">
                      Click &quot;Load Defaults&quot; to add Indian events
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Add Event Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plus className="h-5 w-5 text-zinc-200" />
                Add Custom Event
              </h2>
              <button
                onClick={() => setShowAddDialog(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                Event Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Summer Product Launch"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600/50"
              />
            </div>

            {/* Date */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600/50"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                Category
              </label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setFormCategory(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      formCategory === key
                        ? `bg-zinc-700 ${config.color}`
                        : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800"
                    }`}
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                Description
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of the event..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600/50"
              />
            </div>

            {/* Target Industries */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 flex items-center gap-1 block">
                <Tag className="h-3 w-3" />
                Target Industries
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind}
                    onClick={() =>
                      setFormIndustries((prev) =>
                        prev.includes(ind)
                          ? prev.filter((i) => i !== ind)
                          : [...prev, ind]
                      )
                    }
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                      formIndustries.includes(ind)
                        ? "bg-zinc-600/20 text-zinc-200"
                        : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800"
                    }`}
                  >
                    {ind.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => setShowAddDialog(false)}
                variant="outline"
                className="flex-1 border-zinc-700 text-zinc-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddEvent}
                className="flex-1 bg-white text-black hover:bg-zinc-200 hover:opacity-90"
              >
                Create Event
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
