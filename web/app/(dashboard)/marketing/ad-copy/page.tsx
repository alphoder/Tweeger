"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Copy,
  Loader2,
  Sparkles,
  History,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePuterAI } from "@/hooks/use-puter-ai";
import { AdCopyCard } from "@/components/ad-copy-card";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Variant {
  angle: string;
  copyText: string;
  cta: string;
  selected: boolean;
  engagementScore?: number;
}

interface AdCopySet {
  id: number;
  productName: string;
  platform: string;
  targetIndustry: string | null;
  variants: Variant[];
  createdAt: string;
}

const PLATFORMS = [
  { key: "twitter", label: "Twitter" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
];

const TONES = [
  "Professional",
  "Urgent",
  "Conversational",
  "Data-driven",
  "Provocative",
];

const INDUSTRIES = [
  "restaurants",
  "hotels",
  "hospitals",
  "real_estate",
  "education",
  "startups",
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function AdCopyPage() {
  const { chat, loading: aiLoading } = usePuterAI();
  const [view, setView] = useState<"generate" | "history">("generate");

  // Generator form
  const [productName, setProductName] = useState("");
  const [platform, setPlatform] = useState("twitter");
  const [industry, setIndustry] = useState("");
  const [details, setDetails] = useState("");
  const [tone, setTone] = useState("Professional");
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [currentAdCopyId, setCurrentAdCopyId] = useState<number | null>(null);

  // History
  const [history, setHistory] = useState<AdCopySet[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ─── GENERATE VARIANTS ─────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!productName) {
      toast.error("Enter a product name");
      return;
    }

    setGenerating(true);
    try {
      const prompt = `You are Axon Social AI's Ad Copy specialist. Generate 4 ad copy variants for:

Product: "${productName}"
Platform: ${platform}
Industry: ${industry || "general"}
Tone: ${tone}
${details ? `Details: ${details}` : ""}

Return a JSON array of 4 objects, each with:
- angle: string (one of: "ROI-Focused", "Fear/FOMO", "Social Proof", "Problem-Solution")
- copyText: string (the actual ad copy, platform-appropriate length)
- cta: string (call-to-action text)
- selected: false
- engagementScore: number (1-10, your prediction of how engaging this is)

Platform limits: Twitter 280 chars, LinkedIn 3000, Instagram 2200, Facebook 63206.
Make each variant approach the product from a completely different angle.

Return ONLY the JSON array.`;

      const response = await chat(prompt, { model: "Gemini Flash" });
      let parsed: Variant[] = [];

      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch {
        toast.error("Failed to parse AI response");
        setGenerating(false);
        return;
      }

      setVariants(parsed);

      // Save to DB
      const res = await fetch("/api/marketing/ad-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          platform,
          targetIndustry: industry || null,
          variants: parsed,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentAdCopyId(data.adCopy?.id || null);
      }
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  // ─── UPDATE VARIANT ────────────────────────────────────────────────────────

  function handleUpdateVariant(index: number, updated: Variant) {
    const newVariants = [...variants];
    newVariants[index] = updated;
    setVariants(newVariants);

    // Persist to DB
    if (currentAdCopyId) {
      fetch("/api/marketing/ad-copy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentAdCopyId, variants: newVariants }),
      });
    }
  }

  // ─── QUEUE VARIANT ─────────────────────────────────────────────────────────

  async function handleQueue(variant: Variant) {
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: variant.copyText,
          platform,
          source: "ad_copy",
          targetIndustry: industry || null,
        }),
      });

      if (res.ok) {
        toast.success("Added to drafts — schedule from the queue");
      }
    } catch {
      toast.error("Failed to queue");
    }
  }

  // ─── FETCH HISTORY ─────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/marketing/ad-copy?limit=20");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.adCopies || []);
      }
    } catch {
      toast.error("Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "history") fetchHistory();
  }, [view, fetchHistory]);

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Copy className="h-6 w-6 text-zinc-400" />
            Ad Copy Generator
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Generate high-converting ad copy with A/B variants
          </p>
        </div>
        <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setView("generate")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              view === "generate"
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500"
            }`}
          >
            <Sparkles className="h-3 w-3 inline mr-1" />
            Generate
          </button>
          <button
            onClick={() => setView("history")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              view === "history"
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500"
            }`}
          >
            <History className="h-3 w-3 inline mr-1" />
            History
          </button>
        </div>
      </div>

      {view === "generate" ? (
        <div className="space-y-6">
          {/* Generator Form */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">
                    Product / Service Name *
                  </label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g., WhatsApp Ordering Bot for Restaurants"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">
                    Platform
                  </label>
                  <div className="flex gap-2">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setPlatform(p.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          platform === p.key
                            ? "bg-zinc-500/20 text-zinc-400"
                            : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">
                    Industry
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind}
                        onClick={() =>
                          setIndustry(industry === ind ? "" : ind)
                        }
                        className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                          industry === ind
                            ? "bg-zinc-500/20 text-zinc-400"
                            : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                        }`}
                      >
                        {ind.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">
                    Tone
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {TONES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTone(t)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                          tone === t
                            ? "bg-zinc-500/20 text-zinc-400"
                            : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">
                  Product Details (features, pricing, USP)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Describe your product's key features, pricing, and unique selling proposition..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-500/50"
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating || !productName}
                className="w-full bg-amber-400 text-zinc-950 hover:opacity-90"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {generating ? "Generating..." : "Generate 4 Variants"}
              </Button>
            </CardContent>
          </Card>

          {/* Variants Grid */}
          {variants.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {variants.map((v, i) => (
                <AdCopyCard
                  key={i}
                  variant={v}
                  index={i}
                  platform={platform}
                  onUpdate={handleUpdateVariant}
                  onRegenerate={() => {
                    toast.info("Regenerating variant...");
                  }}
                  onQueue={handleQueue}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* History View */
        <div className="space-y-4">
          {historyLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
            </div>
          ) : history.length > 0 ? (
            history.map((set) => (
              <Card
                key={set.id}
                className="border-zinc-800 bg-zinc-900/50"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-200">
                        {set.productName}
                      </h3>
                      <div className="flex gap-2 mt-1">
                        <Badge className="text-[9px] bg-zinc-700 text-zinc-300">
                          {set.platform}
                        </Badge>
                        {set.targetIndustry && (
                          <Badge className="text-[9px] bg-zinc-700 text-zinc-300">
                            {set.targetIndustry}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(set.createdAt).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(set.variants || []).map((v, i) => (
                      <div
                        key={i}
                        className={`rounded-lg bg-zinc-800/50 p-2.5 ${
                          v.selected ? "ring-1 ring-emerald-500/50" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="text-[8px] bg-zinc-700 text-zinc-400">
                            {v.angle}
                          </Badge>
                          {v.selected && (
                            <Badge className="text-[8px] bg-emerald-500/20 text-emerald-400">
                              Winner
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 line-clamp-2">
                          {v.copyText}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-16 text-zinc-600">
              <Copy className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No ad copies yet</p>
              <p className="text-xs mt-1">
                Generate your first ad copy variants
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
