import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const industry = searchParams.get("industry");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const conditions = [];
    if (status) {
      conditions.push(
        eq(campaigns.status, status as "draft" | "active" | "completed" | "paused" | "cancelled")
      );
    }
    if (industry) {
      conditions.push(eq(campaigns.targetIndustry, industry));
    }

    const [data, [totalRow]] = await Promise.all([
      db
        .select()
        .from(campaigns)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(campaigns.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(campaigns)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    return NextResponse.json({
      campaigns: data,
      total: totalRow?.total || 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      theme,
      description,
      targetIndustry,
      platforms,
      startDate,
      endDate,
      targetAudience,
      hashtagStrategy,
      contentPlan,
    } = body;

    if (!name || !theme || !startDate || !endDate) {
      return NextResponse.json(
        { error: "name, theme, startDate, and endDate are required" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(campaigns)
      .values({
        name,
        theme,
        description: description || "",
        targetIndustry: targetIndustry || null,
        platforms: platforms || ["twitter"],
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        targetAudience: targetAudience || null,
        hashtagStrategy: hashtagStrategy || null,
        contentPlan: contentPlan || [],
        status: "draft",
      })
      .returning();

    return NextResponse.json({ campaign: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create campaign" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const setValues: Record<string, unknown> = {};
    if (updates.status !== undefined) setValues.status = updates.status;
    if (updates.contentPlan !== undefined) setValues.contentPlan = updates.contentPlan;
    if (updates.name !== undefined) setValues.name = updates.name;
    if (updates.totalEngagement !== undefined)
      setValues.totalEngagement = updates.totalEngagement;
    setValues.updatedAt = new Date();

    const [updated] = await db
      .update(campaigns)
      .set(setValues)
      .where(eq(campaigns.id, id))
      .returning();

    return NextResponse.json({ campaign: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
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

    await db.delete(campaigns).where(eq(campaigns.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
