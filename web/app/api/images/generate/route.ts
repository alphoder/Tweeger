import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { images } from "@/lib/schema";
import { generateImage } from "@/lib/ai";
import { saveImage } from "@/lib/storage";

/**
 * POST /api/images/generate
 * Save a generated image to the library.
 * Body: { imageData?: string (data URL or already-stored URL), prompt: string,
 *         platform?, tags? }
 * If imageData is omitted, generates the image server-side with Gemini.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageData, prompt, platform, tags } = body;

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    let url: string;
    let fileSize = 0;

    if (!imageData) {
      // Generate server-side
      const img = await generateImage(prompt, { action: "library_generate" });
      const saved = await saveImage(img.bytes, img.mimeType, "generated");
      url = saved.url;
      fileSize = saved.size;
    } else if (imageData.startsWith("data:")) {
      // Client sent base64 — decode and store
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      const mime = imageData.match(/^data:(image\/\w+);/)?.[1] || "image/png";
      const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const saved = await saveImage(bytes, mime, "generated");
      url = saved.url;
      fileSize = saved.size;
    } else {
      // Already a stored URL (from /api/ai mode:image) — just record it
      url = imageData;
    }

    const platformFit = platform ? [platform] : ["twitter", "instagram", "facebook", "linkedin"];

    const [record] = await db
      .insert(images)
      .values({
        url,
        source: "ai_generated",
        prompt,
        platformFit,
        tags: tags || [],
        category: "ai_generated",
        fileSize,
        aiDescription: `AI-generated image: ${prompt}`,
      })
      .returning();

    return NextResponse.json(record);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save image" },
      { status: 500 }
    );
  }
}
