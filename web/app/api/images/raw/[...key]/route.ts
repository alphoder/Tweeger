import { NextRequest, NextResponse } from "next/server";
import { getImage } from "@/lib/storage";

/**
 * GET /api/images/raw/[...key] — serve an image from R2.
 * Public route (unguessable UUID keys) so platform APIs can fetch media.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const fullKey = key.join("/");

  // Only serve well-formed keys — no traversal
  if (!/^[a-z0-9_-]+\/[a-f0-9-]+\.(png|jpg|gif|webp)$/i.test(fullKey)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const img = await getImage(fullKey);
  if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(img.bytes, {
    headers: {
      "Content-Type": img.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
