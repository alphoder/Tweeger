import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { competitors } from "@/lib/schema";
import { eq, desc, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const [data, [totalRow]] = await Promise.all([
      db.select().from(competitors).orderBy(desc(competitors.analyzedAt)).limit(limit),
      db.select({ total: count() }).from(competitors),
    ]);

    return NextResponse.json({ competitors: data, total: totalRow?.total || 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch competitors" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, handle, platform, analysis, contentPatterns, profileData } = body;

    if (!name || !handle) {
      return NextResponse.json(
        { error: "name and handle are required" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(competitors)
      .values({
        name,
        handle,
        platform: platform || "twitter",
        profileData: profileData || {},
        analysis: analysis || {
          strengths: [],
          weaknesses: [],
          opportunities: [],
          recommendations: [],
        },
        contentPatterns: contentPatterns || {
          postingFrequency: "Unknown",
          commonHashtags: [],
          contentTypes: [],
          engagementPatterns: "Not analyzed",
        },
      })
      .returning();

    return NextResponse.json({ competitor: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create competitor" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "0");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await db.delete(competitors).where(eq(competitors.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
