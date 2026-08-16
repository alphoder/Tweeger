import { NextRequest, NextResponse } from "next/server";
import { getBot } from "@/lib/telegram";

/**
 * POST /api/telegram/webhook
 * Telegram webhook endpoint — receives updates from Telegram.
 * Authenticated via X-Telegram-Bot-Api-Secret-Token (set with setWebhook).
 *
 * Calls bot.handleUpdate directly instead of grammy's webhookCallback,
 * which stalls under OpenNext on Cloudflare Workers.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    console.error("[Telegram Webhook] TELEGRAM_WEBHOOK_SECRET not set — rejecting");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  const got = request.headers.get("x-telegram-bot-api-secret-token");
  if (got !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const update = await request.json();
    await getBot().handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Telegram Webhook] Error:", err);
    // Return 200 so Telegram doesn't endlessly retry a poison update
    return NextResponse.json({ ok: false });
  }
}

// Telegram sends GET to verify the webhook
export async function GET() {
  return NextResponse.json({ ok: true, bot: "FineTweet" });
}
