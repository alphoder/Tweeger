import { db } from "@/lib/db";
import { queue, posted, aiInsights, agentLogs, reviewQueue, teamFeed } from "@/lib/schema";
import { eq, desc, gte, and, count } from "drizzle-orm";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { PageHeader, Stat, SectionTitle } from "@/components/page-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { agentColor } from "@/lib/agents/colors";

// ─── DATA ───────────────────────────────────────────────────────────────────

async function getDashboardData() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [queued, postedToday, pendingReviews, callsToday, feed, insights, recentLogs] =
      await Promise.all([
        db.select({ value: count() }).from(queue).where(and(eq(queue.status, "scheduled"), gte(queue.scheduledTime, now))),
        db.select({ value: count() }).from(posted).where(gte(posted.postedAt, todayStart)),
        db.select({ value: count() }).from(reviewQueue).where(eq(reviewQueue.reviewStatus, "pending_review")),
        db.select({ value: count() }).from(agentLogs).where(gte(agentLogs.createdAt, todayStart)),
        db.select().from(teamFeed).orderBy(desc(teamFeed.createdAt)).limit(8),
        db.select().from(aiInsights).where(gte(aiInsights.createdAt, sevenDaysAgo)).orderBy(desc(aiInsights.createdAt)).limit(4),
        db.select().from(agentLogs).orderBy(desc(agentLogs.createdAt)).limit(6),
      ]);

    return {
      queued: queued[0]?.value ?? 0,
      postedToday: postedToday[0]?.value ?? 0,
      pendingReviews: pendingReviews[0]?.value ?? 0,
      callsToday: callsToday[0]?.value ?? 0,
      feed,
      insights,
      recentLogs,
    };
  } catch {
    return { queued: 0, postedToday: 0, pendingReviews: 0, callsToday: 0, feed: [], insights: [], recentLogs: [] };
  }
}

// ─── PAGE ───────────────────────────────────────────────────────────────────

export default async function CommandCenterPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8">
      <AutoRefresh seconds={15} />
      <PageHeader
        title="Command Center"
        description="Your agent team, at a glance"
      >
        <span className="flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Automation live
        </span>
      </PageHeader>

      {/* Review call-to-action — the one thing that needs the boss */}
      {data.pendingReviews > 0 && (
        <Link
          href="/review"
          className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4 transition-colors hover:border-zinc-500"
        >
          <div>
            <p className="text-sm font-medium text-zinc-100">
              {data.pendingReviews} post{data.pendingReviews !== 1 ? "s" : ""} waiting for your approval
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">Approve, edit, or reject in the Review Deck</p>
          </div>
          <ArrowRight className="h-4 w-4 text-zinc-400" />
        </Link>
      )}

      {/* Pipeline numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pending review" value={data.pendingReviews} />
        <Stat label="Scheduled" value={data.queued} />
        <Stat label="Posted today" value={data.postedToday} />
        <Stat label="Agent calls today" value={data.callsToday} />
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Team activity — the room, with each agent in their color */}
        <section className="lg:col-span-3">
          <SectionTitle
            title="Latest from the team"
            action={
              <Link href="/team" className="text-xs text-zinc-500 hover:text-zinc-300">
                Open Team Room →
              </Link>
            }
          />
          {data.feed.length > 0 ? (
            <div className="space-y-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
              {data.feed.map((m) => {
                const c = agentColor(m.agentKey);
                return (
                  <div key={m.id} className="flex gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ring-1 ${c.bg} ${c.ring}`}>
                      {m.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className={`font-medium ${c.text}`}>{m.name}</span>{" "}
                        <span className="text-xs text-zinc-600">
                          {new Date(m.createdAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-sm text-zinc-400">{m.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-6 py-12 text-center">
              <p className="text-sm text-zinc-400">The team hasn&apos;t worked yet.</p>
              <p className="mt-1 text-sm text-zinc-600">
                Send <span className="font-mono text-zinc-300">/build</span> to the Telegram bot — research,
                drafting, critique, and sign-off will land here.
              </p>
            </div>
          )}
        </section>

        {/* Right rail: insights + raw call log */}
        <div className="space-y-8 lg:col-span-2">
          <section>
            <SectionTitle
              title="What the AI learned"
              action={
                <Link href="/analytics" className="text-xs text-zinc-500 hover:text-zinc-300">
                  Analytics →
                </Link>
              }
            />
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
              {data.insights.length > 0 ? (
                <ul className="space-y-3">
                  {data.insights.map((i) => (
                    <li key={i.id} className="text-sm leading-relaxed text-zinc-400">
                      {i.insight}
                      <span className="ml-2 text-xs text-zinc-600">{i.type}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-center text-sm text-zinc-600">
                  Insights appear once posts start going out.
                </p>
              )}
            </div>
          </section>

          <section>
            <SectionTitle
              title="Recent calls"
              action={
                <Link href="/logs" className="text-xs text-zinc-500 hover:text-zinc-300">
                  All logs →
                </Link>
              }
            />
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-2">
              {data.recentLogs.length > 0 ? (
                data.recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs">
                    {log.success ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3 w-3 shrink-0 text-red-500" />
                    )}
                    <span className="flex-1 truncate text-zinc-400">{log.action}</span>
                    <span className="shrink-0 tabular-nums text-zinc-600">
                      {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : ""}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-zinc-600">No calls yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
