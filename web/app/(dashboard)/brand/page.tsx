"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe,
  MessageSquare,
  Share2,
  Loader2,
  Sparkles,
  Check,
  ChevronRight,
  Building2,
  Target,
  Palette,
  Users,
  Tags,
  Lightbulb,
  Settings2,
  Save,
  Trash2,
  Plus,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface ExtractedBrand {
  name: string;
  websiteUrl?: string;
  industry: string;
  subIndustry?: string;
  description: string;
  valueProposition: string;
  products: { name: string; description: string; price?: string; targetAudience?: string }[];
  tone: { primary: string; secondary?: string; avoidWords?: string[]; powerWords?: string[] };
  targetAudiences: { persona: string; painPoints?: string[]; desires?: string[]; platforms?: string[] }[];
  competitors: { name: string; url?: string; handle?: string; platform?: string }[];
  brandKeywords: string[];
  industryKeywords: string[];
  uniqueSellingPoints: string[];
  contentThemes: string[];
  contentPillars: { pillar: string; percentage: number; platforms?: string[] }[];
  languagePreference: string;
  location?: { city?: string; state?: string; country?: string };
  festivals: string[];
  socialLinks: { platform: string; url: string; handle?: string }[];
}

interface SavedBrand extends ExtractedBrand {
  id: number;
  automationMode: string;
  platformsActive: string[];
  postsPerDayPerPlatform: number;
  createdAt: string;
}

// ─── INPUT METHODS ───────────────────────────────────────────────────────────

const INPUT_METHODS = [
  {
    key: "url",
    label: "Website URL",
    icon: Globe,
    description: "Paste your website URL — AI extracts everything",
    placeholder: "https://yourbusiness.com",
  },
  {
    key: "text",
    label: "Describe Your Brand",
    icon: MessageSquare,
    description: "Tell us about your business in your own words",
    placeholder:
      "We're a cloud kitchen in Mumbai specializing in North Indian food. We serve busy professionals through Swiggy/Zomato and our own WhatsApp ordering...",
  },
  {
    key: "social",
    label: "Social Profile",
    icon: Share2,
    description: "Paste your social media profile link",
    placeholder: "https://instagram.com/yourbrand",
  },
] as const;

const PLATFORMS = [
  { key: "twitter", label: "Twitter/X", emoji: "𝕏", color: "bg-zinc-500" },
  { key: "linkedin", label: "LinkedIn", emoji: "in", color: "bg-blue-600" },
  { key: "instagram", label: "Instagram", emoji: "📷", color: "bg-amber-500" },
  { key: "facebook", label: "Facebook", emoji: "f", color: "bg-blue-500" },
];

const AUTOMATION_MODES = [
  {
    key: "full_auto_generate",
    label: "Full Auto",
    description: "AI researches, generates, and queues posts — you just approve in the Review Deck",
  },
  {
    key: "semi_auto",
    label: "Semi Auto",
    description: "AI generates drafts, you edit and schedule manually",
  },
  {
    key: "on_demand",
    label: "On Demand",
    description: "Generate content only when you ask — no automatic scheduling",
  },
];

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function BrandSetupPage() {
  // State machine: "input" → "extracting" → "review" → "saving" → "saved"
  const [step, setStep] = useState<"input" | "extracting" | "review" | "saving" | "saved">("input");
  const [inputMethod, setInputMethod] = useState<"url" | "text" | "social">("url");
  const [inputValue, setInputValue] = useState("");
  const [extractedBrand, setExtractedBrand] = useState<ExtractedBrand | null>(null);
  const [savedBrands, setSavedBrands] = useState<SavedBrand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);

  // Review step editing state
  const [editedBrand, setEditedBrand] = useState<ExtractedBrand | null>(null);
  const [activePlatforms, setActivePlatforms] = useState<string[]>(["twitter", "linkedin", "instagram", "facebook"]);
  const [automationMode, setAutomationMode] = useState("full_auto_generate");
  const [postsPerDay, setPostsPerDay] = useState(1);

  // ─── LOAD EXISTING BRANDS ───────────────────────────────────────────────────

  const loadBrands = useCallback(async () => {
    try {
      const res = await fetch("/api/brand");
      if (res.ok) {
        const brands = await res.json();
        setSavedBrands(brands);
      }
    } catch {
      // silent fail on initial load
    } finally {
      setLoadingBrands(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  // ─── EXTRACT BRAND ─────────────────────────────────────────────────────────

  async function handleExtract() {
    if (!inputValue.trim()) {
      toast.error("Please enter a value");
      return;
    }

    setStep("extracting");

    try {
      const res = await fetch("/api/brand/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: inputMethod, value: inputValue.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Extraction failed");
      }

      const data = await res.json();
      setExtractedBrand(data.brand);
      setEditedBrand(data.brand);
      setStep("review");
      toast.success("Brand extracted! Review and edit below.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Extraction failed");
      setStep("input");
    }
  }

  // ─── SAVE BRAND ────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!editedBrand) return;

    setStep("saving");

    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual",
          extractedData: {
            ...editedBrand,
            automationMode,
            platformsActive: activePlatforms,
            postsPerDayPerPlatform: postsPerDay,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }

      toast.success("Brand profile saved! Your AI agents are ready.");
      setStep("saved");
      setInputValue("");
      setExtractedBrand(null);
      setEditedBrand(null);
      await loadBrands();

      // Reset to input after a short delay
      setTimeout(() => setStep("input"), 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
      setStep("review");
    }
  }

  // ─── DELETE BRAND ──────────────────────────────────────────────────────────

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/brand?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Brand deleted");
        await loadBrands();
      }
    } catch {
      toast.error("Failed to delete brand");
    }
  }

  // ─── FIELD UPDATE HELPER ───────────────────────────────────────────────────

  function updateField<K extends keyof ExtractedBrand>(key: K, value: ExtractedBrand[K]) {
    if (!editedBrand) return;
    setEditedBrand({ ...editedBrand, [key]: value });
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Brand Setup</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Add a brand profile to power your AI content agents. Paste a URL and let AI do the rest.
        </p>
      </div>

      {/* Existing Brands */}
      {!loadingBrands && savedBrands.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Your Brands</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savedBrands.map((brand) => (
              <Card key={brand.id} className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-zinc-100 truncate">{brand.name}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">{brand.industry}{brand.subIndustry ? ` · ${brand.subIndustry}` : ""}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(brand.id)}
                      className="p-1.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{brand.description}</p>
                  <div className="flex items-center gap-1.5 mt-3">
                    {(brand.platformsActive || []).map((p: string) => (
                      <div
                        key={p}
                        className={`h-2 w-2 rounded-full ${
                          p === "twitter" ? "bg-zinc-500" :
                          p === "linkedin" ? "bg-blue-600" :
                          p === "instagram" ? "bg-amber-500" :
                          "bg-blue-500"
                        }`}
                        title={p}
                      />
                    ))}
                    <span className="text-[10px] text-zinc-600 ml-1">
                      {brand.automationMode === "full_auto_generate" ? "Full Auto" :
                       brand.automationMode === "semi_auto" ? "Semi Auto" : "On Demand"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step: Input */}
      {step === "input" && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <Plus className="h-5 w-5 text-zinc-400" />
              Add New Brand
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Input method selector */}
            <div className="grid gap-3 sm:grid-cols-3">
              {INPUT_METHODS.map((method) => (
                <button
                  key={method.key}
                  onClick={() => {
                    setInputMethod(method.key);
                    setInputValue("");
                  }}
                  className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
                    inputMethod === method.key
                      ? "border-zinc-500/50 bg-zinc-500/5"
                      : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <method.icon
                      className={`h-4 w-4 ${
                        inputMethod === method.key ? "text-zinc-400" : "text-zinc-500"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        inputMethod === method.key ? "text-zinc-400" : "text-zinc-300"
                      }`}
                    >
                      {method.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">{method.description}</p>
                </button>
              ))}
            </div>

            {/* Input field */}
            <div className="space-y-2">
              {inputMethod === "text" ? (
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={INPUT_METHODS.find((m) => m.key === inputMethod)?.placeholder}
                  className="min-h-[120px] bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 resize-none"
                />
              ) : (
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={INPUT_METHODS.find((m) => m.key === inputMethod)?.placeholder}
                  className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                  onKeyDown={(e) => e.key === "Enter" && handleExtract()}
                />
              )}
            </div>

            {/* Extract button */}
            <Button
              onClick={handleExtract}
              disabled={!inputValue.trim()}
              className="w-full bg-amber-400 text-zinc-950 hover:bg-amber-300 text-white border-0"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Extract Brand with AI
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: Extracting */}
      {step === "extracting" && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-amber-400 text-zinc-950 flex items-center justify-center animate-pulse">
                <Sparkles className="h-8 w-8 text-zinc-400" />
              </div>
              <Loader2 className="h-6 w-6 text-zinc-400 animate-spin absolute -top-1 -right-1" />
            </div>
            <h3 className="mt-6 text-lg font-semibold text-zinc-100">Extracting Brand Intelligence</h3>
            <p className="mt-2 text-sm text-zinc-500 max-w-md">
              AI is analyzing your {inputMethod === "url" ? "website" : inputMethod === "social" ? "social profile" : "description"} to build a comprehensive brand profile. This takes about 30-60 seconds...
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-zinc-600">
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse" />
              Identifying industry, tone, audience, and content strategy
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Review */}
      {step === "review" && editedBrand && (
        <div className="space-y-4">
          {/* Success banner */}
          <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
            <Check className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-400">Brand extracted successfully</p>
              <p className="text-xs text-zinc-500">Review and edit below, then save to activate your AI agents.</p>
            </div>
          </div>

          {/* Brand Identity */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-zinc-400" />
                Brand Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Brand Name</label>
                  <Input
                    value={editedBrand.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Industry</label>
                  <Input
                    value={editedBrand.industry}
                    onChange={(e) => updateField("industry", e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Sub-Industry</label>
                  <Input
                    value={editedBrand.subIndustry || ""}
                    onChange={(e) => updateField("subIndustry", e.target.value || undefined)}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-100"
                    placeholder="e.g., Fine Dining, HR Tech"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Language</label>
                  <Input
                    value={editedBrand.languagePreference}
                    onChange={(e) => updateField("languagePreference", e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-100"
                    placeholder="english, hinglish, hindi"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Description</label>
                <Textarea
                  value={editedBrand.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  className="bg-zinc-900/50 border-zinc-800 text-zinc-100 min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Value Proposition</label>
                <Textarea
                  value={editedBrand.valueProposition}
                  onChange={(e) => updateField("valueProposition", e.target.value)}
                  className="bg-zinc-900/50 border-zinc-800 text-zinc-100 min-h-[60px] resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Tone & Voice */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                <Palette className="h-4 w-4 text-amber-400" />
                Tone & Voice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Primary Tone</label>
                  <Input
                    value={editedBrand.tone.primary}
                    onChange={(e) => updateField("tone", { ...editedBrand.tone, primary: e.target.value })}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Secondary Tone</label>
                  <Input
                    value={editedBrand.tone.secondary || ""}
                    onChange={(e) => updateField("tone", { ...editedBrand.tone, secondary: e.target.value || undefined })}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-100"
                    placeholder="Optional secondary tone"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Power Words</label>
                  <Input
                    value={(editedBrand.tone.powerWords || []).join(", ")}
                    onChange={(e) =>
                      updateField("tone", {
                        ...editedBrand.tone,
                        powerWords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-100"
                    placeholder="comma-separated"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Words to Avoid</label>
                  <Input
                    value={(editedBrand.tone.avoidWords || []).join(", ")}
                    onChange={(e) =>
                      updateField("tone", {
                        ...editedBrand.tone,
                        avoidWords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-100"
                    placeholder="comma-separated"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Target Audiences */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                Target Audiences
                <Badge variant="secondary" className="ml-auto text-xs">
                  {editedBrand.targetAudiences.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {editedBrand.targetAudiences.map((audience, i) => (
                <div key={i} className="rounded-lg bg-zinc-800/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-200">{audience.persona}</span>
                    <button
                      onClick={() =>
                        updateField(
                          "targetAudiences",
                          editedBrand.targetAudiences.filter((_, idx) => idx !== i)
                        )
                      }
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {audience.painPoints && audience.painPoints.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {audience.painPoints.map((pp, j) => (
                        <Badge key={j} variant="outline" className="text-[10px] text-zinc-400 border-zinc-700">
                          {pp}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {editedBrand.targetAudiences.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-4">No audiences extracted — add them manually if needed.</p>
              )}
            </CardContent>
          </Card>

          {/* Keywords & Themes */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                <Tags className="h-4 w-4 text-amber-400" />
                Keywords & Themes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Brand Keywords</label>
                <Input
                  value={editedBrand.brandKeywords.join(", ")}
                  onChange={(e) =>
                    updateField("brandKeywords", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                  }
                  className="bg-zinc-900/50 border-zinc-800 text-zinc-100"
                  placeholder="comma-separated"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Industry Keywords</label>
                <Input
                  value={editedBrand.industryKeywords.join(", ")}
                  onChange={(e) =>
                    updateField("industryKeywords", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                  }
                  className="bg-zinc-900/50 border-zinc-800 text-zinc-100"
                  placeholder="comma-separated"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Content Themes</label>
                <Input
                  value={editedBrand.contentThemes.join(", ")}
                  onChange={(e) =>
                    updateField("contentThemes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                  }
                  className="bg-zinc-900/50 border-zinc-800 text-zinc-100"
                  placeholder="comma-separated"
                />
              </div>
            </CardContent>
          </Card>

          {/* USPs */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-400" />
                Unique Selling Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {editedBrand.uniqueSellingPoints.map((usp, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-yellow-400 shrink-0" />
                    <span className="text-sm text-zinc-300 flex-1">{usp}</span>
                    <button
                      onClick={() =>
                        updateField(
                          "uniqueSellingPoints",
                          editedBrand.uniqueSellingPoints.filter((_, idx) => idx !== i)
                        )
                      }
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Content Pillars */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-400" />
                Content Pillars
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {editedBrand.contentPillars.map((pillar, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-300">{pillar.pillar}</span>
                      <span className="text-xs text-zinc-500">{pillar.percentage}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400 text-zinc-950 "
                        style={{ width: `${pillar.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Automation Config */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-zinc-400" />
                Automation Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Platform toggles */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">Active Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => {
                        setActivePlatforms((prev) =>
                          prev.includes(p.key)
                            ? prev.filter((k) => k !== p.key)
                            : [...prev, p.key]
                        );
                      }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                        activePlatforms.includes(p.key)
                          ? "border-zinc-500/50 bg-zinc-500/10 text-zinc-400"
                          : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                      }`}
                    >
                      <div className={`h-2 w-2 rounded-full ${activePlatforms.includes(p.key) ? p.color : "bg-zinc-700"}`} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Automation mode */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">Automation Mode</label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {AUTOMATION_MODES.map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => setAutomationMode(mode.key)}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        automationMode === mode.key
                          ? "border-zinc-500/50 bg-zinc-500/5"
                          : "border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <span className={`text-sm font-medium ${automationMode === mode.key ? "text-zinc-400" : "text-zinc-300"}`}>
                        {mode.label}
                      </span>
                      <p className="text-[11px] text-zinc-500 mt-1">{mode.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Posts per day */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">
                  Posts per Day per Platform: <span className="text-zinc-400">{postsPerDay}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={postsPerDay}
                  onChange={(e) => setPostsPerDay(parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-600">
                  <span>1/day</span>
                  <span>3/day</span>
                  <span>5/day</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                setStep("input");
                setExtractedBrand(null);
                setEditedBrand(null);
              }}
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:text-zinc-200"
            >
              Start Over
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-amber-400 text-zinc-950 hover:bg-amber-300 text-white border-0"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Brand & Activate AI Agents
            </Button>
          </div>
        </div>
      )}

      {/* Step: Saving */}
      {step === "saving" && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="h-8 w-8 text-zinc-400 animate-spin" />
            <h3 className="mt-4 text-lg font-semibold text-zinc-100">Saving Brand Profile</h3>
            <p className="mt-2 text-sm text-zinc-500">Setting up your AI agents...</p>
          </CardContent>
        </Card>
      )}

      {/* Step: Saved */}
      {step === "saved" && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-zinc-100">Brand Profile Saved!</h3>
            <p className="mt-2 text-sm text-zinc-500">Your AI agents are now configured and ready to generate content.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
