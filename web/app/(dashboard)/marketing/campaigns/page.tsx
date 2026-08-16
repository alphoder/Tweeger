"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target,
  Loader2,
  Plus,
  Play,
  Pause,
  CheckCircle2,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CampaignBuilder } from "@/components/campaign-builder";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Campaign {
  id: number;
  name: string;
  theme: string;
  description: string;
  targetIndustry: string | null;
  platforms: string[];
  startDate: string;
  endDate: string;
  status: string;
  contentPlan: {
    day: number;
    platform: string;
    postText: string;
    contentType: string;
    hashtags: string[];
    status: string;
  }[];
  totalEngagement: number;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-zinc-700 text-zinc-300" },
  active: { label: "Active", color: "bg-emerald-500/20 text-emerald-400" },
  completed: { label: "Completed", color: "bg-blue-500/20 text-blue-400" },
  paused: { label: "Paused", color: "bg-zinc-600/20 text-zinc-200" },
  cancelled: { label: "Cancelled", color: "bg-red-500/20 text-red-400" },
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/marketing/campaigns?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch {
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  async function updateStatus(id: number, status: string) {
    try {
      const res = await fetch("/api/marketing/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        toast.success(`Campaign ${status}`);
        fetchCampaigns();
      }
    } catch {
      toast.error("Failed to update");
    }
  }

  async function deleteCampaign(id: number) {
    try {
      const res = await fetch(`/api/marketing/campaigns?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Campaign deleted");
        fetchCampaigns();
      }
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-emerald-400" />
            Campaign Planner
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            AI-powered multi-platform campaign creation
          </p>
        </div>
        <Button
          onClick={() => setShowBuilder(true)}
          className="bg-white text-black hover:bg-zinc-200 hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {["all", "draft", "active", "completed", "paused"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === s
                ? "bg-zinc-700 text-zinc-100"
                : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800"
            }`}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Campaign List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      ) : campaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((camp) => {
            const statusConf = STATUS_CONFIG[camp.status] || STATUS_CONFIG.draft;
            const totalItems = camp.contentPlan?.length || 0;
            const postedItems =
              camp.contentPlan?.filter((i) => i.status === "posted").length || 0;
            const progress =
              totalItems > 0 ? (postedItems / totalItems) * 100 : 0;

            return (
              <Card
                key={camp.id}
                className="border-zinc-800 bg-zinc-900/50"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-200">
                        {camp.name}
                      </h3>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {camp.description}
                      </p>
                    </div>
                    <Badge className={`text-[9px] ${statusConf.color}`}>
                      {statusConf.label}
                    </Badge>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1">
                    {camp.targetIndustry && (
                      <Badge className="text-[8px] bg-zinc-700/50 text-zinc-400">
                        {camp.targetIndustry}
                      </Badge>
                    )}
                    {(camp.platforms || []).map((p) => (
                      <Badge
                        key={p}
                        className="text-[8px] bg-zinc-700/50 text-zinc-400"
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>

                  {/* Dates */}
                  <p className="text-[10px] text-zinc-500">
                    {new Date(camp.startDate).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    —{" "}
                    {new Date(camp.endDate).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>

                  {/* Progress */}
                  {totalItems > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                        <span>
                          {postedItems}/{totalItems} posted
                        </span>
                        <span>{progress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-1.5 pt-1">
                    {camp.status === "draft" && (
                      <button
                        onClick={() => updateStatus(camp.id, "active")}
                        className="flex-1 inline-flex items-center justify-center rounded-md text-[10px] font-medium py-1.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Launch
                      </button>
                    )}
                    {camp.status === "active" && (
                      <button
                        onClick={() => updateStatus(camp.id, "paused")}
                        className="flex-1 inline-flex items-center justify-center rounded-md text-[10px] font-medium py-1.5 bg-zinc-600/20 text-zinc-200 hover:bg-zinc-600/30"
                      >
                        <Pause className="h-3 w-3 mr-1" />
                        Pause
                      </button>
                    )}
                    {camp.status === "paused" && (
                      <button
                        onClick={() => updateStatus(camp.id, "active")}
                        className="flex-1 inline-flex items-center justify-center rounded-md text-[10px] font-medium py-1.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Resume
                      </button>
                    )}
                    {(camp.status === "active" || camp.status === "paused") && (
                      <button
                        onClick={() => updateStatus(camp.id, "completed")}
                        className="flex-1 inline-flex items-center justify-center rounded-md text-[10px] font-medium py-1.5 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Complete
                      </button>
                    )}
                    <button
                      onClick={() => deleteCampaign(camp.id)}
                      className="inline-flex items-center justify-center rounded-md text-[10px] font-medium px-2 py-1.5 bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-zinc-600">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No campaigns yet</p>
          <p className="text-xs mt-1">
            Launch your first multi-platform campaign
          </p>
        </div>
      )}

      {/* Builder Modal */}
      {showBuilder && (
        <CampaignBuilder
          onClose={() => setShowBuilder(false)}
          onCreated={() => {
            setShowBuilder(false);
            fetchCampaigns();
          }}
        />
      )}
    </div>
  );
}
