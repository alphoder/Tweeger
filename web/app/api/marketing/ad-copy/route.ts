import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adCopies } from "@/lib/schema";
import { eq, desc, and, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const industry = searchParams.get("industry");
    const limit = parseInt(searchParams.get("limit") || "20");

    const conditions = [];
    if (platform) {
      conditions.push(
        eq(adCopies.platform, platform as "twitter" | "linkedin" | "instagram" | "facebook")
      );
    }
    if (industry) {
      conditions.push(eq(adCopies.targetIndustry, industry));
    }

    const [data, [totalRow]] = await Promise.all([
      db
        .select()
        .from(adCopies)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(adCopies.createdAt))
        .limit(limit),
      db
        .select({ total: count() })
        .from(adCopies)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    return NextResponse.json({ adCopies: data, total: totalRow?.total || 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch ad copies" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productName, platform, targetIndustry, variants, campaignId } = body;

    if (!productName || !platform) {
      return NextResponse.json(
        { error: "productName and platform are required" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(adCopies)
      .values({
        productName,
        platform,
        targetIndustry: targetIndustry || null,
        variants: variants || [],
        campaignId: campaignId || null,
      })
      .returning();

    return NextResponse.json({ adCopy: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create ad copy" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, variants } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const [updated] = await db
      .update(adCopies)
      .set({ variants })
      .where(eq(adCopies.id, id))
      .returning();

    return NextResponse.json({ adCopy: updated });
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

    await db.delete(adCopies).where(eq(adCopies.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
