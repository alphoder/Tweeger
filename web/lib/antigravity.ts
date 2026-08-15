// ─── ANTIGRAVITY AGENT (Interactions API) ───────────────────────────────────
// Google's managed autonomous agent — plans, reasons, runs code, and searches
// the web in a sandbox. Reserved for /doitdeep: expensive, powerful, budgeted.
// ponytail: text output only for now — image extraction from the sandbox when
// an image model quota exists.

import { db } from "./db";
import { agentLogs } from "./schema";
import { and, gte, like, count } from "drizzle-orm";

const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const AGENT = "antigravity-preview-05-2026";
export const DAILY_BUDGET = 60;

function keys(): string[] {
  const multi = process.env.GEMINI_API_KEYS;
  if (multi) return multi.split(",").map((k) => k.trim()).filter(Boolean);
  return process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : [];
}

let agIndex = 0;

/** Calls used today (durable — counted from agent_logs). */
export async function antigravityCallsToday(): Promise<number> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: count() })
    .from(agentLogs)
    .where(and(like(agentLogs.action, "antigravity%"), gte(agentLogs.createdAt, dayStart)));
  return row?.n ?? 0;
}

/**
 * Run a task on the Antigravity agent. Throws when the daily budget is spent.
 * Returns the agent's final text output.
 */
export async function runAntigravity(
  task: string,
  opts?: { action?: string; maxTotalTokens?: number }
): Promise<string> {
  const used = await antigravityCallsToday();
  if (used >= DAILY_BUDGET) {
    throw new Error(`Antigravity daily budget spent (${used}/${DAILY_BUDGET}). Resets 00:00 UTC.`);
  }

  const pool = keys();
  if (!pool.length) throw new Error("GEMINI_API_KEY(S) not set");
  const key = pool[agIndex++ % pool.length];

  const startTime = Date.now();
  const action = opts?.action || "antigravity_run";

  const res = await fetch(INTERACTIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      agent: AGENT,
      input: task,
      environment: { type: "remote" },
      background: false,
      agent_config: { type: "antigravity", max_total_tokens: String(opts?.maxTotalTokens ?? 60000) },
    }),
  });

  const data = (await res.json()) as {
    status?: string;
    steps?: { type: string; content?: { type: string; text?: string }[] }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    await db.insert(agentLogs).values({
      agent: "manager",
      action,
      input: { task: task.slice(0, 300) },
      output: { error: msg },
      durationMs: Date.now() - startTime,
      success: false,
      error: msg,
    });
    throw new Error(`Antigravity error: ${msg}`);
  }

  let text = "";
  for (const step of data.steps ?? []) {
    if (step.type === "model_output") {
      for (const c of step.content ?? []) {
        if (c.type === "text" && c.text) text += c.text;
      }
    }
  }

  await db.insert(agentLogs).values({
    agent: "manager",
    action,
    input: { task: task.slice(0, 300) },
    output: { response: text.slice(0, 500), status: data.status },
    durationMs: Date.now() - startTime,
    success: true,
  });

  return text.trim();
}
