// ─── GEMINI SERVER-SIDE AI CLIENT ────────────────────────────────────────────
// All server-side AI goes through the Google Gemini API directly.
// Logs every call to agent_logs for debugging and self-learning.
// Set GEMINI_API_KEY in the environment.

import { db } from "./db";
import { agentLogs } from "./schema";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_MODEL = "auto"; // resolved by the round-robin pool
export const PRO_MODEL = "gemini-3.5-flash";
// Image generation needs paid-tier quota. Unset = disabled (pipeline
// degrades to text-only posts, image prompts still saved for later).
export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "";

// ─── ROUND-ROBIN POOL + RATE LIMIT ──────────────────────────────────────────
// N keys × M models rotated per call; one global dispatch queue spaced
// MIN_GAP_MS apart keeps every (key, model) combo under 15 calls/min.
// ponytail: per-isolate limiter — exact enough for a single-admin app.

const MIN_GAP_MS = 1100;

function keyPool(): string[] {
  const multi = process.env.GEMINI_API_KEYS;
  if (multi) return multi.split(",").map((k) => k.trim()).filter(Boolean);
  return process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : [];
}

function modelPool(): string[] {
  const multi = process.env.GEMINI_MODELS;
  if (multi) return multi.split(",").map((m) => m.trim()).filter(Boolean);
  return ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];
}

let rrIndex = 0;
let queueTail: Promise<void> = Promise.resolve();
let lastDispatch = 0;

/** Serialize all Gemini calls with a minimum gap between dispatches. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const wait = lastDispatch + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastDispatch = Date.now();
  });
  queueTail = run.catch(() => {});
  return run.then(task);
}

function nextCombo(explicitModel?: string): { key: string; model: string } {
  const keys = keyPool();
  const models = modelPool();
  if (keys.length === 0) throw new Error("GEMINI_API_KEY(S) not set in environment variables");
  const i = rrIndex++;
  return {
    key: keys[i % keys.length],
    model: explicitModel && explicitModel !== "auto" ? explicitModel : models[Math.floor(i / keys.length) % models.length],
  };
}

interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  agent?: "manager" | "twitter" | "instagram" | "facebook" | "linkedin";
  action?: string;
  model?: string;
}

// ─── CORE API CALL ──────────────────────────────────────────────────────────

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

async function callGemini(
  parts: GeminiPart[],
  options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    model?: string;
    responseModalities?: string[];
  }
): Promise<{ text: string; image?: { mimeType: string; data: string } }> {
  const { key: apiKey, model } = nextCombo(options?.model);

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: options?.temperature ?? 0.8,
      maxOutputTokens: options?.maxTokens ?? 4096,
      ...(options?.responseModalities ? { responseModalities: options.responseModalities } : {}),
    },
  };
  if (options?.systemPrompt) {
    body.systemInstruction = { parts: [{ text: options.systemPrompt }] };
  }

  const response = await enqueue(() =>
    fetch(`${GEMINI_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    })
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    // Text-only calls overflow to Groq when Gemini rate-limits
    if (response.status === 429 && !options?.responseModalities?.includes("IMAGE")) {
      const groqText = await tryGroq(parts, options?.systemPrompt, options?.temperature);
      if (groqText !== null) return { text: groqText };
    }
    throw new Error(`Gemini API error (${response.status}): ${errorText.slice(0, 300) || response.statusText}`);
  }

  const data = await response.json();
  const outParts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];

  let text = "";
  let image: { mimeType: string; data: string } | undefined;
  for (const p of outParts) {
    if (p.text) text += p.text;
    if (p.inlineData) image = p.inlineData;
  }

  if (!text && !image) {
    const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason;
    throw new Error(`Empty Gemini response${reason ? ` (${reason})` : ""}`);
  }

  return { text, image };
}

// ─── GROQ OVERFLOW ──────────────────────────────────────────────────────────
// When Gemini 429s, text calls fall back to Groq (free tier: ~1k req/day).

async function tryGroq(
  parts: GeminiPart[],
  systemPrompt?: string,
  temperature?: number
): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  // Vision/image parts can't go to this text model
  if (parts.some((p) => p.inlineData)) return null;

  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: parts.map((p) => p.text || "").join("\n") });

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages,
        temperature: temperature ?? 0.8,
        max_tokens: 4096,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

// ─── LOGGING ────────────────────────────────────────────────────────────────

async function logCall(
  agent: GenerateOptions["agent"],
  action: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  durationMs: number,
  success: boolean,
  error?: string,
  tokensUsed?: number
) {
  try {
    await db.insert(agentLogs).values({
      agent: agent || "manager",
      action,
      input,
      output,
      durationMs,
      success,
      error: error || null,
      tokensUsed: tokensUsed || null,
    });
  } catch {
    console.error("Failed to log agent call");
  }
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

/**
 * Generate text using Gemini.
 */
// Inter-agent chatter runs on Groq first — saves Gemini quota for real work
// (drafts, research, analysis). Falls through to Gemini when Groq is out.
const CHAT_ACTIONS = /^(chat_|route$|team_signoff|team_critique)/;

export async function generate(
  systemPrompt: string,
  userPrompt: string,
  options?: GenerateOptions
): Promise<string> {
  const startTime = Date.now();

  // Explicit model = caller wants that model (e.g. deep mode) — skip Groq
  if (options?.action && CHAT_ACTIONS.test(options.action) && (!options.model || options.model === "auto")) {
    const groqText = await tryGroq([{ text: userPrompt }], systemPrompt, options?.temperature);
    if (groqText !== null) {
      await logCall(
        options?.agent,
        `${options.action} (groq)`,
        { systemPrompt: systemPrompt.slice(0, 200), userPrompt: userPrompt.slice(0, 200) },
        { response: groqText.slice(0, 500) },
        Date.now() - startTime,
        true
      );
      return groqText;
    }
  }

  try {
    const { text } = await callGemini([{ text: userPrompt }], {
      systemPrompt,
      temperature: options?.temperature ?? 0.8,
      maxTokens: options?.maxTokens ?? 4096,
      model: options?.model || DEFAULT_MODEL,
    });

    await logCall(
      options?.agent,
      options?.action || "generate",
      { systemPrompt: systemPrompt.slice(0, 200), userPrompt: userPrompt.slice(0, 200) },
      { response: text.slice(0, 500) },
      Date.now() - startTime,
      true
    );

    return text;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    await logCall(
      options?.agent,
      options?.action || "generate",
      { systemPrompt: systemPrompt.slice(0, 200), userPrompt: userPrompt.slice(0, 200) },
      { error: errorMsg },
      Date.now() - startTime,
      false,
      errorMsg
    );
    throw err;
  }
}

/**
 * Generate structured JSON output.
 */
export async function generateJSON<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  options?: GenerateOptions
): Promise<T> {
  const jsonSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code blocks, no explanation. Just the raw JSON object or array.`;

  const response = await generate(jsonSystemPrompt, userPrompt, {
    ...options,
    temperature: options?.temperature ?? 0.6,
    action: options?.action || "generate_json",
  });

  const cleaned = response
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    throw new Error(`Failed to parse JSON from AI response: ${cleaned.slice(0, 200)}`);
  }
}

/**
 * Generate an image with Gemini. Returns raw bytes + mime type.
 */
export async function generateImage(
  prompt: string,
  options?: { agent?: GenerateOptions["agent"]; action?: string }
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (!IMAGE_MODEL) {
    throw new Error(
      "Image generation disabled — no image model quota on the current Gemini plan. Set GEMINI_IMAGE_MODEL when you upgrade."
    );
  }
  const startTime = Date.now();

  try {
    const { image } = await callGemini([{ text: prompt }], {
      model: IMAGE_MODEL,
      responseModalities: ["TEXT", "IMAGE"],
      temperature: 0.9,
    });

    if (!image) throw new Error("Gemini returned no image data");

    await logCall(
      options?.agent,
      options?.action || "generate_image",
      { prompt: prompt.slice(0, 300) },
      { mimeType: image.mimeType, bytes: image.data.length },
      Date.now() - startTime,
      true
    );

    return {
      bytes: Uint8Array.from(atob(image.data), (c) => c.charCodeAt(0)),
      mimeType: image.mimeType || "image/png",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    await logCall(
      options?.agent,
      options?.action || "generate_image",
      { prompt: prompt.slice(0, 300) },
      { error: errorMsg },
      Date.now() - startTime,
      false,
      errorMsg
    );
    throw err;
  }
}

/**
 * Analyze an image (URL or data URL) with a vision prompt.
 */
export async function analyzeImage(
  imageSource: string,
  prompt: string,
  options?: GenerateOptions
): Promise<string> {
  let mimeType = "image/png";
  let data: string;

  if (imageSource.startsWith("data:")) {
    const match = imageSource.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) throw new Error("Invalid data URL");
    mimeType = match[1];
    data = match[2];
  } else {
    const res = await fetch(imageSource);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    mimeType = res.headers.get("content-type") || "image/png";
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i += 8192) {
      binary += String.fromCharCode(...buf.subarray(i, i + 8192));
    }
    data = btoa(binary);
  }

  const { text } = await callGemini(
    [{ inlineData: { mimeType, data } }, { text: prompt }],
    {
      systemPrompt: undefined,
      model: options?.model || DEFAULT_MODEL,
      temperature: options?.temperature ?? 0.4,
    }
  );
  return text;
}

/**
 * Convenience: generate function for Platform Bot generateFn signature.
 */
export function createServerGenerateFn(
  agent?: GenerateOptions["agent"],
  action?: string
): (systemPrompt: string, userPrompt: string) => Promise<string> {
  return (systemPrompt: string, userPrompt: string) =>
    generate(systemPrompt, userPrompt, { agent, action });
}
