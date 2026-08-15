"use client";

import { useState, useEffect } from "react";
import {
  Megaphone,
  Target,
  Copy,
  Users,
  CalendarClock,
  Loader2,
  ArrowRight,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── FEATURE CARDS ───────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: "Campaign Planner",
    description: "Industry-specific multi-platform campaigns powered by AI agents",
    icon: Target,
    href: "/marketing/campaigns",
    color: "text-emerald-400",
    gradient: "from-emerald-500/20 to-emerald-500/5",
  },
  {
    title: "Ad Copy Generator",
    description: "High-converting ad copy with A/B variants and angle analysis",
    icon: Copy,
    href: "/marketing/ad-copy",
    color: "text-zinc-400",
    gradient: "from-zinc-500/20 to-zinc-500/5",
  },
  {
    title: "Competitor Intelligence",
    description: "Analyze competitor strategies and find opportunities",
    icon: Users,
    href: "/marketing/competitors",
    color: "text-amber-400",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
  {
    title: "Content Planner",
    description: "AI-generated content calendars across platforms and industries",
    icon: CalendarClock,
    href: "/marketing/planner",
    color: "text-amber-400",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function MarketingPage() {
  const [stats, setStats] = useState({
    activeCampaigns: 0,
    adCopies: 0,
    competitors: 0,
    calendarItems: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [campRes, adRes, compRes, calRes] = await Promise.all([
          fetch("/api/marketing/campaigns?limit=1"),
          fetch("/api/marketing/ad-copy?limit=1"),
          fetch("/api/marketing/competitors?limit=1"),
          fetch("/api/marketing/planner?limit=1"),
        ]);

        const campData = campRes.ok ? await campRes.json() : {};
        const adData = adRes.ok ? await adRes.json() : {};
        const compData = compRes.ok ? await compRes.json() : {};
        const calData = calRes.ok ? await calRes.json() : {};

        setStats({
          activeCampaigns: campData.total || 0,
          adCopies: adData.total || 0,
          competitors: compData.total || 0,
          calendarItems: calData.total || 0,
        });
      } catch {
        // silent — stats are non-critical
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-emerald-400" />
          Marketing Hub
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Multi-platform AI-powered marketing command center
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickStat
          label="Active Campaigns"
          value={loading ? "—" : String(stats.activeCampaigns)}
          icon={Target}
          color="text-emerald-400"
        />
        <QuickStat
          label="Ad Copies"
          value={loading ? "—" : String(stats.adCopies)}
          icon={Copy}
          color="text-zinc-400"
        />
        <QuickStat
          label="Competitors Analyzed"
          value={loading ? "—" : String(stats.competitors)}
          icon={Users}
          color="text-amber-400"
        />
        <QuickStat
          label="Calendar Items"
          value={loading ? "—" : String(stats.calendarItems)}
          icon={CalendarClock}
          color="text-amber-400"
        />
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <a
              key={feature.title}
              href={feature.href}
              className="group block"
            >
              <Card className="border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-all group-hover:shadow-lg">
                <CardContent className="p-5">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-3`}>
                    <Icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                    {feature.title}
                    <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>

      {/* Industry Focus */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            Industry Focus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              "Restaurants",
              "Hotels",
              "Hospitals",
              "Real Estate",
              "Education",
              "Startups",
              "SaaS",
              "Food Tech",
              "Healthcare",
            ].map((ind) => (
              <Badge
                key={ind}
                className="text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-default"
              >
                {ind}
              </Badge>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 mt-3">
            Axon creates industry-specific campaigns optimized for Indian businesses
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function QuickStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="p-4">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="text-xl font-bold text-zinc-100 mt-2">{value}</p>
        <p className="text-xs text-zinc-500 mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
