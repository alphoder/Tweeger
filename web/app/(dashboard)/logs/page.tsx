import { db } from "@/lib/db";
import { agentLogs } from "@/lib/schema";
import { desc, eq, gte, sql, count, avg } from "drizzle-orm";
import {
  Terminal,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Stat } from "@/components/page-shell";

const AGENT_COLORS: Record<string, string> = {
  manager: "bg-zinc-500/20 text-zinc-400",
  twitter: "bg-zinc-500/20 text-zinc-400",
  instagram: "bg-zinc-600/20 text-zinc-200",
  facebook: "bg-blue-500/20 text-blue-400",
  linkedin: "bg-blue-600/20 text-blue-400",
};

async function getLogsData() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    const [logs, statsResult] = await Promise.all([
      // Recent logs
      db
        .select()
        .from(agentLogs)
        .orderBy(desc(agentLogs.createdAt))
        .limit(50),

      // Today's stats
      db
        .select({
          totalCalls: count(),
          successCount: sql<number>`count(*) filter (where ${agentLogs.success} = true)`,
          avgDuration: avg(agentLogs.durationMs),
          totalTokens: sql<number>`coalesce(sum(${agentLogs.tokensUsed}), 0)`,
        })
        .from(agentLogs)
        .where(gte(agentLogs.createdAt, todayStart)),
    ]);

    // Who worked today — mapped to team personas via action prefixes
    const todayLogs = await db
      .select({ action: agentLogs.action, n: count() })
      .from(agentLogs)
      .where(gte(agentLogs.createdAt, todayStart))
      .groupBy(agentLogs.action);

    const PERSONA: [string, RegExp][] = [
      ["🔭 Saturn (Researcher)", /^(team_research|analyze_positioning|chat_researcher|research)/],
      ["✍️ Mercury (Copywriter)", /^(team_draft|team_revise|analyze_ideas|chat_copywriter)/],
      ["🎨 Venus (Visual)", /^(team_visual|team_image|analyze_.*image|chat_visual|.*generate_image)/],
      ["🔎 Mars (Critic)", /^(team_critique|analyze_writing|chat_critic)/],
      ["🪐 Pluto (Antigravity)", /^antigravity/],
      ["🧠 Jupiter (Manager)", /^(team_signoff|analyze_plan|route|chat_manager)/],
    ];
    const byPersona: Record<string, number> = {};
    let other = 0;
    for (const row of todayLogs) {
      const hit = PERSONA.find(([, rx]) => rx.test(row.action));
      if (hit) byPersona[hit[0]] = (byPersona[hit[0]] || 0) + Number(row.n);
      else other += Number(row.n);
    }
    if (other) byPersona["⚙️ System / other"] = other;

    const stats = statsResult[0] || {
      totalCalls: 0,
      successCount: 0,
      avgDuration: 0,
      totalTokens: 0,
    };

    return {
      logs,
      byPersona,
      stats: {
        totalCalls: Number(stats.totalCalls) || 0,
        successRate:
          Number(stats.totalCalls) > 0
            ? Math.round(
                (Number(stats.successCount) / Number(stats.totalCalls)) * 100
              )
            : 0,
        avgDuration: Math.round(Number(stats.avgDuration) || 0),
        totalTokens: Number(stats.totalTokens) || 0,
      },
    };
  } catch {
    return {
      logs: [],
      byPersona: {} as Record<string, number>,
      stats: { totalCalls: 0, successRate: 0, avgDuration: 0, totalTokens: 0 },
    };
  }
}

export default async function AgentLogsPage() {
  const { logs, stats, byPersona } = await getLogsData();

  return (
    <div className="space-y-6">
      <PageHeader title="Agent Logs" description="Every AI call — model, duration, outcome" />

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Calls today" value={stats.totalCalls} />
        <Stat label="Success rate" value={`${stats.successRate}%`} />
        <Stat label="Avg duration" value={`${(stats.avgDuration / 1000).toFixed(1)}s`} />
        <Stat label="Tokens used" value={stats.totalTokens.toLocaleString()} />
      </div>

      {/* Who worked today */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Who worked today</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(byPersona).length === 0 ? (
            <p className="text-sm text-zinc-500">No agent activity yet today.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(byPersona)
                .sort((a, b) => b[1] - a[1])
                .map(([name, n]) => (
                  <div key={name} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                    <span className="text-sm text-zinc-300">{name}</span>
                    <span className="font-mono text-sm font-semibold text-zinc-200 tabular-nums">{n}</span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Recent Activity ({logs.length} entries)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] text-zinc-600 uppercase tracking-wider font-medium">
                <span className="col-span-2">Time</span>
                <span className="col-span-1">Agent</span>
                <span className="col-span-3">Action</span>
                <span className="col-span-1">Status</span>
                <span className="col-span-1">Duration</span>
                <span className="col-span-1">Tokens</span>
                <span className="col-span-3">Details</span>
              </div>

              {logs.map((log) => (
                <div
                  key={log.id}
                  className="grid grid-cols-12 gap-2 rounded-lg bg-zinc-800/30 px-3 py-2.5 items-center hover:bg-zinc-800/50 transition-colors"
                >
                  <span className="col-span-2 text-xs text-zinc-500">
                    {new Date(log.createdAt).toLocaleString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })}
                  </span>
                  <span className="col-span-1">
                    <Badge
                      className={`text-[9px] ${AGENT_COLORS[log.agent] || "bg-zinc-700 text-zinc-300"}`}
                    >
                      {log.agent}
                    </Badge>
                  </span>
                  <span className="col-span-3 text-xs text-zinc-300 truncate">
                    {log.action}
                  </span>
                  <span className="col-span-1">
                    {log.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </span>
                  <span className="col-span-1 text-xs text-zinc-500">
                    {log.durationMs ? `${log.durationMs}ms` : "—"}
                  </span>
                  <span className="col-span-1 text-xs text-zinc-500">
                    {log.tokensUsed || "—"}
                  </span>
                  <span className="col-span-3 text-xs text-zinc-600 truncate">
                    {log.error
                      ? `Error: ${log.error}`
                      : log.output
                        ? JSON.stringify(log.output).slice(0, 60)
                        : "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-600">
              <Terminal className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No agent activity yet</p>
              <p className="text-xs mt-1">
                Agent calls will appear here as you generate content
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

