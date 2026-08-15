import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentCalendars } from "@/lib/schema";
import { eq, desc, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const [data, [totalRow]] = await Promise.all([
      db
        .select()
        .from(contentCalendars)
        .orderBy(desc(contentCalendars.createdAt))
        .limit(limit),
      db.select({ total: count() }).from(contentCalendars),
    ]);

    return NextResponse.json({
      calendars: data,
      total: totalRow?.total || 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch calendars" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, weeks, platforms, targetIndustries, items } = body;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (weeks || 1) * 7);

    const [created] = await db
      .insert(contentCalendars)
      .values({
        name: name || `Content Plan — ${startDate.toLocaleDateString("en-IN")}`,
        startDate,
        endDate,
        weeks: weeks || 1,
        platforms: platforms || ["twitter"],
        targetIndustries: targetIndustries || [],
        items: items || [],
      })
      .returning();

    return NextResponse.json({ calendar: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create calendar" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, items, name } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (items !== undefined) setValues.items = items;
    if (name !== undefined) setValues.name = name;

    const [updated] = await db
      .update(contentCalendars)
      .set(setValues)
      .where(eq(contentCalendars.id, id))
      .returning();

    return NextResponse.json({ calendar: updated });
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

    await db.delete(contentCalendars).where(eq(contentCalendars.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
