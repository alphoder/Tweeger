"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarClock,
  Loader2,
  Sparkles,
  List,
  CalendarDays,
  CheckCircle2,
  Send,
  Trash2,
  RefreshCw,
  XCircle,
  Edit3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePuterAI } from "@/hooks/use-puter-ai";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface CalendarItem {
  date: string;
  time: string;
  platform: string;
  text: string;
  contentType: string;
  hashtags: string[];
  targetIndustry?: string;
  imagePrompt?: string;
  status: string;
  aiScore?: number;
}

interface ContentCalendar {
  id: number;
  name: string;
  weeks: number;
  platforms: string[];
  targetIndustries: string[];
  items: CalendarItem[];
  createdAt: string;
}

const PLATFORMS = ["twitter", "linkedin", "instagram", "facebook"];
const INDUSTRIES = [
  "restaurants",
  "hotels",
  "hospitals",
  "real_estate",
  "education",
  "startups",
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function PlannerPage() {
  const { chat } = usePuterAI();
  const [calendars, setCalendars] = useState<ContentCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // Generation controls
  const [weeks, setWeeks] = useState(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    "twitter",
  ]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);

  // Active calendar
  const [activeCalendar, setActiveCalendar] = useState<ContentCalendar | null>(
    null
  );

  // ─── FETCH ─────────────────────────────────────────────────────────────────

  const fetchCalendars = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketing/planner");
      if (res.ok) {
        const data = await res.json();
        setCalendars(data.calendars || []);
        if (data.calendars?.length > 0 && !activeCalendar) {
          setActiveCalendar(data.calendars[0]);
        }
      }
    } catch {
      toast.error("Failed to load calendars");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  // ─── GENERATE CALENDAR ─────────────────────────────────────────────────────

  async function handleGenerate() {
    if (selectedPlatforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }

    setGenerating(true);
    try {
      const totalDays = weeks * 7;
      const postsPerDay = selectedPlatforms.length;

      const prompt = `You are FineTweet's Manager Bot. Generate a ${weeks}-week content calendar.

Platforms: ${selectedPlatforms.join(", ")}
Industries to rotate: ${selectedIndustries.length > 0 ? selectedIndustries.join(", ") : "general"}
Content Mix: Case Studies 40%, Thought Leadership 30%, Trends 30%
Posts per day: ${postsPerDay} (one per platform)

Generate ${totalDays * postsPerDay} posts total. Return a JSON array where each item has:
- date: string (YYYY-MM-DD format, starting from tomorrow)
- time: string (HH:MM in IST, optimal posting time)
- platform: string
- text: string (platform-native content)
- contentType: string (text_only, image, carousel, or thread)
- hashtags: string[] (3-5)
- targetIndustry: string (rotate across industries)
- status: "pending"
- aiScore: number (1-10)

Make content diverse:
- Monday: motivational/industry insights
- Tuesday-Thursday: case studies, tips, how-tos
- Friday: trend commentary, fun content
- Weekend: lighter content, community engagement

Return ONLY the JSON array.`;

      const response = await chat(prompt, { model: "Gemini Flash" });
      let items: CalendarItem[] = [];

      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          items = JSON.parse(jsonMatch[0]);
        }
      } catch {
        toast.error("Failed to parse calendar");
        setGenerating(false);
        return;
      }

      // Save to DB
      const res = await fetch("/api/marketing/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeks,
          platforms: selectedPlatforms,
          targetIndustries: selectedIndustries,
          items,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Generated ${items.length} content items!`);
        setActiveCalendar(data.calendar);
        fetchCalendars();
      }
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  // ─── ITEM ACTIONS ──────────────────────────────────────────────────────────

  async function updateItemStatus(
    itemIndex: number,
    status: string
  ) {
    if (!activeCalendar) return;

    const updatedItems = [...activeCalendar.items];
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], status };

    try {
      const res = await fetch("/api/marketing/planner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeCalendar.id,
          items: updatedItems,
        }),
      });

      if (res.ok) {
        setActiveCalendar({ ...activeCalendar, items: updatedItems });
      }
    } catch {
      toast.error("Failed to update");
    }
  }

  async function queueApproved() {
    if (!activeCalendar) return;

    const approved = activeCalendar.items.filter(
      (i) => i.status === "approved"
    );
    if (approved.length === 0) {
      toast.error("No approved items to queue");
      return;
    }

    let queued = 0;
    for (const item of approved) {
      try {
        const res = await fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: item.text,
            platform: item.platform,
            source: "campaign",
            targetIndustry: item.targetIndustry || null,
            hashtags: item.hashtags,
          }),
        });
        if (res.ok) queued++;
      } catch {
        // continue
      }
    }

    toast.success(`Queued ${queued} items as drafts`);
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  const items = activeCalendar?.items || [];
  const approvedCount = items.filter((i) => i.status === "approved").length;
  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-zinc-200" />
            Content Planner
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            AI-generated content calendars across platforms
          </p>
        </div>
        <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              viewMode === "list"
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500"
            }`}
          >
            <List className="h-3 w-3 inline mr-1" />
            List
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              viewMode === "calendar"
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500"
            }`}
          >
            <CalendarDays className="h-3 w-3 inline mr-1" />
            Calendar
          </button>
        </div>
      </div>

      {/* Generation Controls */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">
                Weeks
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    onClick={() => setWeeks(w)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium ${
                      weeks === w
                        ? "bg-zinc-600/20 text-zinc-200"
                        : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                    }`}
                  >
                    {w}w
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">
                Platforms
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      setSelectedPlatforms((prev) =>
                        prev.includes(p)
                          ? prev.filter((x) => x !== p)
                          : [...prev, p]
                      )
                    }
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium ${
                      selectedPlatforms.includes(p)
                        ? "bg-zinc-600/20 text-zinc-200"
                        : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">
                Industries
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind}
                    onClick={() =>
                      setSelectedIndustries((prev) =>
                        prev.includes(ind)
                          ? prev.filter((x) => x !== ind)
                          : [...prev, ind]
                      )
                    }
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium ${
                      selectedIndustries.includes(ind)
                        ? "bg-zinc-600/20 text-zinc-200"
                        : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                    }`}
                  >
                    {ind.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-white text-black hover:bg-zinc-200 hover:opacity-90"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {generating ? "Generating Calendar..." : "Generate Calendar"}
          </Button>
        </CardContent>
      </Card>

      {/* Content mix badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400">
          Case Studies 40%
        </Badge>
        <Badge className="text-[10px] bg-zinc-500/20 text-zinc-400">
          Thought Leadership 30%
        </Badge>
        <Badge className="text-[10px] bg-zinc-600/20 text-zinc-200">
          Trends 30%
        </Badge>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      ) : activeCalendar && items.length > 0 ? (
        <div className="space-y-4">
          {/* Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex gap-3 text-xs text-zinc-500">
              <span>{items.length} items</span>
              <span className="text-emerald-400">
                {approvedCount} approved
              </span>
              <span>{pendingCount} pending</span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  items.forEach((_, i) => {
                    if (items[i].status === "pending") {
                      updateItemStatus(i, "approved");
                    }
                  });
                  toast.success("All pending items approved");
                }}
                size="sm"
                variant="outline"
                className="h-7 text-xs border-zinc-700 text-zinc-300"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Approve All
              </Button>
              <Button
                onClick={queueApproved}
                size="sm"
                className="h-7 text-xs bg-zinc-600/20 text-zinc-200 hover:bg-zinc-600/30"
              >
                <Send className="h-3 w-3 mr-1" />
                Queue Approved ({approvedCount})
              </Button>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium">
                    Date
                  </th>
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium">
                    Platform
                  </th>
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium">
                    Content
                  </th>
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium">
                    Industry
                  </th>
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium">
                    Score
                  </th>
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium">
                    Status
                  </th>
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={i}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                  >
                    <td className="py-2 px-2 text-zinc-400 whitespace-nowrap">
                      {item.date} {item.time}
                    </td>
                    <td className="py-2 px-2">
                      <Badge className="text-[9px] bg-zinc-700 text-zinc-300">
                        {item.platform}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-zinc-300 max-w-xs">
                      <p className="line-clamp-2">{item.text}</p>
                    </td>
                    <td className="py-2 px-2 text-zinc-500">
                      {item.targetIndustry || "—"}
                    </td>
                    <td className="py-2 px-2">
                      {item.aiScore && (
                        <span className="text-zinc-400">
                          {item.aiScore}/10
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <Badge
                        className={`text-[8px] ${
                          item.status === "approved"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : item.status === "rejected"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-zinc-700 text-zinc-400"
                        }`}
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex gap-1">
                        {item.status === "pending" && (
                          <button
                            onClick={() => updateItemStatus(i, "approved")}
                            className="p-1 text-emerald-400 hover:text-emerald-300"
                            title="Approve"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {item.status === "pending" && (
                          <button
                            onClick={() => updateItemStatus(i, "rejected")}
                            className="p-1 text-red-400 hover:text-red-300"
                            title="Reject"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-zinc-600">
          <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No content calendars</p>
          <p className="text-xs mt-1">
            Generate your first AI content calendar above
          </p>
        </div>
      )}
    </div>
  );
}
