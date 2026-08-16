import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, verifySessionToken, timingSafeEqualStr } from "@/lib/session";

const SESSION_COOKIE = "axon_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// ponytail: in-memory rate limit, per instance. Fine for a single-admin app —
// upgrade to DB/KV-backed if this ever becomes multi-tenant.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

// ─── TELEGRAM OTP ───────────────────────────────────────────────────────────
// One-time login codes delivered to the admin's Telegram. Stored (hashed)
// in the agent_memory KV row "__otp_login" — single admin, single code.

const OTP_KEY = "__otp_login";
const OTP_TTL_MS = 5 * 60 * 1000;

async function otpHash(code: string): Promise<string> {
  const data = new TextEncoder().encode(`otp:${code}:${process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function issueOtp(): Promise<void> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const { updateWorkingMemory } = await import("@/lib/agents/team");
  await updateWorkingMemory(OTP_KEY, `${await otpHash(code)}:${Date.now() + OTP_TTL_MS}`);
  const { notifyAdmin } = await import("@/lib/telegram");
  await notifyAdmin(`🔐 *FineTweet login code:* \`${code}\`\n\nValid for 5 minutes. Ignore if this wasn't you.`);
}

async function consumeOtp(code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const { getMemory, updateWorkingMemory } = await import("@/lib/agents/team");
  const { working } = await getMemory(OTP_KEY);
  const [hash, expiry] = working.split(":");
  if (!hash || !expiry || Number(expiry) < Date.now()) return false;
  if (!timingSafeEqualStr(await otpHash(code), hash)) return false;
  await updateWorkingMemory(OTP_KEY, ""); // single use
  return true;
}

/**
 * POST /api/auth — Login (password or Telegram OTP)
 * Body: { requestOtp: true }  → sends a 6-digit code to the admin's Telegram
 * Body: { password }          → ADMIN_PASSWORD or a valid OTP code
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
    if (rateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 }
      );
    }

    const body = await request.json();

    if (body.requestOtp) {
      await issueOtp();
      return NextResponse.json({ sent: true });
    }

    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return NextResponse.json(
        { error: "Server not configured — ADMIN_PASSWORD not set" },
        { status: 500 }
      );
    }

    const valid = timingSafeEqualStr(password, adminPassword) || (await consumeOtp(password));
    if (!valid) {
      return NextResponse.json({ error: "Invalid password or code" }, { status: 401 });
    }

    const sessionToken = await createSessionToken(SESSION_MAX_AGE);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

/**
 * GET /api/auth — Check session
 */
export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  const valid = await verifySessionToken(session?.value);

  if (!valid) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true });
}

/**
 * DELETE /api/auth — Logout
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ success: true });
}
