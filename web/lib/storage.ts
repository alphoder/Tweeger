// ─── IMAGE STORAGE ──────────────────────────────────────────────────────────
// R2 in production (Cloudflare Workers); local public/uploads in `next dev`
// when no R2 binding is available.

import { getCloudflareContext } from "@opennextjs/cloudflare";

// Minimal structural type — the real R2Bucket type lives in
// worker-configuration.d.ts, which is excluded from the Next.js typecheck.
interface R2Bucket {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    httpMetadata?: { contentType?: string };
  } | null>;
}

function getBucket(): R2Bucket | null {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as { IMAGES?: R2Bucket }).IMAGES ?? null;
  } catch {
    return null;
  }
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Store image bytes; returns the public URL path to serve it from. */
export async function saveImage(
  bytes: Uint8Array,
  contentType: string,
  prefix = "img"
): Promise<{ url: string; key: string; size: number }> {
  const key = `${prefix}/${crypto.randomUUID()}.${EXT[contentType] || "png"}`;
  const bucket = getBucket();

  if (bucket) {
    await bucket.put(key, bytes.buffer as ArrayBuffer, { httpMetadata: { contentType } });
    return { url: `/api/images/raw/${key}`, key, size: bytes.length };
  }

  // Local dev fallback: write to public/uploads
  try {
    const { writeFile, mkdir } = await import("fs/promises");
    const { join, dirname } = await import("path");
    const filepath = join(process.cwd(), "public", "uploads", key);
    await mkdir(dirname(filepath), { recursive: true });
    await writeFile(filepath, bytes);
    return { url: `/uploads/${key}`, key, size: bytes.length };
  } catch {
    // ponytail: no R2 binding and no filesystem (Workers before R2 is
    // enabled) — store as a data URL in the DB. Upgrade path: enable R2,
    // create bucket "axon-images", add the binding, redeploy.
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return { url: `data:${contentType};base64,${btoa(binary)}`, key, size: bytes.length };
  }
}

/** Read image bytes back (R2 only — dev files are served statically). */
export async function getImage(
  key: string
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const bucket = getBucket();
  if (!bucket) return null;
  const obj = await bucket.get(key);
  if (!obj) return null;
  return {
    bytes: await obj.arrayBuffer(),
    contentType: obj.httpMetadata?.contentType || "image/png",
  };
}
