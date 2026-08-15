import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { images } from "@/lib/schema";
import { eq, desc, and, sql } from "drizzle-orm";

/**
 * GET /api/images — List images with filters and pagination.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get("source");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  try {
    const conditions = [];

    if (source) {
      conditions.push(eq(images.source, source as "ai_generated" | "uploaded" | "researched" | "stock"));
    }
    if (category) {
      conditions.push(eq(images.category, category));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(images)
      .where(where)
      .orderBy(desc(images.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ images: results, page, limit });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch images" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/images — Update image metadata.
 * Body: { id, tags?, category?, platformFit? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, tags, category, platformFit } = body;

    if (!id) {
      return NextResponse.json({ error: "Image ID required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (tags !== undefined) updateData.tags = tags;
    if (category !== undefined) updateData.category = category;
    if (platformFit !== undefined) updateData.platformFit = platformFit;

    const [updated] = await db
      .update(images)
      .set(updateData)
      .where(eq(images.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update image" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/images?id=123 — Delete image record.
 */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Image ID required" }, { status: 400 });
  }

  try {
    await db.delete(images).where(eq(images.id, parseInt(id)));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete image" },
      { status: 500 }
    );
  }
}
