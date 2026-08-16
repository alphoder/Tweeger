"use client";

import { useState } from "react";
import {
  Target,
  Loader2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  Rocket,
  Save,
  Edit3,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { usePuterAI } from "@/hooks/use-puter-ai";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface ContentPlanItem {
  day: number;
  platform: string;
  postText: string;
  contentType: string;
  hashtags: string[];
  imagePrompt?: string;
  status: string;
}

interface CampaignBuilderProps {
  onClose: () => void;
  onCreated: () => void;
}

const PLATFORMS = [
  { key: "twitter", label: "Twitter", color: "bg-zinc-500/20 text-zinc-400" },
  { key: "linkedin", label: "LinkedIn", color: "bg-zinc-600/20 text-zinc-200" },
  { key: "instagram", label: "Instagram", color: "bg-zinc-600/20 text-zinc-200" },
  { key: "facebook", label: "Facebook", color: "bg-blue-500/20 text-blue-400" },
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

const DURATIONS = [
  { days: 3, label: "3 Days" },
  { days: 5, label: "5 Days" },
  { days: 7, label: "1 Week" },
  { days: 14, label: "2 Weeks" },
  { days: 30, label: "1 Month" },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export function CampaignBuilder({ onClose, onCreated }: CampaignBuilderProps) {
  const [step, setStep] = useState(1);
  const { chat, loading: aiLoading } = usePuterAI();

  // Step 1 — Setup
  const [theme, setTheme] = useState("");
  const [duration, setDuration] = useState(7);
  const [industry, setIndustry] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);
  const [audience, setAudience] = useState("");

  // Step 2 — Generated plan
  const [contentPlan, setContentPlan] = useState<ContentPlanItem[]>([]);
  const [generating, setGenerating] = useState(false);

  // Step 3 — Editing
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  // Step 4 — Saving
  const [saving, setSaving] = useState(false);

  // ─── TOGGLE PLATFORM ───────────────────────────────────────────────────────

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  // ─── GENERATE CONTENT PLAN ─────────────────────────────────────────────────

  async function generatePlan() {
    if (!theme) {
      toast.error("Please enter a campaign theme");
      return;
    }

    setGenerating(true);
    try {
      const prompt = `You are FineTweet's Manager Bot. Generate a ${duration}-day social media campaign content plan.

Campaign Theme: "${theme}"
Target Industry: ${industry || "general"}
Platforms: ${selectedPlatforms.join(", ")}
Target Audience: ${audience || "Indian business owners"}

Generate exactly ${duration * selectedPlatforms.length} posts (one per platform per day).

Return a JSON array where each item has:
- day: number (1 to ${duration})
- platform: string (one of: ${selectedPlatforms.join(", ")})
- postText: string (the actual post text, platform-appropriate)
- contentType: string (text_only, image, carousel, or thread)
- hashtags: string[] (3-5 relevant hashtags)
- imagePrompt: string (optional, for image generation)
- status: "pending"

Make content platform-native:
- Twitter: concise, punchy, hook-first, under 280 chars
- LinkedIn: professional, insightful, with a CTA
- Instagram: visual-first captions, emoji-rich
- Facebook: conversational, community-focused

Return ONLY the JSON array, no other text.`;

      const response = await chat(prompt, { model: "Gemini Flash" });
      let plan: ContentPlanItem[] = [];

      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          plan = JSON.parse(jsonMatch[0]);
        }
      } catch {
        toast.error("Failed to parse AI response. Try again.");
        setGenerating(false);
        return;
      }

      setContentPlan(plan);
      setStep(3);
    } catch {
      toast.error("AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  // ─── SAVE CAMPAIGN ─────────────────────────────────────────────────────────

  async function saveCampaign(launch: boolean) {
    setSaving(true);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + duration);

      const res = await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: theme,
          theme,
          description: `${duration}-day campaign for ${industry || "general"} across ${selectedPlatforms.join(", ")}`,
          targetIndustry: industry || null,
          platforms: selectedPlatforms,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          targetAudience: audience || null,
          contentPlan,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        if (launch) {
          // Update status to active
          await fetch("/api/marketing/campaigns", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: data.campaign.id, status: "active" }),
          });
          toast.success(
            `Campaign launched with ${contentPlan.length} posts!`
          );
        } else {
          toast.success("Campaign saved as draft");
        }

        onCreated();
      } else {
        toast.error("Failed to save campaign");
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold">Campaign Builder</h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    s === step
                      ? "bg-emerald-500 text-white"
                      : s < step
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-zinc-800 text-zinc-600"
                  }`}
                >
                  {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
                </div>
              ))}
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Step 1 — Setup */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">
                  Campaign Theme *
                </label>
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder='e.g., "Restaurant Liberation Week"'
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">
                  Duration
                </label>
                <div className="flex gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.days}
                      onClick={() => setDuration(d.days)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        duration === d.days
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">
                  Target Industry
                </label>
                <div className="flex gap-2 flex-wrap">
                  {INDUSTRIES.map((ind) => (
                    <button
                      key={ind}
                      onClick={() =>
                        setIndustry(industry === ind ? "" : ind)
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        industry === ind
                          ? "bg-emerald-500/20 text-emerald-400"
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
                  Platforms *
                </label>
                <div className="flex gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => togglePlatform(p.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedPlatforms.includes(p.key)
                          ? p.color
                          : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">
                  Target Audience
                </label>
                <textarea
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="e.g., Restaurant owners in tier-1 Indian cities looking to automate their social media..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    if (!theme || selectedPlatforms.length === 0) {
                      toast.error("Theme and at least one platform required");
                      return;
                    }
                    setStep(2);
                    generatePlan();
                  }}
                  className="bg-white text-black hover:bg-zinc-200 "
                >
                  Generate Content Plan
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 — Generating */}
          {step === 2 && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative">
                <Sparkles className="h-12 w-12 text-emerald-400 animate-pulse" />
              </div>
              <p className="text-sm text-zinc-300 font-medium">
                Manager Bot generating campaign content...
              </p>
              <div className="flex gap-2">
                {selectedPlatforms.map((p) => (
                  <Badge key={p} className="text-[10px] bg-zinc-800 text-zinc-400">
                    {p} Bot generating...
                  </Badge>
                ))}
              </div>
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          )}

          {/* Step 3 — Review & Edit */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400">
                  {contentPlan.length} posts across {selectedPlatforms.length}{" "}
                  platform{selectedPlatforms.length !== 1 ? "s" : ""} over{" "}
                  {duration} days
                </p>
                <Button
                  onClick={() => {
                    setStep(2);
                    generatePlan();
                  }}
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 h-7 text-xs"
                  disabled={generating}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Regenerate All
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-2 px-2 text-zinc-500 font-medium">
                        Day
                      </th>
                      <th className="text-left py-2 px-2 text-zinc-500 font-medium">
                        Platform
                      </th>
                      <th className="text-left py-2 px-2 text-zinc-500 font-medium">
                        Post Text
                      </th>
                      <th className="text-left py-2 px-2 text-zinc-500 font-medium">
                        Type
                      </th>
                      <th className="text-left py-2 px-2 text-zinc-500 font-medium">
                        Hashtags
                      </th>
                      <th className="text-left py-2 px-2 text-zinc-500 font-medium w-16">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contentPlan.map((item, i) => (
                      <tr
                        key={i}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                      >
                        <td className="py-2 px-2 text-zinc-400">{item.day}</td>
                        <td className="py-2 px-2">
                          <Badge className="text-[9px] bg-zinc-700 text-zinc-300">
                            {item.platform}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-zinc-300 max-w-sm">
                          {editingIndex === i ? (
                            <div className="flex gap-1">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                rows={2}
                                className="flex-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs resize-none"
                              />
                              <button
                                onClick={() => {
                                  const updated = [...contentPlan];
                                  updated[i] = {
                                    ...updated[i],
                                    postText: editText,
                                  };
                                  setContentPlan(updated);
                                  setEditingIndex(null);
                                }}
                                className="text-emerald-400 hover:text-emerald-300 px-1"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <p className="line-clamp-2">{item.postText}</p>
                          )}
                        </td>
                        <td className="py-2 px-2 text-zinc-500">
                          {item.contentType}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-0.5">
                            {(item.hashtags || []).slice(0, 3).map((h, hi) => (
                              <span
                                key={hi}
                                className="text-[8px] text-zinc-400"
                              >
                                {h}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <button
                            onClick={() => {
                              setEditingIndex(i);
                              setEditText(item.postText);
                            }}
                            className="text-zinc-500 hover:text-zinc-300"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="border-zinc-700 text-zinc-300"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  className="bg-white text-black hover:bg-zinc-200 "
                >
                  Review & Launch
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4 — Launch */}
          {step === 4 && (
            <div className="space-y-6">
              <Card className="border-zinc-800 bg-zinc-800/30">
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Campaign Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-zinc-500">Theme</span>
                      <p className="text-zinc-200 font-medium">{theme}</p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Duration</span>
                      <p className="text-zinc-200 font-medium">
                        {duration} days
                      </p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Platforms</span>
                      <div className="flex gap-1 mt-0.5">
                        {selectedPlatforms.map((p) => (
                          <Badge
                            key={p}
                            className="text-[9px] bg-zinc-700 text-zinc-300"
                          >
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-zinc-500">Total Posts</span>
                      <p className="text-zinc-200 font-medium">
                        {contentPlan.length}
                      </p>
                    </div>
                    {industry && (
                      <div>
                        <span className="text-zinc-500">Industry</span>
                        <p className="text-zinc-200 font-medium">
                          {industry.replace("_", " ")}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button
                  onClick={() => setStep(3)}
                  variant="outline"
                  className="border-zinc-700 text-zinc-300"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back to Edit
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={() => saveCampaign(false)}
                    disabled={saving}
                    variant="outline"
                    className="border-zinc-700 text-zinc-300"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save Draft
                  </Button>
                  <Button
                    onClick={() => saveCampaign(true)}
                    disabled={saving}
                    className="bg-white text-black hover:bg-zinc-200 "
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4 mr-1" />
                    )}
                    Launch Campaign
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
