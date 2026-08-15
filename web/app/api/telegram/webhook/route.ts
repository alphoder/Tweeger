import { NextRequest, NextResponse } from "next/server";
import { getBot } from "@/lib/telegram";
import { webhookCallback } from "grammy/web";

/**
 * POST /api/telegram/webhook
 * Telegram webhook endpoint — receives updates from Telegram.
 * Authenticated via X-Telegram-Bot-Api-Secret-Token (set with setWebhook).
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
    const bot = getBot();
    const handler = webhookCallback(bot, "std/http");
    return handler(request);
  } catch (err) {
    console.error("[Telegram Webhook] Error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// Telegram sends GET to verify the webhook
export async function GET() {
  return NextResponse.json({ ok: true, bot: "Axon Social AI" });
}
