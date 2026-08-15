// ─── INSTRUMENTATION ─────────────────────────────────────────────────────────
// Next.js instrumentation hook — runs once on server startup.
// In local dev we run node-cron; in production (Cloudflare Workers) the
// scheduled handler + /api/cron drives jobs, and the Telegram webhook is set
// once at deploy time.

export async function register() {
  if (typeof window !== "undefined") return;
  if (process.env.NODE_ENV !== "development") return;

  try {
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
    console.log("[Instrumentation] Scheduler started (dev)");
  } catch (err) {
    console.error("[Instrumentation] Failed to start scheduler:", err);
  }
}
