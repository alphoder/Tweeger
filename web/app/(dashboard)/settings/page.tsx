"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Bot,
  Brain,
  Palette,
  Clock,
  Trash2,
  AlertTriangle,
  Shield,
  Zap,
  User,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface ConnectionStatus {
  name: string;
  status: "connected" | "disconnected" | "testing" | "error";
  message?: string;
  icon: React.ElementType;
  color: string;
}

interface AgentInfo {
  name: string;
  role: string;
  platform: string;
  lastAction: string;
  successRate: number;
  postsHandled: number;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [connections, setConnections] = useState<ConnectionStatus[]>([
    { name: "Twitter / X", status: "disconnected", icon: Globe, color: "text-zinc-400" },
    { name: "LinkedIn", status: "disconnected", icon: Globe, color: "text-amber-400" },
    { name: "Instagram", status: "disconnected", icon: Globe, color: "text-amber-400" },
    { name: "Facebook", status: "disconnected", icon: Globe, color: "text-blue-400" },
    { name: "Neon Postgres", status: "disconnected", icon: Shield, color: "text-emerald-400" },
    { name: "Google Gemini", status: "disconnected", icon: Brain, color: "text-amber-400" },
    { name: "Gemini AI", status: "disconnected", icon: Zap, color: "text-amber-400" },
  ]);

  const [testingAll, setTestingAll] = useState(false);
  const [twitterProfile, setTwitterProfile] = useState<Record<string, unknown> | null>(null);

  // Scheduling config state
  const [postsPerDay, setPostsPerDay] = useState(3);
  const [optimalHours, setOptimalHours] = useState("9,12,17");
  const [autoSchedule, setAutoSchedule] = useState(true);

  // AI config state
  const [defaultModel, setDefaultModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [selfLearning, setSelfLearning] = useState(true);

  // Danger zone
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  // Agents
  const agents: AgentInfo[] = [
    {
      name: "Manager Bot",
      role: "Orchestrator",
      platform: "All",
      lastAction: "Coordinated daily content plan",
      successRate: 98,
      postsHandled: 0,
    },
    {
      name: "Twitter Bot",
      role: "Platform Bot",
      platform: "Twitter",
      lastAction: "Posted trend-based tweet",
      successRate: 95,
      postsHandled: 0,
    },
    {
      name: "LinkedIn Bot",
      role: "Platform Bot",
      platform: "LinkedIn",
      lastAction: "Awaiting activation",
      successRate: 0,
      postsHandled: 0,
    },
    {
      name: "Instagram Bot",
      role: "Platform Bot",
      platform: "Instagram",
      lastAction: "Awaiting activation",
      successRate: 0,
      postsHandled: 0,
    },
    {
      name: "Facebook Bot",
      role: "Platform Bot",
      platform: "Facebook",
      lastAction: "Awaiting activation",
      successRate: 0,
      postsHandled: 0,
    },
  ];

  // ─── TEST CONNECTIONS ──────────────────────────────────────────────────────

  async function testConnection(index: number) {
    setConnections((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, status: "testing" } : c
      )
    );

    try {
      const conn = connections[index];
      let success = false;
      let message = "";

      switch (conn.name) {
        case "Twitter / X": {
          const res = await fetch("/api/twitter/profile");
          if (res.ok) {
            const data = await res.json();
            setTwitterProfile(data.user || data);
            success = true;
            message = `@${data.user?.username || data.username || "connected"}`;
          } else {
            message = "API key not configured";
          }
          break;
        }
        case "Instagram": {
          const igRes = await fetch("/api/instagram/profile");
          if (igRes.ok) {
            const igData = await igRes.json();
            if (igData.configured) {
              success = true;
              message = `@${igData.profile?.handle?.replace("@", "") || "connected"} (${igData.profile?.followers || 0} followers)`;
            } else {
              message = "Not configured — set INSTAGRAM_ACCOUNT_ID & META_ACCESS_TOKEN";
            }
          } else {
            message = "API not configured";
          }
          break;
        }
        case "Facebook": {
          const fbRes = await fetch("/api/facebook/profile");
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            if (fbData.configured) {
              success = true;
              message = `${fbData.profile?.name || "Page"} (${fbData.profile?.followers || 0} followers)`;
            } else {
              message = "Not configured — set FACEBOOK_PAGE_ID & META_ACCESS_TOKEN";
            }
          } else {
            message = "API not configured";
          }
          break;
        }
        case "LinkedIn":
          message = "Placeholder — LinkedIn API requires partner-level review";
          break;
        case "Neon Postgres": {
          const res = await fetch("/api/analytics?type=overview");
          success = res.ok;
          message = success ? "Connected to Neon" : "Database connection failed";
          break;
        }
        case "Google Gemini": {
          // Test by checking if the API is reachable
          const res = await fetch("/api/scheduling/recommend?platform=twitter");
          success = res.ok;
          message = success ? "Gemini 2.5 Flash ready" : "API key not configured";
          break;
        }
        case "Gemini AI": {
          const res = await fetch("/api/ai");
          const d = await res.json().catch(() => ({ ready: false }));
          success = !!d.ready;
          message = success ? "Gemini endpoint ready" : "GEMINI_API_KEY not configured";
          break;
        }
      }

      setConnections((prev) =>
        prev.map((c, i) =>
          i === index
            ? {
                ...c,
                status: success ? "connected" : "error",
                message,
              }
            : c
        )
      );
    } catch {
      setConnections((prev) =>
        prev.map((c, i) =>
          i === index
            ? { ...c, status: "error", message: "Connection failed" }
            : c
        )
      );
    }
  }

  async function testAllConnections() {
    setTestingAll(true);
    for (let i = 0; i < connections.length; i++) {
      await testConnection(i);
    }
    setTestingAll(false);
    toast.success("All connections tested");
  }

  // ─── DANGER ZONE ACTIONS ───────────────────────────────────────────────────

  async function handleDangerAction(action: string) {
    setClearing(true);
    try {
      let endpoint = "";
      switch (action) {
        case "clear_drafts":
          endpoint = "/api/drafts?clearAll=true";
          break;
        case "clear_failed":
          endpoint = "/api/queue?clearFailed=true";
          break;
        case "clear_insights":
          endpoint = "/api/insights?clearAll=true";
          break;
        default:
          return;
      }

      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        toast.success("Cleared successfully");
      } else {
        toast.error("Failed to clear");
      }
    } catch {
      toast.error("Operation failed");
    } finally {
      setClearing(false);
      setConfirmAction(null);
    }
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-zinc-400" />
          Settings
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Platform connections, AI configuration, and agent management
        </p>
      </div>

      {/* Brand Config */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Palette className="h-4 w-4 text-amber-400" />
            Brand Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BrandField label="Brand Name" value="Axon Social AI" />
            <BrandField label="Target Market" value="Indian Businesses" />
            <BrandField
              label="Industries"
              value="Restaurants, Hotels, Hospitals, Real Estate, Education, Startups"
            />
            <BrandField
              label="Tone"
              value="Professional, tech-forward, results-driven"
            />
            <BrandField
              label="AI Model (Server)"
              value="Google Gemini 2.5 Flash"
            />
            <BrandField
              label="AI Model (Client)"
              value="Google Gemini 2.5"
            />
          </div>
          <p className="text-[10px] text-zinc-600 mt-3">
            Brand values are configured via environment variables
          </p>
        </CardContent>
      </Card>

      {/* Platform Connections */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wifi className="h-4 w-4 text-zinc-400" />
              Platform Connections
            </CardTitle>
            <Button
              onClick={testAllConnections}
              disabled={testingAll}
              size="sm"
              variant="outline"
              className="border-zinc-700 text-zinc-300 h-7 text-xs"
            >
              {testingAll ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1.5" />
              )}
              Test All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {connections.map((conn, i) => {
            const Icon = conn.icon;
            return (
              <div
                key={conn.name}
                className="flex items-center justify-between rounded-lg bg-zinc-800/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${conn.color}`} />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {conn.name}
                    </p>
                    {conn.message && (
                      <p className="text-[10px] text-zinc-500">
                        {conn.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={conn.status} />
                  <button
                    onClick={() => testConnection(i)}
                    className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
                    disabled={conn.status === "testing"}
                  >
                    {conn.status === "testing" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Twitter Profile */}
      {twitterProfile && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-zinc-400" />
              Twitter Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                <User className="h-6 w-6 text-zinc-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  {String(
                    (twitterProfile as Record<string, unknown>).name ||
                      (twitterProfile as Record<string, Record<string, unknown>>).user?.name ||
                      "Unknown"
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  @
                  {String(
                    (twitterProfile as Record<string, unknown>).username ||
                      (twitterProfile as Record<string, Record<string, unknown>>).user?.username ||
                      "unknown"
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scheduling Config */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              Scheduling Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">
                Posts Per Day (per platform)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={postsPerDay}
                onChange={(e) => setPostsPerDay(parseInt(e.target.value) || 3)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">
                Optimal Hours (comma-separated, IST)
              </label>
              <input
                type="text"
                value={optimalHours}
                onChange={(e) => setOptimalHours(e.target.value)}
                placeholder="9,12,17"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-300">
                  AI Auto-Scheduling
                </p>
                <p className="text-[10px] text-zinc-500">
                  Let AI pick optimal posting times
                </p>
              </div>
              <ToggleSwitch
                checked={autoSchedule}
                onChange={setAutoSchedule}
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Config */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-amber-400" />
              AI Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">
                Default AI Model
              </label>
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50"
              >
                <option value="Gemini Flash">Gemini Flash (Fast)</option>
                <option value="GPT-4.1 Nano">GPT-4.1 Nano</option>
                <option value="Claude Sonnet">Claude Sonnet</option>
                <option value="Claude Haiku">Claude Haiku</option>
                <option value="Llama 4 Scout">Llama 4 Scout</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">
                Temperature: {temperature}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
                <span>Precise (0)</span>
                <span>Creative (1)</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-300">
                  Self-Learning Engine
                </p>
                <p className="text-[10px] text-zinc-500">
                  Analyze performance and generate insights
                </p>
              </div>
              <ToggleSwitch
                checked={selfLearning}
                onChange={setSelfLearning}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Status */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4 text-zinc-400" />
            Multi-Agent Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((agent) => (
              <div
                key={agent.name}
                className="rounded-lg bg-zinc-800/50 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-xs font-medium text-zinc-200">
                      {agent.name}
                    </span>
                  </div>
                  <Badge
                    className={`text-[8px] ${
                      agent.successRate > 0
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-zinc-700 text-zinc-500"
                    }`}
                  >
                    {agent.successRate > 0 ? "Active" : "Idle"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-500">Role</span>
                    <span className="text-zinc-400">{agent.role}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-500">Platform</span>
                    <span className="text-zinc-400">{agent.platform}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-500">Last Action</span>
                    <span className="text-zinc-400 truncate max-w-[140px]">
                      {agent.lastAction}
                    </span>
                  </div>
                  {agent.successRate > 0 && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-zinc-500">Success Rate</span>
                      <span className="text-emerald-400">
                        {agent.successRate}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/30 bg-red-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DangerAction
            label="Clear All Drafts"
            description="Delete all draft posts permanently"
            actionKey="clear_drafts"
            confirmAction={confirmAction}
            setConfirmAction={setConfirmAction}
            onConfirm={handleDangerAction}
            clearing={clearing}
          />
          <DangerAction
            label="Clear Failed Queue"
            description="Remove all failed posts from queue"
            actionKey="clear_failed"
            confirmAction={confirmAction}
            setConfirmAction={setConfirmAction}
            onConfirm={handleDangerAction}
            clearing={clearing}
          />
          <DangerAction
            label="Reset Self-Learning Data"
            description="Clear all AI insights and start fresh"
            actionKey="clear_insights"
            confirmAction={confirmAction}
            setConfirmAction={setConfirmAction}
            onConfirm={handleDangerAction}
            clearing={clearing}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── HELPER COMPONENTS ───────────────────────────────────────────────────────

function BrandField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-zinc-500 mb-0.5">{label}</p>
      <p className="text-xs text-zinc-300 bg-zinc-800/50 rounded-md px-3 py-2">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "connected" | "disconnected" | "testing" | "error";
}) {
  const config = {
    connected: {
      label: "Connected",
      className: "bg-emerald-500/20 text-emerald-400",
      icon: CheckCircle2,
    },
    disconnected: {
      label: "Not tested",
      className: "bg-zinc-700 text-zinc-400",
      icon: WifiOff,
    },
    testing: {
      label: "Testing...",
      className: "bg-blue-500/20 text-blue-400",
      icon: Loader2,
    },
    error: {
      label: "Error",
      className: "bg-red-500/20 text-red-400",
      icon: XCircle,
    },
  };

  const c = config[status];
  const Icon = c.icon;

  return (
    <Badge className={`text-[9px] ${c.className}`}>
      <Icon
        className={`h-2.5 w-2.5 mr-0.5 ${
          status === "testing" ? "animate-spin" : ""
        }`}
      />
      {c.label}
    </Badge>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        checked ? "bg-emerald-500" : "bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function DangerAction({
  label,
  description,
  actionKey,
  confirmAction,
  setConfirmAction,
  onConfirm,
  clearing,
}: {
  label: string;
  description: string;
  actionKey: string;
  confirmAction: string | null;
  setConfirmAction: (v: string | null) => void;
  onConfirm: (action: string) => void;
  clearing: boolean;
}) {
  const isConfirming = confirmAction === actionKey;

  return (
    <div className="flex items-center justify-between rounded-lg bg-zinc-800/50 p-3">
      <div>
        <p className="text-xs font-medium text-zinc-300">{label}</p>
        <p className="text-[10px] text-zinc-500">{description}</p>
      </div>
      {isConfirming ? (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            onClick={() => onConfirm(actionKey)}
            disabled={clearing}
            className="h-7 text-[10px] bg-red-500/20 text-red-300 hover:bg-red-500/30"
          >
            {clearing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Confirm"
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => setConfirmAction(null)}
            variant="outline"
            className="h-7 text-[10px] border-zinc-700 text-zinc-400"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          onClick={() => setConfirmAction(actionKey)}
          variant="outline"
          className="h-7 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
