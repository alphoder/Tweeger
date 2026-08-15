"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Loader2,
  Plus,
  Search,
  Shield,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePuterAI } from "@/hooks/use-puter-ai";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface CompetitorData {
  id: number;
  name: string;
  handle: string;
  platform: string;
  analysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    recommendations: string[];
  } | null;
  contentPatterns: {
    postingFrequency: string;
    commonHashtags: string[];
    contentTypes: string[];
    engagementPatterns: string;
  } | null;
  analyzedAt: string;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function CompetitorsPage() {
  const { chat } = usePuterAI();
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form
  const [formName, setFormName] = useState("");
  const [formHandle, setFormHandle] = useState("");
  const [formPlatform, setFormPlatform] = useState("twitter");

  // ─── FETCH ─────────────────────────────────────────────────────────────────

  const fetchCompetitors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketing/competitors");
      if (res.ok) {
        const data = await res.json();
        setCompetitors(data.competitors || []);
      }
    } catch {
      toast.error("Failed to load competitors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  // ─── ANALYZE ───────────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!formName || !formHandle) {
      toast.error("Name and handle are required");
      return;
    }

    setAnalyzing(true);
    try {
      const prompt = `You are Axon Social AI's Competitive Intelligence agent. Analyze a competitor's social media strategy.

Competitor: ${formName} (@${formHandle}) on ${formPlatform}

Based on typical patterns for businesses in this space, provide a strategic analysis. Return JSON:
{
  "analysis": {
    "strengths": ["string", "string", "string"],
    "weaknesses": ["string", "string", "string"],
    "opportunities": ["string", "string", "string"],
    "recommendations": ["string", "string", "string"]
  },
  "contentPatterns": {
    "postingFrequency": "string (e.g., '2-3 posts/day')",
    "commonHashtags": ["#tag1", "#tag2", "#tag3"],
    "contentTypes": ["image", "text", "video"],
    "engagementPatterns": "string describing patterns"
  }
}

Make the analysis specific and actionable for Axon (an AI social media automation agency for Indian businesses).
Return ONLY the JSON.`;

      const response = await chat(prompt, { model: "Gemini Flash" });
      let parsed: Record<string, unknown> = {};

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch {
        toast.error("Failed to parse analysis");
        setAnalyzing(false);
        return;
      }

      const res = await fetch("/api/marketing/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          handle: formHandle,
          platform: formPlatform,
          analysis: parsed.analysis,
          contentPatterns: parsed.contentPatterns,
        }),
      });

      if (res.ok) {
        toast.success("Competitor analyzed!");
        setShowAddForm(false);
        setFormName("");
        setFormHandle("");
        fetchCompetitors();
      }
    } catch {
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/marketing/competitors?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Removed");
        setCompetitors((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      toast.error("Failed to delete");
    }
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-amber-400" />
            Competitor Intelligence
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Analyze competitor strategies and find your edge
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          className="bg-amber-400 text-zinc-950 hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Analyze Competitor
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="border-amber-500/30 bg-amber-950/10">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Search className="h-4 w-4 text-amber-400" />
                New Competitor Analysis
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Company Name"
                className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
              />
              <input
                type="text"
                value={formHandle}
                onChange={(e) => setFormHandle(e.target.value)}
                placeholder="@handle"
                className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
              />
              <div className="flex gap-2">
                {["twitter", "linkedin", "instagram"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setFormPlatform(p)}
                    className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium ${
                      formPlatform === p
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full bg-amber-400 text-zinc-950"
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              {analyzing ? "Analyzing..." : "Run Analysis"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      ) : competitors.length > 0 ? (
        <div className="space-y-6">
          {competitors.map((comp) => (
            <Card
              key={comp.id}
              className="border-zinc-800 bg-zinc-900/50"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      {comp.name}
                    </CardTitle>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      @{comp.handle} on {comp.platform} — Analyzed{" "}
                      {new Date(comp.analyzedAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge className="text-[9px] bg-zinc-700 text-zinc-300">
                      {comp.platform}
                    </Badge>
                    <button
                      onClick={() => handleDelete(comp.id)}
                      className="p-1 text-zinc-600 hover:text-zinc-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* SWOT Grid */}
                {comp.analysis && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <SwotSection
                      title="Strengths"
                      items={comp.analysis.strengths}
                      icon={Shield}
                      color="text-emerald-400"
                      bgColor="bg-emerald-500/10"
                    />
                    <SwotSection
                      title="Weaknesses"
                      items={comp.analysis.weaknesses}
                      icon={AlertTriangle}
                      color="text-red-400"
                      bgColor="bg-red-500/10"
                    />
                    <SwotSection
                      title="Opportunities for Axon"
                      items={comp.analysis.opportunities}
                      icon={TrendingUp}
                      color="text-blue-400"
                      bgColor="bg-blue-500/10"
                    />
                    <SwotSection
                      title="Recommendations"
                      items={comp.analysis.recommendations}
                      icon={Lightbulb}
                      color="text-amber-400"
                      bgColor="bg-amber-500/10"
                    />
                  </div>
                )}

                {/* Content Patterns */}
                {comp.contentPatterns && (
                  <div className="rounded-lg bg-zinc-800/50 p-3 space-y-2">
                    <h4 className="text-xs font-medium text-zinc-300">
                      Content Patterns
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <span className="text-zinc-500">
                          Posting Frequency
                        </span>
                        <p className="text-zinc-300">
                          {comp.contentPatterns.postingFrequency}
                        </p>
                      </div>
                      <div>
                        <span className="text-zinc-500">
                          Engagement Patterns
                        </span>
                        <p className="text-zinc-300">
                          {comp.contentPatterns.engagementPatterns}
                        </p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Content Types</span>
                        <div className="flex gap-1 mt-0.5">
                          {comp.contentPatterns.contentTypes.map((t) => (
                            <Badge
                              key={t}
                              className="text-[8px] bg-zinc-700 text-zinc-400"
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-zinc-500">Hashtags</span>
                        <div className="flex gap-1 flex-wrap mt-0.5">
                          {comp.contentPatterns.commonHashtags
                            .slice(0, 5)
                            .map((h) => (
                              <span
                                key={h}
                                className="text-[9px] text-zinc-400"
                              >
                                {h}
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <a
                  href="/content"
                  className="inline-flex items-center justify-center w-full rounded-md text-xs font-medium py-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                >
                  <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                  Generate Counter-Content
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-zinc-600">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No competitors analyzed</p>
          <p className="text-xs mt-1">
            Add a competitor to get AI-powered strategic analysis
          </p>
        </div>
      )}
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function SwotSection({
  title,
  items,
  icon: Icon,
  color,
  bgColor,
}: {
  title: string;
  items: string[];
  icon: React.ElementType;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={`rounded-lg ${bgColor} p-3 space-y-1.5`}>
      <h4 className={`text-xs font-medium ${color} flex items-center gap-1.5`}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h4>
      {items.map((item, i) => (
        <p key={i} className="text-[10px] text-zinc-300">
          &bull; {item}
        </p>
      ))}
    </div>
  );
}
