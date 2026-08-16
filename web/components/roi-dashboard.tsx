"use client";

// ─── ROI DASHBOARD COMPONENT ────────────────────────────────────────────────
// Before/after comparison showing AI automation impact.
// Signal performance tracking and algorithm change timeline.

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Brain,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface ROIMetrics {
  engagementRate: { before: number; current: number; change: number };
  reach: { before: number; current: number; change: number };
  saves: { before: number; current: number; change: number };
  shares: { before: number; current: number; change: number };
  comments: { before: number; current: number; change: number };
  postsPerDay: { before: number; current: number; change: number };
}

interface SignalPerformance {
  signal: string;
  total: number;
  successful: number;
  rate: number;
}

interface AlgorithmChange {
  id: number;
  platform: string | null;
  insight: string;
  confidence: number;
  autoApplied: boolean;
  strategyChange: string | null;
  createdAt: string;
  data: Record<string, unknown>;
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export function ROIDashboard() {
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ROIMetrics | null>(null);
  const [signals, setSignals] = useState<SignalPerformance[]>([]);
  const [algorithmChanges, setAlgorithmChanges] = useState<AlgorithmChange[]>([]);
  const [detecting, setDetecting] = useState(false);

  // ─── FETCH DATA ──────────────────────────────────────────────────────────

  const fetchROI = useCallback(async () => {
    setLoading(true);
    try {
      const days = period === "week" ? 7 : period === "month" ? 30 : 365;
      const [roiRes, signalRes, algoRes] = await Promise.all([
        fetch(`/api/analytics?type=roi&days=${days}`),
        fetch(`/api/analytics?type=signal_performance&days=${days}`),
        fetch(`/api/analytics?type=algorithm_changes`),
      ]);

      if (roiRes.ok) {
        const data = await roiRes.json();
        setMetrics(data.metrics || null);
      }

      if (signalRes.ok) {
        const data = await signalRes.json();
        setSignals(data.signals || []);
      }

      if (algoRes.ok) {
        const data = await algoRes.json();
        setAlgorithmChanges(data.insights || []);
      }
    } catch {
      // Silent fail — dashboard shows empty state
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchROI();
  }, [fetchROI]);

  // ─── RUN ALGORITHM DETECTION ──────────────────────────────────────────────

  async function runDetection() {
    setDetecting(true);
    try {
      const res = await fetch("/api/scheduler?action=algorithmDetection", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Detection complete: ${data.alerts?.length || 0} changes found`);
        fetchROI();
      }
    } catch {
      toast.error("Detection failed");
    } finally {
      setDetecting(false);
    }
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-400" />
            AI Performance ROI
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Measuring the impact of AI-driven content strategy
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-0.5">
            {(["week", "month", "all"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {p === "week" ? "7d" : p === "month" ? "30d" : "All"}
              </button>
            ))}
          </div>
          <Button
            onClick={runDetection}
            disabled={detecting}
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-400 hover:text-zinc-200"
          >
            {detecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="ml-1.5">Detect Changes</span>
          </Button>
        </div>
      </div>

      {/* ROI Metrics Grid */}
      {metrics ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <ROICard
            label="Engagement Rate"
            before={`${(metrics.engagementRate.before * 100).toFixed(2)}%`}
            current={`${(metrics.engagementRate.current * 100).toFixed(2)}%`}
            change={metrics.engagementRate.change}
            icon={Zap}
          />
          <ROICard
            label="Avg Reach"
            before={metrics.reach.before.toLocaleString()}
            current={metrics.reach.current.toLocaleString()}
            change={metrics.reach.change}
            icon={TrendingUp}
          />
          <ROICard
            label="Saves"
            before={metrics.saves.before.toLocaleString()}
            current={metrics.saves.current.toLocaleString()}
            change={metrics.saves.change}
            icon={Target}
          />
          <ROICard
            label="Shares"
            before={metrics.shares.before.toLocaleString()}
            current={metrics.shares.current.toLocaleString()}
            change={metrics.shares.change}
            icon={TrendingUp}
          />
          <ROICard
            label="Comments"
            before={metrics.comments.before.toLocaleString()}
            current={metrics.comments.current.toLocaleString()}
            change={metrics.comments.change}
            icon={TrendingUp}
          />
          <ROICard
            label="Posts/Day"
            before={metrics.postsPerDay.before.toFixed(1)}
            current={metrics.postsPerDay.current.toFixed(1)}
            change={metrics.postsPerDay.change}
            icon={BarChart3}
          />
        </div>
      ) : (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-zinc-500">
              Not enough data yet. ROI metrics will appear after 2+ weeks of posting.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Signal Performance */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-zinc-200" />
            Signal Targeting Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {signals.length > 0 ? (
            <div className="space-y-3">
              {signals.map((s) => (
                <div key={s.signal} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300 capitalize">{s.signal}</span>
                    <span className="text-xs text-zinc-500">
                      {s.successful}/{s.total} hit ({(s.rate * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        s.rate >= 0.7
                          ? "bg-emerald-500"
                          : s.rate >= 0.4
                          ? "bg-zinc-600"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${Math.max(s.rate * 100, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-4">
              No signal tracking data yet. AI will start tracking signal success after posts are published.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Algorithm Change Timeline */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-zinc-400" />
            Algorithm Changes Detected
          </CardTitle>
        </CardHeader>
        <CardContent>
          {algorithmChanges.length > 0 ? (
            <div className="space-y-3">
              {algorithmChanges.slice(0, 10).map((change) => (
                <div
                  key={change.id}
                  className="flex items-start gap-3 rounded-lg bg-zinc-800/30 p-3"
                >
                  <div className="mt-0.5">
                    {change.autoApplied ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-zinc-200" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {change.platform && (
                        <Badge variant="outline" className="text-[9px] border-zinc-700 text-zinc-400">
                          {change.platform}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${
                          change.confidence >= 0.7
                            ? "border-emerald-500/30 text-emerald-400"
                            : "border-zinc-600/30 text-zinc-200"
                        }`}
                      >
                        {(change.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                      {change.autoApplied && (
                        <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400">
                          Auto-applied
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {change.insight}
                    </p>
                    {change.strategyChange && (
                      <p className="text-[10px] text-zinc-500 mt-1 italic">
                        → {change.strategyChange}
                      </p>
                    )}
                    <p className="text-[10px] text-zinc-600 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(change.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-4">
              No algorithm changes detected yet. Run detection to analyze recent patterns.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── ROI CARD COMPONENT ─────────────────────────────────────────────────────

function ROICard({
  label,
  before,
  current,
  change,
  icon: Icon,
}: {
  label: string;
  before: string;
  current: string;
  change: number;
  icon: React.ElementType;
}) {
  const isPositive = change >= 0;

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="p-3.5">
        <div className="flex items-center justify-between mb-2">
          <Icon className="h-4 w-4 text-zinc-500" />
          <span
            className={`text-xs font-medium flex items-center gap-0.5 ${
              isPositive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
        </div>
        <p className="text-lg font-bold text-zinc-100">{current}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          Before AI: {before}
        </p>
        <p className="text-xs text-zinc-500 mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
