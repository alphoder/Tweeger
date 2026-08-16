"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Image as ImageIcon,
  Wand2,
  Upload,
  Loader2,
  Download,
  Trash2,
  Tag,
  Grid3X3,
  Filter,
  Search,
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
import { usePuterAI } from "@/hooks/use-puter-ai";

const PLATFORM_DIMENSIONS: Record<string, { width: number; height: number; label: string }> = {
  twitter: { width: 1200, height: 675, label: "Twitter (1200x675)" },
  instagram: { width: 1080, height: 1080, label: "Instagram (1080x1080)" },
  facebook: { width: 1200, height: 630, label: "Facebook (1200x630)" },
  linkedin: { width: 1200, height: 627, label: "LinkedIn (1200x627)" },
};

const STYLES = ["Professional", "Minimal", "Bold", "Aesthetic", "Infographic"];

interface ImageRecord {
  id: number;
  url: string;
  source: string;
  prompt?: string;
  platformFit: string[];
  tags: string[];
  category?: string;
  usedCount: number;
  aiDescription?: string;
  createdAt: string;
}

export default function ImageStudioPage() {
  // Generator state
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [style, setStyle] = useState("Professional");
  const [industry, setIndustry] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [recentGenerated, setRecentGenerated] = useState<string[]>([]);

  // Library state
  const [libraryImages, setLibraryImages] = useState<ImageRecord[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [filterSource, setFilterSource] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Puter AI
  const { ready: puterReady, generateImage } = usePuterAI();

  // Fetch library
  const fetchLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      const params = new URLSearchParams();
      if (filterSource !== "all") params.set("source", filterSource);

      const res = await fetch(`/api/images?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLibraryImages(data.images || []);
      }
    } catch {
      // Library fetch failed silently
    } finally {
      setLoadingLibrary(false);
    }
  }, [filterSource]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Generate image
  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("Enter an image prompt");
      return;
    }

    if (!puterReady) {
      toast.error("AI engine loading — try again in a moment");
      return;
    }

    setGenerating(true);

    try {
      const dims = PLATFORM_DIMENSIONS[platform];
      const fullPrompt = `${style} style: ${prompt}${industry ? ` for an AI automation company targeting ${industry} businesses in India` : ""}`;

      const imageUrl = await generateImage(fullPrompt, {
        width: dims.width,
        height: dims.height,
      });

      if (imageUrl) {
        setGeneratedImage(imageUrl);
        setRecentGenerated((prev) => [imageUrl, ...prev].slice(0, 5));
        toast.success("Image generated!");
      } else {
        toast.error("Generation failed — try a different prompt");
      }
    } catch {
      toast.error("Image generation failed");
    } finally {
      setGenerating(false);
    }
  }

  // Save generated image to library
  async function handleSaveToLibrary() {
    if (!generatedImage) return;

    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: generatedImage,
          prompt,
          platform,
          tags: [style.toLowerCase(), platform],
        }),
      });

      if (res.ok) {
        toast.success("Saved to library!");
        fetchLibrary();
      } else {
        toast.error("Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    }
  }

  // Upload image
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
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
        toast.success("Image uploaded!");
        fetchLibrary();
      } else {
        const data = await res.json();
        toast.error(data.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    }
  }

  // Delete image
  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/images?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Image deleted");
        fetchLibrary();
      }
    } catch {
      toast.error("Delete failed");
    }
  }

  // Filter images
  const filteredImages = libraryImages.filter((img) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        img.prompt?.toLowerCase().includes(q) ||
        img.aiDescription?.toLowerCase().includes(q) ||
        img.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ImageIcon className="h-6 w-6 text-zinc-200" />
          Image Studio
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Generate AI images with Puter.js or upload your own
        </p>
      </div>

      {/* ─── AI IMAGE GENERATOR ─────────────────────────────────────────── */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-zinc-200" />
            AI Image Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Describe the image you want to generate... e.g., 'Modern WhatsApp chatbot interface helping a restaurant manage orders, clean minimal design'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[80px] border-zinc-800 bg-zinc-900 text-zinc-100"
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select value={platform} onValueChange={(v) => v && setPlatform(v)}>
              <SelectTrigger className="border-zinc-800 bg-zinc-900">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLATFORM_DIMENSIONS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={style} onValueChange={(v) => v && setStyle(v)}>
              <SelectTrigger className="border-zinc-800 bg-zinc-900">
                <SelectValue placeholder="Style" />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={industry} onValueChange={(v) => v && setIndustry(v)}>
              <SelectTrigger className="border-zinc-800 bg-zinc-900">
                <SelectValue placeholder="Industry (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="Restaurant">Restaurants</SelectItem>
                <SelectItem value="Hotel">Hotels</SelectItem>
                <SelectItem value="Hospital">Hospitals</SelectItem>
                <SelectItem value="Real Estate">Real Estate</SelectItem>
                <SelectItem value="Education">Education</SelectItem>
                <SelectItem value="Startup">Startups</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleGenerate}
              disabled={generating || !puterReady}
              className="bg-white text-black hover:bg-zinc-200 "
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Generate
            </Button>
          </div>

          {/* Generated Image Preview */}
          {generatedImage && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <img
                src={generatedImage}
                alt="AI Generated"
                className="w-full max-w-lg mx-auto rounded-lg"
              />
              <div className="flex gap-2 mt-4 justify-center">
                <Button
                  size="sm"
                  onClick={handleSaveToLibrary}
                  className="bg-zinc-600 hover:bg-zinc-700"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Save to Library
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                  className="border-zinc-700"
                >
                  Regenerate
                </Button>
                <a
                  href="/content"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-100"
                >
                  Use in Post
                </a>
              </div>
            </div>
          )}

          {/* Recent generations */}
          {recentGenerated.length > 1 && (
            <div>
              <p className="text-xs text-zinc-500 mb-2">Recent generations</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {recentGenerated.slice(1).map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`Generated ${i + 1}`}
                    className="h-16 w-16 rounded-lg object-cover cursor-pointer border border-zinc-800 hover:border-zinc-600"
                    onClick={() => setGeneratedImage(img)}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── IMAGE LIBRARY ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-zinc-400" />
            Image Library
          </h2>
          <div className="flex gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
              <span className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-100">
                <Upload className="h-3.5 w-3.5 mr-1" />
                Upload
              </span>
            </label>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search by description or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 border-zinc-800 bg-zinc-900"
            />
          </div>
          <Select value={filterSource} onValueChange={(v) => v && setFilterSource(v)}>
            <SelectTrigger className="w-[160px] border-zinc-800 bg-zinc-900">
              <Filter className="h-3.5 w-3.5 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="ai_generated">AI Generated</SelectItem>
              <SelectItem value="uploaded">Uploaded</SelectItem>
              <SelectItem value="researched">Researched</SelectItem>
              <SelectItem value="stock">Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Image Grid */}
        {loadingLibrary ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
          </div>
        ) : filteredImages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredImages.map((img) => (
              <ImageCard key={img.id} image={img} onDelete={handleDelete} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-zinc-600">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No images yet</p>
            <p className="text-xs mt-1">
              Generate your first AI image or upload one
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ImageCard({
  image,
  onDelete,
}: {
  image: ImageRecord;
  onDelete: (id: number) => void;
}) {
  const sourceBadge = {
    ai_generated: { label: "AI", className: "bg-zinc-600/20 text-zinc-200" },
    uploaded: { label: "Upload", className: "bg-blue-500/20 text-blue-400" },
    researched: { label: "Research", className: "bg-zinc-500/20 text-zinc-400" },
    stock: { label: "Stock", className: "bg-zinc-500/20 text-zinc-400" },
  }[image.source] || { label: image.source, className: "" };

  return (
    <div className="group relative rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="aspect-square relative bg-zinc-900">
        <img
          src={image.url}
          alt={image.aiDescription || "Image"}
          className="w-full h-full object-cover"
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-zinc-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <a
            href="/content"
            className="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 border border-zinc-600 bg-transparent hover:bg-zinc-800 text-zinc-100"
          >
            Use in Post
          </a>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-red-800 text-red-400 hover:bg-red-500/20"
            onClick={() => onDelete(image.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="p-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Badge className={`text-[9px] ${sourceBadge.className}`}>
            {sourceBadge.label}
          </Badge>
          {image.usedCount > 0 && (
            <span className="text-[9px] text-zinc-600">
              Used {image.usedCount}x
            </span>
          )}
        </div>
        {image.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {image.tags.slice(0, 3).map((tag, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[8px] border-zinc-800 py-0"
              >
                <Tag className="h-2 w-2 mr-0.5" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
