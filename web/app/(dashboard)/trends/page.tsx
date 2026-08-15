"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  RefreshCw,
  Loader2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface TrendItem {
  name: string;
  volume?: number;
  category?: string;
  velocity?: string;
  relevanceScore?: number;
  suggestedAngle?: string;
}

interface PlatformTrends {
  trends: TrendItem[];
  fromCache: boolean;
  fetchedAt: string;
}

const PLATFORMS = [
  { key: "twitter", label: "Twitter / X", icon: "𝕏", color: "text-zinc-400" },
  { key: "linkedin", label: "LinkedIn", icon: "in", color: "text-blue-400" },
  { key: "instagram", label: "Instagram", icon: "📷", color: "text-amber-400" },
  { key: "facebook", label: "Facebook", icon: "f", color: "text-blue-500" },
];

function getRelevanceBadge(score?: number) {
  if (!score) return <Badge variant="outline" className="text-[10px] border-zinc-700">Unknown</Badge>;
  if (score >= 0.8) return <Badge className="bg-green-500/20 text-green-400 text-[10px]">High</Badge>;
  if (score >= 0.5) return <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">Medium</Badge>;
  return <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">Low</Badge>;
}

export default function TrendsPage() {
  const [allTrends, setAllTrends] = useState<Record<string, PlatformTrends>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function fetchTrends(platform: string, force = false) {
    setLoading((prev) => ({ ...prev, [platform]: true }));

    try {
      const method = force ? "POST" : "GET";
      const url = force
        ? "/api/trends"
        : `/api/trends?platform=${platform}`;
      const options = force
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform }),
          }
        : { method: "GET" };

      const res = await fetch(url, options);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setAllTrends((prev) => ({ ...prev, [platform]: data }));
    } catch {
      toast.error(`Failed to fetch ${platform} trends`);
    } finally {
      setLoading((prev) => ({ ...prev, [platform]: false }));
    }
  }

  useEffect(() => {
    PLATFORMS.forEach((p) => fetchTrends(p.key));
  }, []);

  // Find cross-platform trends
  const crossPlatformTrends: TrendItem[] = [];
  const trendNameMap = new Map<string, { trend: TrendItem; platforms: string[] }>();

  for (const [platform, data] of Object.entries(allTrends)) {
    for (const trend of data.trends || []) {
      const key = trend.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const existing = trendNameMap.get(key);
      if (existing) {
        existing.platforms.push(platform);
      } else {
        trendNameMap.set(key, { trend, platforms: [platform] });
      }
    }
  }

  for (const [, value] of trendNameMap) {
    if (value.platforms.length >= 2) {
      crossPlatformTrends.push({
        ...value.trend,
        category: `Trending on ${value.platforms.join(", ")}`,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-zinc-400" />
          Trend Research
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Real-time trends across all platforms, scored by relevance to Axon
        </p>
      </div>

      {/* Cross-platform trends */}
      {crossPlatformTrends.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Trending Everywhere
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {crossPlatformTrends.map((trend, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-zinc-900/50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{trend.name}</p>
                  <p className="text-xs text-zinc-500">{trend.category}</p>
                </div>
                {getRelevanceBadge(trend.relevanceScore)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Desktop: 4-column layout, Mobile: tabs */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-4">
        {PLATFORMS.map((p) => (
          <PlatformTrendColumn
            key={p.key}
            platform={p}
            data={allTrends[p.key]}
            isLoading={loading[p.key]}
            onRefresh={() => fetchTrends(p.key, true)}
          />
        ))}
      </div>

      <div className="lg:hidden">
        <Tabs defaultValue="twitter">
          <TabsList className="grid grid-cols-4 bg-zinc-900">
            {PLATFORMS.map((p) => (
              <TabsTrigger key={p.key} value={p.key} className="text-xs">
                {p.icon}
              </TabsTrigger>
            ))}
          </TabsList>
          {PLATFORMS.map((p) => (
            <TabsContent key={p.key} value={p.key}>
              <PlatformTrendColumn
                platform={p}
                data={allTrends[p.key]}
                isLoading={loading[p.key]}
                onRefresh={() => fetchTrends(p.key, true)}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

function PlatformTrendColumn({
  platform,
  data,
  isLoading,
  onRefresh,
}: {
  platform: { key: string; label: string; icon: string; color: string };
  data?: PlatformTrends;
  isLoading?: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span className={platform.color}>{platform.icon}</span>
            {platform.label}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        {data?.fetchedAt && (
          <p className="text-[10px] text-zinc-600">
            {data.fromCache ? "Cached" : "Fresh"} •{" "}
            {new Date(data.fetchedAt).toLocaleTimeString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && !data?.trends?.length ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
          </div>
        ) : data?.trends?.length ? (
          data.trends.map((trend, i) => (
            <div
              key={i}
              className="rounded-lg bg-zinc-800/50 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-zinc-200 leading-tight">
                  {trend.name}
                </p>
                {getRelevanceBadge(trend.relevanceScore)}
              </div>
              {trend.velocity && (
                <p className="text-[10px] text-zinc-500">
                  {trend.velocity} • {trend.category}
                </p>
              )}
              {trend.suggestedAngle && (
                <p className="text-xs text-zinc-400 italic">
                  Angle: {trend.suggestedAngle}
                </p>
              )}
              <a
                href={`/content?trend=${encodeURIComponent(trend.name)}&platform=${platform.key}`}
                className="inline-flex items-center justify-center rounded-md font-medium h-6 px-2 text-[10px] border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-100 w-full"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Generate Post
              </a>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-zinc-600">
            <p className="text-xs">No trends data</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-xs"
              onClick={onRefresh}
            >
              Research Now
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
