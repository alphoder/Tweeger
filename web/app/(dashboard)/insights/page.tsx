"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Loader2,
  Sparkles,
  Clock,
  Target,
  TrendingUp,
  BarChart3,
  Users,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Lightbulb,
  Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const INSIGHT_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  timing: {
    label: "Timing",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    icon: Clock,
  },
  content: {
    label: "Content",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    icon: BarChart3,
  },
  audience: {
    label: "Audience",
    color: "text-zinc-200",
    bgColor: "bg-zinc-600/20",
    icon: Users,
  },
  trend: {
    label: "Trend",
    color: "text-zinc-200",
    bgColor: "bg-zinc-600/20",
    icon: TrendingUp,
  },
  performance: {
    label: "Performance",
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/20",
    icon: Target,
  },
  competitor: {
    label: "Competitor",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    icon: Eye,
  },
};

const TYPE_FILTERS = [
  { key: "all", label: "All" },
  { key: "timing", label: "Timing" },
  { key: "content", label: "Content" },
  { key: "audience", label: "Audience" },
  { key: "trend", label: "Trend" },
  { key: "performance", label: "Performance" },
];

const PLATFORM_FILTERS = [
  { key: "all", label: "All Platforms" },
  { key: "twitter", label: "Twitter" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
];

const SORT_OPTIONS = [
  { key: "confidence", label: "Confidence" },
  { key: "recent", label: "Most Recent" },
  { key: "impact", label: "Impact Score" },
];

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface ProfileAnalysis {
  overallScore: number;
  headline: string;
  summary: string;
  topPriorities: string[];
  analyzedAt: string;
  sections: {
    agent: string;
    designation: string;
    emoji: string;
    title: string;
    content: string;
  }[];
}

interface Insight {
  id: number;
  type: string;
  platform: string | null;
  insight: string;
  data: Record<string, unknown>;
  confidence: number;
  applied: boolean;
  impactScore: number | null;
  createdAt: string;
  expiresAt: string | null;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortBy, setSortBy] = useState("confidence");
  const [showApplied, setShowApplied] = useState<"all" | "applied" | "pending">(
    "all"
  );

  // ─── FETCH INSIGHTS ────────────────────────────────────────────────────────

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (platformFilter !== "all") params.set("platform", platformFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/insights?${params}`);
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || []);
      }
    } catch {
      toast.error("Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, platformFilter]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // ─── RETRAIN ───────────────────────────────────────────────────────────────

  async function handleRetrain() {
    setRetraining(true);
    try {
      const res = await fetch("/api/insights/retrain", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Generated ${data.insightsGenerated} new insights`);
        fetchInsights();
      } else {
        toast.error("Retrain failed");
      }
    } catch {
      toast.error("Retrain failed");
    } finally {
      setRetraining(false);
    }
  }

  // ─── ANALYZE PROFILE ──────────────────────────────────────────────────────

  async function handleAnalyze() {
    setAnalyzing(true);
    toast.info("The team is auditing your profile — this takes a minute...");
    try {
      const res = await fetch("/api/analyze", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setAnalysis(data);
        toast.success("Profile analysis complete");
        fetchInsights();
      } else {
        toast.error(data.error || "Analysis failed");
      }
    } catch {
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  // ─── APPLY INSIGHT ─────────────────────────────────────────────────────────

  async function handleApply(id: number) {
    try {
      const res = await fetch("/api/insights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, applied: true }),
      });
      if (res.ok) {
        toast.success("Insight marked as applied");
        setInsights((prev) =>
          prev.map((i) => (i.id === id ? { ...i, applied: true } : i))
        );
      }
    } catch {
      toast.error("Failed to apply insight");
    }
  }

  // ─── DISMISS INSIGHT ───────────────────────────────────────────────────────

  async function handleDismiss(id: number) {
    try {
      const res = await fetch(`/api/insights?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Insight dismissed");
        setInsights((prev) => prev.filter((i) => i.id !== id));
      }
    } catch {
      toast.error("Failed to dismiss");
    }
  }

  // ─── SORT & FILTER ─────────────────────────────────────────────────────────

  const filtered = insights
    .filter((i) => {
      if (showApplied === "applied") return i.applied;
      if (showApplied === "pending") return !i.applied;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "confidence") return b.confidence - a.confidence;
      if (sortBy === "impact")
        return (b.impactScore || 0) - (a.impactScore || 0);
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

  // ─── STATS ─────────────────────────────────────────────────────────────────

  const totalInsights = insights.length;
  const avgConfidence =
    insights.length > 0
      ? insights.reduce((s, i) => s + i.confidence, 0) / insights.length
      : 0;
  const appliedCount = insights.filter((i) => i.applied).length;
  const withImpact = insights.filter((i) => i.impactScore !== null);
  const avgImpact =
    withImpact.length > 0
      ? withImpact.reduce((s, i) => s + (i.impactScore || 0), 0) /
        withImpact.length
      : 0;

  // ─── RECOMMENDATIONS ──────────────────────────────────────────────────────

  const recommendations = filtered
    .filter((i) => i.confidence >= 0.6 && !i.applied)
    .slice(0, 5);

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-zinc-200" />
            AI Insights
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Self-learning engine — gets smarter with every post
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRetrain}
            disabled={retraining}
            variant="outline"
            className="border-zinc-700"
          >
            {retraining ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {retraining ? "Retraining..." : "Retrain"}
          </Button>
          <Button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="bg-white text-black font-semibold hover:bg-zinc-200 "
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            {analyzing ? "Team is auditing..." : "Analyze My Profile"}
          </Button>
        </div>
      </div>

      {/* Profile Analysis Report */}
      {analysis && (
        <Card className="border-zinc-600/25 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{analysis.headline}</CardTitle>
                <p className="text-sm text-zinc-400 mt-2 max-w-2xl">{analysis.summary}</p>
              </div>
              <div className="text-center shrink-0">
                <div className="text-4xl font-bold tabular-nums text-zinc-200">
                  {analysis.overallScore}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">/ 100</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Priorities, in order
              </p>
              <ol className="space-y-1.5">
                {analysis.topPriorities.map((p, i) => (
                  <li key={i} className="flex gap-3 text-sm text-zinc-200">
                    <span className="text-zinc-200 font-bold tabular-nums">{i + 1}.</span>
                    {p}
                  </li>
                ))}
              </ol>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {analysis.sections.map((s) => (
                <div key={s.agent} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="text-sm font-semibold mb-2">
                    {s.emoji} {s.agent}
                    <span className="text-zinc-500 font-normal"> · {s.title}</span>
                  </p>
                  <p className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">{s.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Learning Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <LearningStatCard
          label="Total Insights"
          value={String(totalInsights)}
          icon={Sparkles}
          color="text-zinc-200"
        />
        <LearningStatCard
          label="Avg Confidence"
          value={`${(avgConfidence * 100).toFixed(0)}%`}
          icon={Target}
          color="text-zinc-400"
        />
        <LearningStatCard
          label="Applied"
          value={`${appliedCount}/${totalInsights}`}
          icon={CheckCircle2}
          color="text-emerald-400"
        />
        <LearningStatCard
          label="Avg Impact"
          value={
            avgImpact !== 0
              ? `${avgImpact > 0 ? "+" : ""}${avgImpact.toFixed(1)}%`
              : "—"
          }
          icon={Award}
          color="text-zinc-200"
          trend={avgImpact}
        />
      </div>

      {/* Recommendations Panel */}
      {recommendations.length > 0 && (
        <Card className="border-zinc-600/30 bg-zinc-600/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-zinc-200" />
              Top Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.map((rec) => {
              const config = INSIGHT_TYPE_CONFIG[rec.type] || INSIGHT_TYPE_CONFIG.performance;
              return (
                <div
                  key={rec.id}
                  className="flex items-start gap-3 rounded-lg bg-zinc-800/50 p-3"
                >
                  <div className={`mt-0.5 ${config.color}`}>
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300">{rec.insight}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className={`text-[9px] ${config.bgColor} ${config.color}`}>
                        {config.label}
                      </Badge>
                      <span className="text-[10px] text-zinc-500">
                        {(rec.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                  </div>
                  <a
                    href="/content"
                    className="inline-flex items-center justify-center rounded-md text-[10px] font-medium px-2.5 py-1 bg-zinc-700 text-zinc-300 hover:bg-zinc-600 shrink-0"
                  >
                    Create Content
                  </a>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="space-y-3">
        {/* Type Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-zinc-500" />
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                typeFilter === t.key
                  ? "bg-zinc-700 text-zinc-100"
                  : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Platform + Sort + Applied */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            {PLATFORM_FILTERS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPlatformFilter(p.key)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  platformFilter === p.key
                    ? "bg-zinc-700 text-zinc-100"
                    : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {/* Applied Toggle */}
            <div className="flex gap-0.5 bg-zinc-800/50 rounded-md p-0.5">
              {(["all", "pending", "applied"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setShowApplied(opt)}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium ${
                    showApplied === opt
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-500"
                  }`}
                >
                  {opt === "all" ? "All" : opt === "applied" ? "Applied" : "Pending"}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex gap-0.5 bg-zinc-800/50 rounded-md p-0.5">
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium ${
                    sortBy === s.key
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-500"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Insights Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            {filtered.length} insight{filtered.length !== 1 ? "s" : ""}
          </p>
          {filtered.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onApply={handleApply}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-zinc-600">
          <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No insights yet</p>
          <p className="text-xs mt-1">
            Click &quot;Retrain Now&quot; to analyze your posting history
          </p>
        </div>
      )}
    </div>
  );
}

// ─── INSIGHT CARD ────────────────────────────────────────────────────────────

function InsightCard({
  insight,
  onApply,
  onDismiss,
}: {
  insight: Insight;
  onApply: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  const config =
    INSIGHT_TYPE_CONFIG[insight.type] || INSIGHT_TYPE_CONFIG.performance;
  const Icon = config.icon;
  const data = insight.data as Record<string, number>;
  const sampleSize = data.sampleSize || data.postCount || 0;

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`p-2 rounded-lg ${config.bgColor} shrink-0`}
          >
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge className={`text-[9px] ${config.bgColor} ${config.color}`}>
                {config.label}
              </Badge>
              {insight.platform && (
                <Badge className="text-[9px] bg-zinc-700 text-zinc-300">
                  {insight.platform}
                </Badge>
              )}
              {!insight.platform && (
                <Badge className="text-[9px] bg-zinc-700 text-zinc-300">
                  Cross-platform
                </Badge>
              )}
              {insight.applied && (
                <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                  Applied
                </Badge>
              )}
            </div>

            {/* Insight Text */}
            <p className="text-sm text-zinc-200 leading-relaxed">
              {insight.insight}
            </p>

            {/* Meta Row */}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {/* Confidence */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">Confidence</span>
                <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      insight.confidence >= 0.8
                        ? "bg-emerald-500"
                        : insight.confidence >= 0.6
                        ? "bg-zinc-500"
                        : "bg-zinc-600"
                    }`}
                    style={{ width: `${insight.confidence * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-400">
                  {(insight.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* Sample Size */}
              {sampleSize > 0 && (
                <span className="text-[10px] text-zinc-500">
                  Based on {sampleSize} posts
                </span>
              )}

              {/* Impact */}
              {insight.impactScore !== null && (
                <span
                  className={`text-[10px] flex items-center gap-0.5 ${
                    insight.impactScore >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {insight.impactScore >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(insight.impactScore).toFixed(1)}% impact
                </span>
              )}

              {/* Age */}
              <span className="text-[10px] text-zinc-600">
                {formatTimeAgo(insight.createdAt)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1.5 shrink-0">
            {!insight.applied && (
              <button
                onClick={() => onApply(insight.id)}
                className="inline-flex items-center justify-center rounded-md text-[10px] font-medium px-2.5 py-1 bg-zinc-600/20 text-zinc-200 hover:bg-zinc-600/30 transition-colors"
              >
                Apply
              </button>
            )}
            <button
              onClick={() => onDismiss(insight.id)}
              className="inline-flex items-center justify-center rounded-md text-[10px] font-medium px-2.5 py-1 bg-zinc-800 text-zinc-500 hover:bg-zinc-700 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────

function LearningStatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  trend?: number;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Icon className={`h-4 w-4 ${color}`} />
          {trend !== undefined && trend !== 0 && (
            <span
              className={`text-[10px] flex items-center ${
                trend > 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {trend > 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
            </span>
          )}
        </div>
        <p className="text-xl font-bold text-zinc-100 mt-2">{value}</p>
        <p className="text-xs text-zinc-500 mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
