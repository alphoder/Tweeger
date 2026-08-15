import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session";

// Routes with no cookie auth. /api/telegram/webhook and /api/cron carry their
// own secret-token auth inside the route handler.
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/telegram/webhook", // secret-token auth in handler
  "/api/cron", // Bearer CRON_SECRET auth in handler
  "/m/review", // signed-token mobile review page
  "/api/m/review", // signed-token auth in handler
  "/api/images/raw", // unguessable UUID keys; platforms fetch media from here
  "/uploads", // dev-mode stored images
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Static files and Next.js internals only — no blanket "contains a dot" bypass
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  // Internal service auth (Telegram bot handlers, cron) — Bearer CRON_SECRET
  if (pathname.startsWith("/api/")) {
    const auth = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && auth === `Bearer ${cronSecret}`) {
      return NextResponse.next();
    }
  }

  const session = request.cookies.get("axon_session");
  const valid = await verifySessionToken(session?.value);

  if (!valid) {
    // APIs get 401, pages get redirected to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "same-origin");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
