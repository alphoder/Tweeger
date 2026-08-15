import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teamFeed } from "@/lib/schema";
import { desc } from "drizzle-orm";

/** GET /api/team/feed?limit=50 — the shared team room stream. */
export async function GET(request: NextRequest) {
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit")) || 50, 200);
  const rows = await db.select().from(teamFeed).orderBy(desc(teamFeed.createdAt)).limit(limit);
  return NextResponse.json({ messages: rows.reverse() });
}
