import { NextRequest, NextResponse } from "next/server";
import { generate, generateImage, analyzeImage } from "@/lib/ai";
import { saveImage } from "@/lib/storage";

/**
 * POST /api/ai — server-side Gemini for the dashboard UI.
 * Protected by session middleware.
 *
 * Body:
 *  { mode: "chat",   prompt, systemPrompt?, temperature?, maxTokens?, model? }
 *  { mode: "vision", imageUrl, prompt }
 *  { mode: "image",  prompt }  → generates, stores, returns { url }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode = body.mode || "chat";

    if (mode === "image") {
      if (!body.prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
      const { bytes, mimeType } = await generateImage(body.prompt, { action: "ui_generate_image" });
      const saved = await saveImage(bytes, mimeType, "generated");
      return NextResponse.json({ url: saved.url, size: saved.size });
    }

    if (mode === "vision") {
      if (!body.imageUrl || !body.prompt) {
        return NextResponse.json({ error: "imageUrl and prompt required" }, { status: 400 });
      }
      const text = await analyzeImage(body.imageUrl, body.prompt);
      return NextResponse.json({ text });
    }

    if (!body.prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
    const text = await generate(body.systemPrompt || "You are a helpful assistant.", body.prompt, {
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      model: body.model,
      action: "ui_chat",
    });
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI call failed" },
      { status: 500 }
    );
  }
}

/** GET /api/ai — health check (is Gemini configured?). */
export async function GET() {
  return NextResponse.json({ ready: !!process.env.GEMINI_API_KEY });
}
