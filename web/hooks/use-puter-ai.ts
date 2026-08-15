"use client";

// ─── AI HOOK ─────────────────────────────────────────────────────────────────
// Same interface the dashboard always used, now backed by the server-side
// Gemini endpoint (/api/ai) instead of client-side Puter.js.

import { useState, useEffect, useCallback } from "react";

// ─── MODEL OPTIONS ───────────────────────────────────────────────────────────
export const AI_MODELS = {
  "Gemini Flash": "gemini-2.5-flash",
  "Gemini Pro": "gemini-2.5-pro",
} as const;

export type ModelName = keyof typeof AI_MODELS;
export const DEFAULT_MODEL: ModelName = "Gemini Flash";

interface ChatOptions {
  model?: ModelName;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

interface ImageOptions {
  width?: number;
  height?: number;
  model?: string;
}

interface UsePuterAIReturn {
  ready: boolean;
  loading: boolean;
  error: string | null;
  chat: (prompt: string, options?: ChatOptions) => Promise<string>;
  streamChat: (
    prompt: string,
    onChunk: (text: string) => void,
    options?: ChatOptions
  ) => Promise<string>;
  analyzeImage: (imageUrl: string, prompt: string, options?: ChatOptions) => Promise<string>;
  generateImage: (prompt: string, options?: ImageOptions) => Promise<string | null>;
}

async function callAI(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || `AI call failed (${res.status})`);
  return data;
}

// ─── HOOK ────────────────────────────────────────────────────────────────────

export function usePuterAI(): UsePuterAIReturn {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d) => {
        if (d.ready) setReady(true);
        else setError("Gemini API key not configured on the server.");
      })
      .catch(() => setError("Could not reach the AI endpoint."));
  }, []);

  const chat = useCallback(async (prompt: string, options?: ChatOptions): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const data = await callAI({
        mode: "chat",
        prompt,
        systemPrompt: options?.systemPrompt,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        model: options?.model ? AI_MODELS[options.model] : undefined,
      });
      return String(data.text ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI call failed";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ponytail: no SSE — one chunk with the full response keeps every caller working
  const streamChat = useCallback(
    async (prompt: string, onChunk: (text: string) => void, options?: ChatOptions): Promise<string> => {
      const text = await chat(prompt, options);
      onChunk(text);
      return text;
    },
    [chat]
  );

  const analyzeImage = useCallback(
    async (imageUrl: string, prompt: string): Promise<string> => {
      setLoading(true);
      setError(null);
      try {
        const data = await callAI({ mode: "vision", imageUrl, prompt });
        return String(data.text ?? "");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Vision call failed";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const generateImage = useCallback(async (prompt: string): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await callAI({ mode: "image", prompt });
      return (data.url as string) || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { ready, loading, error, chat, streamChat, analyzeImage, generateImage };
}
