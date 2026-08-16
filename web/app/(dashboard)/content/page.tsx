"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PenLine,
  Wand2,
  Image as ImageIcon,
  Hash,
  Loader2,
  Send,
  Clock,
  Save,
  Sparkles,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Layers,
  Zap,
  Eye,
  ChevronDown,
  ChevronRight,
  Upload,
  CheckSquare,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { usePuterAI, type ModelName } from "@/hooks/use-puter-ai";
import { PostPreview } from "@/components/post-preview";
import { ScheduleDialog } from "@/components/schedule-dialog";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const PLATFORMS = [
  { key: "twitter", label: "Twitter", icon: "𝕏", color: "bg-zinc-500/20 text-zinc-400" },
  { key: "linkedin", label: "LinkedIn", icon: "in", color: "bg-blue-500/20 text-blue-400" },
  { key: "instagram", label: "Instagram", icon: "📷", color: "bg-zinc-600/20 text-zinc-200" },
  { key: "facebook", label: "Facebook", icon: "f", color: "bg-blue-600/20 text-blue-500" },
  { key: "all", label: "All Platforms", icon: "⚡", color: "bg-zinc-500/20 text-zinc-400" },
];

const PLATFORM_PLACEHOLDERS: Record<string, string> = {
  twitter: "Drop a hot take about AI automation...",
  linkedin: "Share a professional insight about business automation...",
  instagram: "Tell a visual story about transforming businesses...",
  facebook: "Start a conversation about why businesses need automation...",
  all: "Write your message — AI will optimize for each platform...",
};

const PLATFORM_TIPS: Record<string, string> = {
  twitter: "Tip: Questions get 2x more engagement. Try leading with one.",
  linkedin: "Tip: Posts with 1-2 line hooks get 3x more impressions.",
  instagram: "Tip: Use line breaks for readability. First line is your hook.",
  facebook: "Tip: Personal stories get 5x engagement over promotional content.",
  all: "Manager Bot will create platform-optimized versions for all 4 platforms.",
};

const CONTENT_TYPES = [
  "Regular Post",
  "Thread",
  "Case Study Snippet",
  "Data Point",
  "Question",
  "Hot Take",
];

const INDUSTRIES = [
  "All",
  "Restaurants",
  "Hotels",
  "Hospitals",
  "Real Estate",
  "Education",
  "Startups",
];

interface DraftItem {
  id: number;
  text: string;
  platform: string;
  status: string;
  aiScore: number | null;
  createdAt: string;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function ContentStudioPage() {
  // Editor state
  const [platform, setPlatform] = useState("twitter");
  const [postText, setPostText] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");

  // AI generation state
  const [model, setModel] = useState<ModelName>("Gemini Flash");
  const [industry, setIndustry] = useState("All");
  const [contentType, setContentType] = useState("Regular Post");
  const [generating, setGenerating] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  // AI Score
  const [aiScore, setAiScore] = useState<{
    overall: number;
    hook: number;
    cta: number;
    platformFit: number;
    hashtags: number;
  } | null>(null);
  const [scoring, setScoring] = useState(false);

  // Drafts
  const [recentDrafts, setRecentDrafts] = useState<DraftItem[]>([]);

  // Schedule dialog
  const [showSchedule, setShowSchedule] = useState(false);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Review Deck state
  const [sendingToReview, setSendingToReview] = useState(false);
  const [creatingForAll, setCreatingForAll] = useState(false);

  // Puter AI
  const { ready: puterReady, chat, generateImage: puterGenerateImage } = usePuterAI();

  // ─── FETCH RECENT DRAFTS ──────────────────────────────────────────────────

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/drafts?limit=10&status=pending");
      if (res.ok) {
        const data = await res.json();
        setRecentDrafts(data.drafts || []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  // ─── AI GENERATE POST ─────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!puterReady) {
      toast.error("AI engine loading — try again in a moment");
      return;
    }

    setGenerating(true);
    setAiReasoning(null);

    try {
      const systemPrompt = `You are the social media copilot for a builder\u2019s personal Twitter/X focused on AI, ML, blockchain, and startups.
Generate a ${contentType} for ${platform === "all" ? "Twitter" : platform}.
Industry focus: ${industry === "All" ? "general AI automation" : industry}.
Tone: Direct, no-nonsense, operator-focused. Concrete problems and measurable outcomes.
Voice: sharp builder, specific and human, zero AI-sounding filler.

Rules:
- Write ONLY the post text. No explanations, no labels.
- ${platform === "twitter" ? "Max 280 characters. Punchy and concise." : ""}
- ${platform === "linkedin" ? "Max 3000 chars. Professional but engaging." : ""}
- ${platform === "instagram" ? "Max 2200 chars. Visual storytelling. Add IMAGE SUGGESTION at end." : ""}
- ${platform === "facebook" ? "Conversational, personal tone." : ""}
- End with a clear CTA.
- Include 2-3 relevant hashtags inline.

After the post, on a new line write:
REASONING: [One sentence explaining why this approach works]`;

      const userPrompt = postText.trim()
        ? `Improve and expand this draft into a polished ${platform} post:\n\n"${postText}"`
        : `Generate a high-engagement ${contentType.toLowerCase()} about AI automation ${
            industry !== "All" ? `with a ${industry} angle` : "for a technical builder audience"
          }`;

      const result = await chat(userPrompt, { systemPrompt, model });

      if (result) {
        // Split reasoning from post
        const parts = result.split(/REASONING:\s*/i);
        const post = parts[0].trim();
        const reasoning = parts[1]?.trim() || null;

        setPostText(post);
        setAiReasoning(reasoning);

        // Extract hashtags from generated text
        const tagMatches = post.match(/#\w+/g);
        if (tagMatches) {
          setHashtags((prev) => [
            ...new Set([...prev, ...tagMatches.map((t) => t.replace("#", ""))]),
          ]);
        }

        toast.success("Post generated!");
      } else {
        toast.error("Generation failed — try again");
      }
    } catch {
      toast.error("AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  // ─── AI IMPROVE ────────────────────────────────────────────────────────────

  async function handleImprove() {
    if (!postText.trim()) {
      toast.error("Write or generate a post first");
      return;
    }
    if (!puterReady) {
      toast.error("AI engine loading");
      return;
    }

    setGenerating(true);
    try {
      const result = await chat(
        `Improve this ${platform} post. Make the hook stronger, the CTA clearer, and more engaging. Keep the same tone and message but make it more impactful.\n\nOriginal:\n"${postText}"\n\nWrite ONLY the improved post text. Then on a new line: REASONING: [why the changes improve it]`,
        {
          systemPrompt:
            "You are an expert copywriter for a builder\u2019s personal tech Twitter. Improve posts to maximize engagement while sounding fully human.",
          model,
        }
      );

      if (result) {
        const parts = result.split(/REASONING:\s*/i);
        setPostText(parts[0].trim());
        setAiReasoning(parts[1]?.trim() || null);
        toast.success("Post improved!");
      }
    } catch {
      toast.error("Improvement failed");
    } finally {
      setGenerating(false);
    }
  }

  // ─── AI SCORE ──────────────────────────────────────────────────────────────

  async function handleScore() {
    if (!postText.trim()) return;
    if (!puterReady) return;

    setScoring(true);
    try {
      const result = await chat(
        `Score this ${platform} post on 4 dimensions (0-100 each). Return ONLY a JSON object, no other text:\n{"hook":XX,"cta":XX,"platformFit":XX,"hashtags":XX}\n\nPost: "${postText}"\nHashtags: ${hashtags.join(", ") || "none"}`,
        {
          systemPrompt: `You are a social media analytics expert. Score posts objectively for ${platform}. Return ONLY valid JSON.`,
          model,
        }
      );

      if (result) {
        try {
          const cleaned = result.replace(/```json?\n?|\n?```/g, "").trim();
          const scores = JSON.parse(cleaned);
          const overall = Math.round(
            (scores.hook + scores.cta + scores.platformFit + scores.hashtags) / 4
          );
          setAiScore({
            overall,
            hook: scores.hook,
            cta: scores.cta,
            platformFit: scores.platformFit,
            hashtags: scores.hashtags,
          });
        } catch {
          toast.error("Failed to parse AI score");
        }
      }
    } catch {
      toast.error("Scoring failed");
    } finally {
      setScoring(false);
    }
  }

  // Auto-score when post text changes significantly
  useEffect(() => {
    setAiScore(null);
  }, [postText, platform]);

  // ─── SAVE AS DRAFT ─────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    if (!postText.trim()) {
      toast.error("Write something first");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: postText,
          imagePath,
          platform: platform === "all" ? "twitter" : platform,
          source: "manual",
          hashtags,
          targetIndustry: industry !== "All" ? industry : undefined,
          aiScore: aiScore?.overall,
          aiAnalysis: aiReasoning,
        }),
      });

      if (res.ok) {
        toast.success("Draft saved!");
        fetchDrafts();
      } else {
        toast.error("Failed to save draft");
      }
    } catch {
      toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  // ─── SCHEDULE ──────────────────────────────────────────────────────────────

  async function handleSchedule(scheduledTime: string) {
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: postText,
          imagePath,
          platform: platform === "all" ? "twitter" : platform,
          scheduledTime,
        }),
      });

      if (res.ok) {
        toast.success("Post scheduled!");
        setShowSchedule(false);
        setPostText("");
        setImagePath(null);
        setHashtags([]);
        setAiScore(null);
      } else {
        toast.error("Failed to schedule");
      }
    } catch {
      toast.error("Failed to schedule");
    }
  }

  // ─── SEND TO REVIEW DECK ─────────────────────────────────────────────────

  async function handleSendToReview() {
    if (!postText.trim()) {
      toast.error("Write something first");
      return;
    }

    setSendingToReview(true);
    try {
      // First save as draft if not already saved
      const draftRes = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: postText,
          imagePath,
          platform: platform === "all" ? "twitter" : platform,
          source: "manual",
          hashtags,
          targetIndustry: industry !== "All" ? industry : undefined,
          aiScore: aiScore?.overall,
          aiAnalysis: aiReasoning,
        }),
      });

      if (!draftRes.ok) {
        toast.error("Failed to save draft");
        return;
      }

      const draft = await draftRes.json();

      // Then send to review queue
      const reviewRes = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          platform: platform === "all" ? "twitter" : platform,
        }),
      });

      if (reviewRes.ok) {
        toast.success("Sent to Review Deck!");
        setPostText("");
        setImagePath(null);
        setHashtags([]);
        setAiScore(null);
        setAiReasoning(null);
        fetchDrafts();
      } else {
        toast.error("Failed to send to review");
      }
    } catch {
      toast.error("Failed to send to review");
    } finally {
      setSendingToReview(false);
    }
  }

  // ─── CREATE FOR ALL PLATFORMS ───────────────────────────────────────────────

  async function handleCreateForAll() {
    if (!postText.trim()) {
      toast.error("Write something first");
      return;
    }

    setCreatingForAll(true);
    try {
      const res = await fetch("/api/content/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: postText,
          hashtags,
          imagePath,
          industry: industry !== "All" ? industry : undefined,
          contentType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(
          `Created ${data.count || 4} platform versions → Review Deck`
        );
        setPostText("");
        setImagePath(null);
        setHashtags([]);
        setAiScore(null);
        setAiReasoning(null);
        fetchDrafts();
      } else {
        toast.error("Failed to create multi-platform posts");
      }
    } catch {
      toast.error("Failed to create multi-platform posts");
    } finally {
      setCreatingForAll(false);
    }
  }

  // ─── HASHTAG HANDLING ──────────────────────────────────────────────────────

  function handleHashtagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = hashtagInput.trim().replace(/^#/, "");
      if (tag && !hashtags.includes(tag)) {
        setHashtags((prev) => [...prev, tag]);
      }
      setHashtagInput("");
    }
  }

  function removeHashtag(tag: string) {
    setHashtags((prev) => prev.filter((t) => t !== tag));
  }

  // ─── IMAGE UPLOAD ──────────────────────────────────────────────────────────

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setImagePath(data.url);
        toast.success("Image uploaded!");
      } else {
        toast.error("Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    }
  }

  // ─── LOAD DRAFT ────────────────────────────────────────────────────────────

  function loadDraft(draft: DraftItem) {
    setPostText(draft.text);
    setPlatform(draft.platform);
    setAiScore(null);
    setAiReasoning(null);
    toast.info("Draft loaded into editor");
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <PenLine className="h-6 w-6 text-zinc-400" />
          Content Studio
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Create, generate, and schedule posts across all platforms
        </p>
      </div>

      {/* Platform Selector */}
      <div className="flex gap-2 flex-wrap">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPlatform(p.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              platform === p.key
                ? `${p.color} border border-current`
                : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 border border-transparent"
            }`}
          >
            <span className="mr-1.5">{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ─── LEFT COLUMN: Creation ───────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Post Editor */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="p-4 space-y-3">
              <Textarea
                placeholder={PLATFORM_PLACEHOLDERS[platform]}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                className="min-h-[160px] border-zinc-800 bg-zinc-900 text-zinc-100 text-sm resize-y"
              />
              <p className="text-[10px] text-zinc-600 italic">
                {PLATFORM_TIPS[platform]}
              </p>
            </CardContent>
          </Card>

          {/* Image Section */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-zinc-200" />
                Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {imagePath ? (
                <div className="relative">
                  <img
                    src={imagePath}
                    alt="Attached"
                    className="rounded-lg max-h-48 object-cover w-full"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2 h-7 text-xs border-zinc-700 bg-zinc-900/80"
                    onClick={() => setImagePath(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <label className="cursor-pointer flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <div className="rounded-lg border border-dashed border-zinc-700 p-4 text-center hover:border-zinc-600 transition-colors">
                      <Upload className="h-5 w-5 mx-auto mb-1 text-zinc-600" />
                      <span className="text-xs text-zinc-500">Upload Image</span>
                    </div>
                  </label>
                  <a
                    href="/images"
                    className="flex-1 rounded-lg border border-dashed border-zinc-700 p-4 text-center hover:border-zinc-600 transition-colors"
                  >
                    <ImageIcon className="h-5 w-5 mx-auto mb-1 text-zinc-600" />
                    <span className="text-xs text-zinc-500">From Library</span>
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Generation */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-zinc-400" />
                AI Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Select value={model} onValueChange={(v) => v && setModel(v as ModelName)}>
                  <SelectTrigger className="border-zinc-800 bg-zinc-900 text-xs">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gemini Flash">Gemini Flash</SelectItem>
                    <SelectItem value="GPT-4.1 Nano">GPT-4.1 Nano</SelectItem>
                    <SelectItem value="Claude Sonnet">Claude Sonnet</SelectItem>
                    <SelectItem value="Llama Scout">Llama Scout</SelectItem>
                    <SelectItem value="DeepSeek">DeepSeek</SelectItem>
                    <SelectItem value="Grok">Grok</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={industry} onValueChange={(v) => v && setIndustry(v)}>
                  <SelectTrigger className="border-zinc-800 bg-zinc-900 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={contentType} onValueChange={(v) => v && setContentType(v)}>
                  <SelectTrigger className="border-zinc-800 bg-zinc-900 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((ct) => (
                      <SelectItem key={ct} value={ct}>
                        {ct}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Button
                  onClick={handleGenerate}
                  disabled={generating || !puterReady}
                  className="bg-white text-black hover:bg-zinc-200 text-xs"
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  Generate
                </Button>

                <Button
                  onClick={handleImprove}
                  disabled={generating || !puterReady || !postText.trim()}
                  variant="outline"
                  className="border-zinc-700 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Improve
                </Button>

                <a
                  href="/trends"
                  className="inline-flex items-center justify-center rounded-md text-xs font-medium h-9 px-3 border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-300"
                >
                  <TrendingUp className="h-3.5 w-3.5 mr-1" />
                  From Trend
                </a>
              </div>

              {/* AI Reasoning */}
              {aiReasoning && (
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-400 w-full"
                >
                  {showReasoning ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  Why this works
                </button>
              )}
              {showReasoning && aiReasoning && (
                <p className="text-xs text-zinc-500 bg-zinc-800/50 rounded-lg p-3 italic">
                  {aiReasoning}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Hashtags */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Hash className="h-4 w-4 text-zinc-200" />
                Hashtags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {hashtags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[10px] border-zinc-700 cursor-pointer hover:border-red-700 hover:text-red-400"
                    onClick={() => removeHashtag(tag)}
                  >
                    #{tag} ×
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Type hashtag and press Enter..."
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={handleHashtagKeyDown}
                className="border-zinc-800 bg-zinc-900 text-sm"
              />
            </CardContent>
          </Card>

          {/* AI Score */}
          {postText.trim() && (
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardContent className="p-4">
                {aiScore ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-200">
                        AI Score
                      </span>
                      <Badge
                        className={`text-sm font-bold ${
                          aiScore.overall >= 70
                            ? "bg-green-500/20 text-green-400"
                            : aiScore.overall >= 40
                            ? "bg-zinc-600/20 text-zinc-200"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {aiScore.overall}/100
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <ScoreBar label="Hook" value={aiScore.hook} />
                      <ScoreBar label="CTA" value={aiScore.cta} />
                      <ScoreBar label="Platform Fit" value={aiScore.platformFit} />
                      <ScoreBar label="Hashtags" value={aiScore.hashtags} />
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={handleScore}
                    disabled={scoring || !puterReady}
                    variant="outline"
                    className="w-full border-zinc-700 text-xs"
                  >
                    {scoring ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <BarChart3 className="h-3.5 w-3.5 mr-1" />
                    )}
                    Score Post with AI
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleSaveDraft}
              disabled={saving || !postText.trim()}
              variant="outline"
              className="border-zinc-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Draft
            </Button>
            <Button
              onClick={handleSendToReview}
              disabled={sendingToReview || !postText.trim()}
              variant="outline"
              className="border-zinc-700/50 text-zinc-400 hover:bg-zinc-950/30"
            >
              {sendingToReview ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckSquare className="h-4 w-4 mr-2" />
              )}
              Send to Review
            </Button>
            <Button
              onClick={() => setShowSchedule(true)}
              disabled={!postText.trim()}
              className="bg-white text-black hover:bg-zinc-200 "
            >
              <Clock className="h-4 w-4 mr-2" />
              Schedule
            </Button>
          </div>

          {/* Create for All Platforms */}
          <Button
            onClick={handleCreateForAll}
            disabled={creatingForAll || !postText.trim()}
            className="w-full bg-white text-black hover:bg-zinc-200  "
          >
            {creatingForAll ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Globe className="h-4 w-4 mr-2" />
            )}
            Create for All Platforms → Review Deck
          </Button>
        </div>

        {/* ─── RIGHT COLUMN: Preview & Intelligence ────────────────────────── */}
        <div className="space-y-4">
          {/* Live Preview */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4 text-zinc-400" />
                Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PostPreview
                platform={platform === "all" ? "twitter" : platform}
                text={postText}
                imagePath={imagePath}
                hashtags={hashtags}
              />
            </CardContent>
          </Card>

          {/* Recent Drafts */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-zinc-400" />
                Recent Drafts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentDrafts.length > 0 ? (
                recentDrafts.slice(0, 5).map((draft) => (
                  <button
                    key={draft.id}
                    onClick={() => loadDraft(draft)}
                    className="w-full text-left rounded-lg bg-zinc-800/50 p-3 hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="text-[9px] bg-zinc-700 text-zinc-300">
                        {draft.platform}
                      </Badge>
                      <Badge
                        className={`text-[9px] ${
                          draft.status === "pending"
                            ? "bg-zinc-600/20 text-zinc-200"
                            : draft.status === "approved"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-zinc-600 text-zinc-400"
                        }`}
                      >
                        {draft.status}
                      </Badge>
                      {draft.aiScore != null && (
                        <span className="text-[9px] text-zinc-500 ml-auto">
                          Score: {Math.round(draft.aiScore)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      {draft.text}
                    </p>
                  </button>
                ))
              ) : (
                <p className="text-xs text-zinc-600 text-center py-4">
                  No pending drafts
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        onSchedule={handleSchedule}
        platform={platform === "all" ? "twitter" : platform}
      />
    </div>
  );
}

// ─── SCORE BAR COMPONENT ─────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 70
      ? "bg-green-500"
      : value >= 40
      ? "bg-zinc-600"
      : "bg-red-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-300 font-medium">{value}</span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
