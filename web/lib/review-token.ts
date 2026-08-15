// ─── SIGNED REVIEW LINKS ────────────────────────────────────────────────────
// Single-purpose HMAC tokens so the mobile review page works straight from a
// Telegram link without a login. Token = <exp>.<hmac("review:<id>:<exp>")>.

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("SESSION_SECRET or ADMIN_PASSWORD must be set");
  return s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createReviewToken(reviewId: number): Promise<string> {
  const exp = Date.now() + TOKEN_TTL_MS;
  return `${exp}.${await hmac(`review:${reviewId}:${exp}`)}`;
}

export async function verifyReviewToken(reviewId: number, token: string | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = await hmac(`review:${reviewId}:${exp}`);
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function reviewLink(reviewId: number): Promise<string> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = await createReviewToken(reviewId);
  return `${base}/m/review/${reviewId}?t=${token}`;
}
