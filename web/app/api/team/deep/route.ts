import { NextRequest, NextResponse } from "next/server";
import { runAntigravity, antigravityCallsToday, DAILY_BUDGET } from "@/lib/antigravity";
import { internalFetch } from "@/lib/telegram";
import { postToFeed } from "@/lib/agents/team";

/**
 * POST /api/team/deep — /doitdeep: the Antigravity agent does live web
 * research (it browses and reasons in a sandbox), then the team builds
 * posts from that research in deep mode (strongest models).
 *
 * Body: { direction?: string, count?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const research = await runAntigravity(
      `You are the deep researcher for a personal Twitter/X account positioned as a sharp builder in AI, ML, blockchain, and entrepreneurship.

Search the web for what is genuinely trending in these spaces RIGHT NOW (today). STRICT RECENCY: only include events and stories from after May 2026 — verify dates from the pages you read; discard anything older or undated. Find:
1. The 5 hottest specific topics/stories (with why each matters and its momentum)
2. What the smartest accounts are saying about each
3. Contrarian or underexplored angles a builder could take
${body.direction ? `\nExtra direction from the account owner: ${body.direction}` : ""}

Output a tight research brief (plain text, no markdown tables).`,
      { action: "antigravity_deep_research" }
    );

    await postToFeed(
      { key: "pluto", name: "Pluto", emoji: "🪐" },
      "Deep research done. Full brief attached — building from this.",
      [{ type: "research", label: "Deep research brief", content: research.slice(0, 6000) }]
    ).catch(() => {});

    // Feed the research into the team pipeline (deep mode)
    const res = await internalFetch("/api/team/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        direction: `Use this fresh deep-research brief as your trend data (it supersedes cached trends):\n\n${research.slice(0, 6000)}`,
        deep: true,
        count: Math.min(Number(body.count) || 1, 3),
      }),
    });
    const teamResult = await res.json();

    const used = await antigravityCallsToday();
    return NextResponse.json({
      ok: true,
      research,
      budget: { used, total: DAILY_BUDGET },
      team: teamResult,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Deep run failed" },
      { status: 500 }
    );
  }
}

/** GET — budget status */
export async function GET() {
  const used = await antigravityCallsToday();
  return NextResponse.json({ used, total: DAILY_BUDGET });
}
