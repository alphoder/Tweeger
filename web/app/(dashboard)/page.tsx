import { db } from "@/lib/db";
import { drafts, queue, posted, aiInsights, agentLogs, campaigns, trendCache, reviewQueue, brandProfiles, usageMeters } from "@/lib/schema";
import { eq, desc, gte, and, count, lte } from "drizzle-orm";
import {
  FileText,
  Clock,
  Send,
  Brain,
  Target,
  TrendingUp,
  PenTool,
  Image,
  Megaphone,
  CalendarRange,
  Search,
  BarChart3,
  CheckCircle2,
  XCircle,
  Terminal,
  Globe,
  CheckSquare,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── DATA FETCHING ───────────────────────────────────────────────────────────

async function getDashboardData() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  try {
    const [
      pendingDraftsResult,
      queuedPostsResult,
      postedTodayResult,
      recentInsightsResult,
      activeCampaignsResult,
      recentLogsResult,
      pendingReviewsResult,
      activeBrandResult,
      usageMeterResult,
    ] = await Promise.all([
      db.select({ value: count() }).from(drafts).where(eq(drafts.status, "pending")),
      db.select({ value: count() }).from(queue).where(and(eq(queue.status, "scheduled"), gte(queue.scheduledTime, now))),
      db.select({ value: count() }).from(posted).where(gte(posted.postedAt, todayStart)),
      db.select().from(aiInsights).where(gte(aiInsights.createdAt, sevenDaysAgo)).orderBy(desc(aiInsights.createdAt)).limit(3),
      db.select().from(campaigns).where(eq(campaigns.status, "active")).orderBy(desc(campaigns.updatedAt)).limit(3),
      db.select().from(agentLogs).orderBy(desc(agentLogs.createdAt)).limit(5),
      db.select({ value: count() }).from(reviewQueue).where(eq(reviewQueue.reviewStatus, "pending_review")),
      db.select().from(brandProfiles).orderBy(desc(brandProfiles.createdAt)).limit(1),
      db.select().from(usageMeters).where(and(gte(usageMeters.periodStart, periodStart), lte(usageMeters.periodEnd, periodEnd))).orderBy(desc(usageMeters.createdAt)).limit(1),
    ]);

    return {
      pendingDrafts: pendingDraftsResult[0]?.value ?? 0,
      queuedPosts: queuedPostsResult[0]?.value ?? 0,
      postedToday: postedTodayResult[0]?.value ?? 0,
      recentInsights: recentInsightsResult,
      activeCampaigns: activeCampaignsResult,
      recentLogs: recentLogsResult,
      pendingReviews: pendingReviewsResult[0]?.value ?? 0,
      activeBrand: activeBrandResult[0] ?? null,
      usageMeter: usageMeterResult[0] ?? null,
    };
  } catch {
    return {
      pendingDrafts: 0,
      queuedPosts: 0,
      postedToday: 0,
      recentInsights: [],
      activeCampaigns: [],
      recentLogs: [],
      pendingReviews: 0,
      activeBrand: null,
      usageMeter: null,
    };
  }
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const PLATFORMS = [
  { name: "Twitter", icon: "𝕏", connected: true, color: "text-zinc-400" },
  { name: "LinkedIn", icon: "in", connected: false, color: "text-blue-400" },
  { name: "Instagram", icon: "📷", connected: false, color: "text-zinc-200" },
  { name: "Facebook", icon: "f", connected: false, color: "text-blue-500" },
];

const QUICK_ACTIONS = [
  { label: "Create Post", href: "/content", icon: PenTool, color: "text-zinc-400" },
  { label: "Images", href: "/images", icon: Image, color: "text-zinc-200" },
  { label: "Campaign", href: "/marketing/campaigns", icon: Megaphone, color: "text-zinc-200" },
  { label: "Calendar", href: "/calendar", icon: CalendarRange, color: "text-green-400" },
  { label: "Trends", href: "/trends", icon: Search, color: "text-zinc-200" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, color: "text-blue-400" },
];

// ─── PAGE ───────────────────────────────────────────────────────────────────

export default async function CommandCenterPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-4">
      {/* Header + Platforms inline */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Command Center</h1>
          {data.activeBrand && (
            <Link href="/brand" className="text-xs text-zinc-500 hover:text-zinc-400 flex items-center gap-1 mt-0.5">
              <Globe className="h-3 w-3" />
              {data.activeBrand.name} · {data.activeBrand.industry}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {PLATFORMS.map((p) => (
            <div key={p.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/60 text-xs">
              <span className={p.color}>{p.icon}</span>
              <span className="text-zinc-400 hidden sm:inline">{p.name}</span>
              <div className={`h-1.5 w-1.5 rounded-full ${p.connected ? "bg-green-500" : "bg-zinc-600"}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Review Deck CTA */}
      {data.pendingReviews > 0 && (
        <Link href="/review">
          <div className="flex items-center justify-between rounded-lg border border-zinc-500/20 bg-zinc-950/20 px-4 py-3 hover:bg-zinc-950/30 transition-colors">
            <div className="flex items-center gap-3">
              <CheckSquare className="h-4 w-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-200">
                {data.pendingReviews} post{data.pendingReviews !== 1 ? "s" : ""} ready for review
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-zinc-400" />
          </div>
        </Link>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <Metric icon={FileText} label="Drafts" value={data.pendingDrafts} color="text-zinc-200" />
        <Metric icon={Clock} label="Queued" value={data.queuedPosts} color="text-zinc-400" />
        <Metric icon={Send} label="Posted" value={data.postedToday} color="text-green-400" />
        <Metric icon={Brain} label="Insights" value={data.recentInsights.length} color="text-zinc-200" />
        <Metric icon={Target} label="Campaigns" value={data.activeCampaigns.length} color="text-zinc-200" />
      </div>

      {/* Quick Actions - compact horizontal strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-colors"
          >
            <a.icon className={`h-3.5 w-3.5 ${a.color}`} />
            {a.label}
          </Link>
        ))}
      </div>

      {/* Usage meter (if available) */}
      {data.usageMeter && (
        <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2.5">
          <span className="text-xs text-zinc-500 shrink-0">
            <span className="capitalize">{data.usageMeter.planTier}</span> plan
          </span>
          <MiniMeter label="Posts" used={data.usageMeter.postsUsed} limit={data.usageMeter.postsLimit} />
          <MiniMeter label="Insights" used={data.usageMeter.insightsUsed} limit={data.usageMeter.insightsLimit} />
        </div>
      )}

      {/* Main content: 2-column layout */}
      <div className="grid md:grid-cols-5 gap-4">
        {/* Left: Insights + Activity (wider) */}
        <div className="md:col-span-3 space-y-4">
          {/* AI Insights */}
          <Card className="border-zinc-800 bg-zinc-900/40">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-zinc-200" />
                  AI Insights
                </span>
                <Link href="/insights" className="text-[10px] text-zinc-400 hover:text-zinc-300">
                  View All →
                </Link>
              </div>
              {data.recentInsights.length > 0 ? (
                <div className="space-y-2">
                  {data.recentInsights.map((insight) => (
                    <div key={insight.id} className="flex items-start gap-2 rounded-md bg-zinc-800/40 p-2">
                      <TrendingUp className="h-3.5 w-3.5 text-zinc-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-zinc-300 leading-relaxed">{insight.insight}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-[9px] border-zinc-700 px-1 py-0">{insight.type}</Badge>
                          {insight.platform && (
                            <Badge variant="outline" className="text-[9px] border-zinc-700 px-1 py-0">{insight.platform}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600 text-center py-4">No insights yet — post content to start learning</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Agent Activity */}
          <Card className="border-zinc-800 bg-zinc-900/40">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-green-400" />
                  Agent Activity
                </span>
                <Link href="/logs" className="text-[10px] text-zinc-400 hover:text-zinc-300">
                  All Logs →
                </Link>
              </div>
              {data.recentLogs.length > 0 ? (
                <div className="space-y-1">
                  {data.recentLogs.map((log) => (
                    <div key={log.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-zinc-800/30">
                      {log.success ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-zinc-500 shrink-0" />
                      )}
                      <span className="text-zinc-500 w-16 shrink-0 truncate">{log.agent}</span>
                      <span className="text-zinc-400 truncate flex-1">{log.action}</span>
                      <span className="text-zinc-600 shrink-0">{log.durationMs ? `${log.durationMs}ms` : ""}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600 text-center py-4">No activity yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Campaigns + Actions (narrower) */}
        <div className="md:col-span-2 space-y-4">
          {/* Active Campaigns */}
          <Card className="border-zinc-800 bg-zinc-900/40">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-zinc-200" />
                  Campaigns
                </span>
                <Link href="/marketing/campaigns" className="text-[10px] text-zinc-400 hover:text-zinc-300">
                  All →
                </Link>
              </div>
              {data.activeCampaigns.length > 0 ? (
                <div className="space-y-2">
                  {data.activeCampaigns.map((c) => (
                    <div key={c.id} className="rounded-md bg-zinc-800/40 p-2">
                      <p className="text-xs font-medium text-zinc-200 truncate">{c.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{c.theme}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600 text-center py-4">No active campaigns</p>
              )}
            </CardContent>
          </Card>

          {/* Brand summary (if exists) */}
          {data.activeBrand && (
            <Card className="border-zinc-800 bg-zinc-900/40">
              <CardContent className="p-3">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-2">
                  <Globe className="h-3.5 w-3.5 text-zinc-200" />
                  Brand Profile
                </span>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[9px] border-zinc-700 px-1.5 py-0">
                    {data.activeBrand.automationMode === "full_auto_generate" ? "Full Auto" : data.activeBrand.automationMode === "semi_auto" ? "Semi-Auto" : "On Demand"}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] border-zinc-700 px-1.5 py-0">
                    {data.activeBrand.postsPerDayPerPlatform} posts/day
                  </Badge>
                  <Badge variant="outline" className="text-[9px] border-zinc-700 px-1.5 py-0">
                    {data.activeBrand.languagePreference}
                  </Badge>
                  {((data.activeBrand.platformsActive as string[] | null) || []).map((p) => (
                    <Badge key={p} variant="outline" className="text-[9px] border-zinc-700 px-1.5 py-0 capitalize">{p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

function Metric({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={`h-3 w-3 ${color}`} />
        <span className="text-[10px] text-zinc-500">{label}</span>
      </div>
      <span className="text-lg font-bold text-zinc-100">{value}</span>
    </div>
  );
}

function MiniMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <span className="text-[10px] text-zinc-500 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-zinc-600" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-500 shrink-0">{used}/{limit}</span>
    </div>
  );
}
