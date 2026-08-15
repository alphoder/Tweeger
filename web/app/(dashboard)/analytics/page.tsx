"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Users,
  TrendingUp,
  Eye,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ROIDashboard } from "@/components/roi-dashboard";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const PLATFORM_FILTERS = [
  { key: "all", label: "All Platforms" },
  { key: "twitter", label: "Twitter" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
];

const TIME_RANGES = [
  { key: 7, label: "7d" },
  { key: 30, label: "30d" },
  { key: 90, label: "90d" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [platform, setPlatform] = useState("all");
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  // Data states
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [growthData, setGrowthData] = useState<unknown[]>([]);
  const [heatmapData, setHeatmapData] = useState<
    { dow: number; hour: number; avgEngagement: number; postCount: number }[]
  >([]);
  const [postingTimes, setPostingTimes] = useState<unknown[]>([]);
  const [topPosts, setTopPosts] = useState<Record<string, unknown>[]>([]);

  // ─── FETCH DATA ───────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, grRes, hmRes, ptRes, wrRes] = await Promise.all([
        fetch("/api/analytics?type=overview"),
        fetch(`/api/analytics?type=growth&days=${days}&platform=${platform}`),
        fetch(`/api/analytics?type=heatmap&platform=${platform}`),
        fetch(`/api/analytics?type=posting_times&platform=${platform}`),
        fetch("/api/analytics?type=weekly_report"),
      ]);

      if (ovRes.ok) setOverview(await ovRes.json());
      if (grRes.ok) {
        const gr = await grRes.json();
        setGrowthData(gr.data || []);
      }
      if (hmRes.ok) {
        const hm = await hmRes.json();
        setHeatmapData(hm.data || []);
      }
      if (ptRes.ok) {
        const pt = await ptRes.json();
        setPostingTimes(pt.hourlyData || []);
      }
      if (wrRes.ok) {
        const wr = await wrRes.json();
        setTopPosts(wr.topPosts || []);
      }
    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [platform, days]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── HEATMAP HELPERS ──────────────────────────────────────────────────────

  const heatmapMax = Math.max(
    ...heatmapData.map((d) => Number(d.avgEngagement) || 0),
    0.001
  );

  function getHeatmapColor(value: number): string {
    const ratio = value / heatmapMax;
    if (ratio === 0) return "bg-zinc-800/50";
    if (ratio < 0.25) return "bg-zinc-700";
    if (ratio < 0.5) return "bg-zinc-900/60";
    if (ratio < 0.75) return "bg-zinc-700/60";
    return "bg-emerald-500/60";
  }

  function getHeatmapValue(dow: number, hour: number): { avg: number; count: number } {
    const cell = heatmapData.find(
      (d) => Number(d.dow) === dow && Number(d.hour) === hour
    );
    return {
      avg: Number(cell?.avgEngagement || 0),
      count: Number(cell?.postCount || 0),
    };
  }

  // ─── OVERVIEW STATS ───────────────────────────────────────────────────────

  const snapshots = (overview as Record<string, unknown[]>)?.snapshots || [];
  const totalFollowers = (snapshots as Record<string, number>[]).reduce(
    (s: number, snap: Record<string, number>) => s + (snap.followers || 0),
    0
  );

  // ─── RENDER ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-emerald-400" />
          Analytics
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Performance metrics, engagement heatmaps, and growth trends
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {PLATFORM_FILTERS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPlatform(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                platform === p.key
                  ? "bg-zinc-700 text-zinc-100"
                  : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-0.5">
          {TIME_RANGES.map((t) => (
            <button
              key={t.key}
              onClick={() => setDays(t.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium ${
                days === t.key
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Followers"
          value={totalFollowers.toLocaleString()}
          icon={Users}
          color="text-zinc-400"
        />
        <StatCard
          label="Posts This Week"
          value={String(topPosts.length || 0)}
          icon={TrendingUp}
          color="text-emerald-400"
        />
        <StatCard
          label="Avg Engagement"
          value="—"
          icon={BarChart3}
          color="text-amber-400"
        />
        <StatCard
          label="Total Reach"
          value="—"
          icon={Eye}
          color="text-amber-400"
        />
      </div>

      {/* Growth Chart */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Follower Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(growthData as Record<string, unknown>[]).length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={growthData as Record<string, unknown>[]}>
                <defs>
                  <linearGradient id="fillFollowers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="recordedAt"
                  stroke="#52525b"
                  fontSize={10}
                  tickFormatter={(v: string) =>
                    new Date(v).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                  }
                />
                <YAxis stroke="#52525b" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="followers"
                  stroke="#06b6d4"
                  fill="url(#fillFollowers)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No growth data yet" />
          )}
        </CardContent>
      </Card>

      {/* Best Posting Times */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Best Posting Times
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(postingTimes as Record<string, unknown>[]).length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={postingTimes as Record<string, unknown>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="hour"
                  stroke="#52525b"
                  fontSize={10}
                  tickFormatter={(v: number) => `${v}:00`}
                />
                <YAxis stroke="#52525b" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="avgEngagement"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  name="Avg Engagement"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Post more to see timing analysis" />
          )}
        </CardContent>
      </Card>

      {/* Engagement Heatmap */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Engagement Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex gap-0.5 mb-1 ml-10">
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="w-5 text-[8px] text-zinc-600 text-center"
                  >
                    {h % 3 === 0 ? `${h}` : ""}
                  </div>
                ))}
              </div>

              {/* Rows (days) */}
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
                <div key={dow} className="flex items-center gap-0.5 mb-0.5">
                  <span className="text-[9px] text-zinc-500 w-10 text-right pr-2">
                    {DAY_LABELS[dow]}
                  </span>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const { avg: avgVal, count: countVal } = getHeatmapValue(dow, hour);
                    return (
                      <div
                        key={hour}
                        className={`w-5 h-5 rounded-sm ${getHeatmapColor(avgVal)} transition-colors cursor-default`}
                        title={`${DAY_LABELS[dow]} ${hour}:00 — ${(avgVal * 100).toFixed(1)}% eng (${countVal} posts)`}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center gap-2 mt-3 ml-10">
                <span className="text-[9px] text-zinc-600">Low</span>
                <div className="flex gap-0.5">
                  <div className="w-4 h-3 rounded-sm bg-zinc-800/50" />
                  <div className="w-4 h-3 rounded-sm bg-zinc-700" />
                  <div className="w-4 h-3 rounded-sm bg-zinc-900/60" />
                  <div className="w-4 h-3 rounded-sm bg-zinc-700/60" />
                  <div className="w-4 h-3 rounded-sm bg-emerald-500/60" />
                </div>
                <span className="text-[9px] text-zinc-600">High</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Performance ROI */}
      <ROIDashboard />

      {/* Top Posts */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Top Performing Posts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {topPosts.length > 0 ? (
            topPosts.slice(0, 5).map((post, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg bg-zinc-800/50 p-3"
              >
                <div className="text-lg font-bold text-zinc-600 w-6 text-center shrink-0">
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="text-[9px] bg-zinc-700 text-zinc-300">
                      {String(post.platform)}
                    </Badge>
                    {post.engagementRate != null && (
                      <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400">
                        {(Number(post.engagementRate) * 100).toFixed(1)}% ER
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-300 line-clamp-2">
                    {String(post.text)}
                  </p>
                  <div className="flex gap-3 mt-1.5 text-[10px] text-zinc-500">
                    <span>❤️ {String(post.likes || 0)}</span>
                    <span>🔁 {String(post.shares || 0)}</span>
                    <span>💬 {String(post.comments || 0)}</span>
                    <span>👁 {String(post.impressions || 0)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyChart message="No posts yet" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── HELPER COMPONENTS ───────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  change,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  change?: number;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Icon className={`h-4 w-4 ${color}`} />
          {change !== undefined && (
            <span
              className={`text-[10px] flex items-center ${
                change >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {change >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(change)}%
            </span>
          )}
        </div>
        <p className="text-xl font-bold text-zinc-100 mt-2">{value}</p>
        <p className="text-xs text-zinc-500 mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-zinc-600">
      <p className="text-sm">{message}</p>
    </div>
  );
}
