// ─── TELEGRAM BOT (grammy) ──────────────────────────────────────────────────
// FineTweet Command Center — Telegram interface
// Webhook mode in production, polling in dev

import { Bot, InlineKeyboard, Context } from "grammy";
import { db } from "./db";
import { brandProfiles, reviewQueue } from "./schema";
import { eq, desc } from "drizzle-orm";
import { getUsage } from "./usage";

// Lazy bot instance
let _bot: Bot | null = null;

export function getBot(): Bot {
  if (!_bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
    // Providing botInfo skips grammy's getMe call on first update —
    // that init fetch stalls under OpenNext on Workers.
    let botInfo;
    try {
      botInfo = process.env.TELEGRAM_BOT_INFO ? JSON.parse(process.env.TELEGRAM_BOT_INFO) : undefined;
    } catch {
      botInfo = undefined;
    }
    _bot = new Bot(token, {
      ...(botInfo ? { botInfo } : {}),
      // grammy's Node build injects node-only fetch options (agent,
      // compress) that Workers reject — strip them and use plain fetch.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: {
        fetch: ((url: RequestInfo | URL, init?: RequestInit & { agent?: unknown; compress?: unknown }) => {
          if (init) {
            delete init.agent;
            delete init.compress;
            // nodejs_compat AbortSignal isn't workerd's AbortSignal;
            // grammy's own timeout race still bounds the call.
            delete init.signal;
          }
          return fetch(url, init);
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    registerHandlers(_bot);
  }
  return _bot;
}

const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID
  ? parseInt(process.env.TELEGRAM_ADMIN_ID)
  : 0;

function isAdmin(ctx: Context): boolean {
  // Deny-by-default: if TELEGRAM_ADMIN_ID is not set, nobody is admin.
  return ADMIN_ID !== 0 && ctx.from?.id === ADMIN_ID;
}

// ─── INTERNAL API DISPATCH ──────────────────────────────────────────────────
// Route handlers are plain functions — call them in-process instead of
// fetching our own URL (Workers block self-fetch with 1042, and the SELF
// service binding deadlocks under OpenNext).

type RouteModule = Record<string, (req: Request) => Promise<Response>>;

const INTERNAL_ROUTES: Record<string, () => Promise<RouteModule>> = {
  "/api/queue": () => import("@/app/api/queue/route") as unknown as Promise<RouteModule>,
  "/api/trends": () => import("@/app/api/trends/route") as unknown as Promise<RouteModule>,
  "/api/events": () => import("@/app/api/events/route") as unknown as Promise<RouteModule>,
  "/api/analytics": () => import("@/app/api/analytics/route") as unknown as Promise<RouteModule>,
  "/api/insights": () => import("@/app/api/insights/route") as unknown as Promise<RouteModule>,
  "/api/twitter/profile": () => import("@/app/api/twitter/profile/route") as unknown as Promise<RouteModule>,
  "/api/scheduler": () => import("@/app/api/scheduler/route") as unknown as Promise<RouteModule>,
  "/api/team/run": () => import("@/app/api/team/run/route") as unknown as Promise<RouteModule>,
  "/api/team/deep": () => import("@/app/api/team/deep/route") as unknown as Promise<RouteModule>,
};

export async function internalFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${baseUrl}${path}`;
  const method = (init?.method || "GET").toUpperCase();

  const loader = INTERNAL_ROUTES[new URL(url).pathname];
  if (loader) {
    const mod = await loader();
    const handler = mod[method];
    if (handler) {
      const { NextRequest } = await import("next/server");
      return handler(new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]));
    }
  }

  // Unknown path — plain fetch (dev only; add the route to the map above)
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), authorization: `Bearer ${process.env.CRON_SECRET || ""}` },
  });
}

// ─── REGISTER HANDLERS ──────────────────────────────────────────────────────

function registerHandlers(bot: Bot) {
  // /start
  bot.command("start", async (ctx) => {
    if (!isAdmin(ctx)) return;

    await ctx.reply(
      `🤖 *FineTweet Command Center*\n\nWelcome! I'm your multi-agent social media automation assistant.\n\n*Commands:*\n/post <text> — Create a draft post\n/queue — View scheduled posts\n/trends — See trending topics\n/ideas — Generate 5 content ideas\n/events — Upcoming events\n/analytics — Performance summary\n/insights — Top AI insights\n/profile — Twitter profile info\n/calendar — 7-day schedule\n/report — Weekly performance report\n/brand — Brand profile info\n/approve — Pending reviews\n/usage — Usage & billing meters\n/status — Automation status\n/team — Meet your agent team\n/build — Team builds a new post\n/doitdeep — Antigravity deep research build\n/cancel — Clear context`,
      { parse_mode: "Markdown" }
    );
  });

  // /post <text>
  bot.command("post", async (ctx) => {
    if (!isAdmin(ctx)) return;

    const text = ctx.match;
    if (!text) {
      await ctx.reply("Usage: /post <your post text>");
      return;
    }

    const keyboard = new InlineKeyboard()
      .text("🐦 Twitter", `platform:twitter:${text.slice(0, 50)}`)
      .text("💼 LinkedIn", `platform:linkedin:${text.slice(0, 50)}`)
      .row()
      .text("📷 Instagram", `platform:instagram:${text.slice(0, 50)}`)
      .text("📘 Facebook", `platform:facebook:${text.slice(0, 50)}`)
      .row()
      .text("🌐 All Platforms", `platform:all:${text.slice(0, 50)}`);

    await ctx.reply(`📝 *New Post Draft*\n\n${text}\n\nSelect platform:`, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  });

  // /queue
  bot.command("queue", async (ctx) => {
    if (!isAdmin(ctx)) return;

    try {
      const res = await internalFetch(`/api/queue?status=scheduled&limit=10`);

      if (!res.ok) {
        await ctx.reply("❌ Failed to fetch queue");
        return;
      }

      const data = await res.json();
      const items = data.items || [];

      if (items.length === 0) {
        await ctx.reply("📭 Queue is empty. Create posts in /post or the web dashboard.");
        return;
      }

      let message = "📋 *Scheduled Posts*\n\n";
      for (const item of items) {
        const time = new Date(item.scheduledTime).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const platformEmoji =
          item.platform === "twitter"
            ? "🐦"
            : item.platform === "linkedin"
            ? "💼"
            : item.platform === "instagram"
            ? "📷"
            : "📘";
        message += `${platformEmoji} *${item.platform}* — ${time}\n${item.text.slice(0, 80)}${item.text.length > 80 ? "..." : ""}\n\n`;
      }

      message += `_${items.length} of ${data.total} scheduled_`;
      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("❌ Error fetching queue");
    }
  });

  // /trends
  bot.command("trends", async (ctx) => {
    if (!isAdmin(ctx)) return;

    try {
      const res = await internalFetch(`/api/trends?platform=twitter`);

      if (!res.ok) {
        await ctx.reply("❌ Failed to fetch trends");
        return;
      }

      const data = await res.json();
      const trends = data.trends || [];

      if (trends.length === 0) {
        await ctx.reply("📊 No trending topics right now. Try again later.");
        return;
      }

      let message = "🔥 *Trending Topics*\n\n";
      trends.slice(0, 10).forEach((t: Record<string, unknown>, i: number) => {
        message += `${i + 1}. *${t.name}*${t.volume ? ` (${t.volume} posts)` : ""}\n`;
      });

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("❌ Error fetching trends");
    }
  });

  // /ideas
  bot.command("ideas", async (ctx) => {
    if (!isAdmin(ctx)) return;

    await ctx.reply("💡 *Generating content ideas...*\nManager Bot is brainstorming across platforms.", {
      parse_mode: "Markdown",
    });

    // In production, this would use Gemini API server-side
    await ctx.reply(
      "💡 *Content Ideas*\n\n" +
        "1. 🐦 Twitter: Quick tip thread on social media automation ROI\n" +
        "2. 💼 LinkedIn: Case study on restaurant social media transformation\n" +
        "3. 📷 Instagram: Behind-the-scenes carousel of Axon's AI agents\n" +
        "4. 📘 Facebook: Poll asking businesses about their biggest marketing challenge\n" +
        "5. 🌐 All: Trend-jacking post if a relevant topic is trending\n\n" +
        "_Use /post to create any of these!_",
      { parse_mode: "Markdown" }
    );
  });

  // /events
  bot.command("events", async (ctx) => {
    if (!isAdmin(ctx)) return;

    try {
      const res = await internalFetch(`/api/events?upcoming=true&days=60`);

      if (!res.ok) {
        await ctx.reply("❌ Failed to fetch events");
        return;
      }

      const data = await res.json();
      const events = (data.events || []).slice(0, 15);

      if (events.length === 0) {
        await ctx.reply("📅 No upcoming events. Load defaults from the web dashboard.");
        return;
      }

      let message = "📅 *Upcoming Events*\n\n";
      for (const evt of events) {
        const date = new Date(evt.eventDate).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        });
        const industries = (evt.targetIndustries || []).join(", ");
        message += `• *${evt.name}* — ${date}`;
        if (industries) message += ` (${industries})`;
        message += "\n";
      }

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("❌ Error fetching events");
    }
  });

  // /analytics
  bot.command("analytics", async (ctx) => {
    if (!isAdmin(ctx)) return;

    try {
      const res = await internalFetch(`/api/analytics?type=overview`);

      if (!res.ok) {
        await ctx.reply("❌ Failed to fetch analytics");
        return;
      }

      const data = await res.json();
      const snapshots = data.snapshots || [];
      const totalFollowers = snapshots.reduce(
        (s: number, snap: Record<string, number>) => s + (snap.followers || 0),
        0
      );

      let message = "📊 *Analytics Overview*\n\n";
      message += `👥 Total Followers: *${totalFollowers.toLocaleString()}*\n`;

      for (const snap of snapshots) {
        const emoji =
          snap.platform === "twitter"
            ? "🐦"
            : snap.platform === "linkedin"
            ? "💼"
            : snap.platform === "instagram"
            ? "📷"
            : "📘";
        message += `${emoji} ${snap.platform}: ${(snap.followers || 0).toLocaleString()} followers\n`;
      }

      if (data.topPost) {
        message += `\n🏆 *Best Post Today:*\n${data.topPost.text?.slice(0, 100)}...\n`;
      }

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("❌ Error fetching analytics");
    }
  });

  // /insights
  bot.command("insights", async (ctx) => {
    if (!isAdmin(ctx)) return;

    try {
      const res = await internalFetch(`/api/insights?limit=5`);

      if (!res.ok) {
        await ctx.reply("❌ Failed to fetch insights");
        return;
      }

      const data = await res.json();
      const insights = data.insights || [];

      if (insights.length === 0) {
        await ctx.reply("🧠 No insights yet. The AI is learning — post more content!");
        return;
      }

      let message = "🧠 *Top AI Insights*\n\n";
      for (const ins of insights) {
        const confidence = (ins.confidence * 100).toFixed(0);
        message += `• ${ins.insight}\n  _${confidence}% confidence${ins.platform ? ` — ${ins.platform}` : ""}_\n\n`;
      }

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("❌ Error fetching insights");
    }
  });

  // /profile
  bot.command("profile", async (ctx) => {
    if (!isAdmin(ctx)) return;

    try {
      const res = await internalFetch(`/api/twitter/profile`);

      if (!res.ok) {
        await ctx.reply("❌ Twitter API not configured. Check settings.");
        return;
      }

      const data = await res.json();
      const user = data.user || data;

      await ctx.reply(
        `🐦 *Twitter Profile*\n\n` +
          `Name: *${user.name || "Unknown"}*\n` +
          `Handle: @${user.username || "unknown"}\n` +
          `Followers: ${(user.public_metrics?.followers_count || 0).toLocaleString()}\n` +
          `Following: ${(user.public_metrics?.following_count || 0).toLocaleString()}\n` +
          `Tweets: ${(user.public_metrics?.tweet_count || 0).toLocaleString()}`,
        { parse_mode: "Markdown" }
      );
    } catch {
      await ctx.reply("❌ Error fetching profile");
    }
  });

  // /calendar
  bot.command("calendar", async (ctx) => {
    if (!isAdmin(ctx)) return;

    try {
      const res = await internalFetch(`/api/queue?status=scheduled&limit=21`);

      if (!res.ok) {
        await ctx.reply("❌ Failed to fetch schedule");
        return;
      }

      const data = await res.json();
      const items = data.items || [];

      if (items.length === 0) {
        await ctx.reply("📆 No posts scheduled. Use /post or the web dashboard.");
        return;
      }

      let message = "📆 *7-Day Schedule*\n\n";
      let currentDay = "";

      for (const item of items) {
        const date = new Date(item.scheduledTime);
        const dayStr = date.toLocaleDateString("en-IN", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const timeStr = date.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
        });

        if (dayStr !== currentDay) {
          message += `\n📌 *${dayStr}*\n`;
          currentDay = dayStr;
        }

        const emoji =
          item.platform === "twitter"
            ? "🐦"
            : item.platform === "linkedin"
            ? "💼"
            : item.platform === "instagram"
            ? "📷"
            : "📘";
        message += `  ${emoji} ${timeStr} — ${item.text.slice(0, 60)}...\n`;
      }

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("❌ Error fetching calendar");
    }
  });

  // /report
  bot.command("report", async (ctx) => {
    if (!isAdmin(ctx)) return;

    try {
      const res = await internalFetch(`/api/analytics?type=weekly_report`);

      if (!res.ok) {
        await ctx.reply("❌ Failed to generate report");
        return;
      }

      const data = await res.json();
      const platforms = data.postsByPlatform || [];
      const topPosts = data.topPosts || [];

      let message = "📈 *Weekly Performance Report*\n\n";

      for (const p of platforms) {
        const emoji =
          p.platform === "twitter"
            ? "🐦"
            : p.platform === "linkedin"
            ? "💼"
            : p.platform === "instagram"
            ? "📷"
            : "📘";
        message += `${emoji} *${p.platform}*: ${p.postCount} posts, ${((Number(p.avgEngagement) || 0) * 100).toFixed(1)}% avg engagement\n`;
      }

      if (topPosts.length > 0) {
        message += "\n🏆 *Top Post:*\n";
        message += `${topPosts[0].text?.slice(0, 120)}...\n`;
        message += `❤️ ${topPosts[0].likes} | 🔁 ${topPosts[0].shares} | 💬 ${topPosts[0].comments}\n`;
      }

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("❌ Error generating report");
    }
  });

  // /brand — show brand profile info
  bot.command("brand", async (ctx) => {
    if (!isAdmin(ctx)) return;

    try {
      const brand = await db.query.brandProfiles.findFirst({
        orderBy: (b, { desc: d }) => [d(b.createdAt)],
      });

      if (!brand) {
        await ctx.reply(
          "🏢 No brand profile set up yet.\n\nVisit the web dashboard → Brand Setup to extract your brand from your website URL."
        );
        return;
      }

      const tone =
        typeof brand.tone === "object" && brand.tone !== null
          ? (brand.tone as { primary: string; secondary?: string })
          : { primary: "N/A" };

      const platforms = Array.isArray(brand.platformsActive)
        ? (brand.platformsActive as string[])
        : [];

      let msg = `🏢 *Brand Profile: ${brand.name}*\n\n`;
      msg += `🏭 Industry: ${brand.industry}${brand.subIndustry ? ` (${brand.subIndustry})` : ""}\n`;
      msg += `💬 Tone: ${tone.primary}${tone.secondary ? `, ${tone.secondary}` : ""}\n`;
      msg += `🤖 Mode: ${brand.automationMode.replace(/_/g, " ")}\n`;
      msg += `📝 Posts/day: ${brand.postsPerDayPerPlatform}\n`;
      msg += `🌐 Platforms: ${platforms.join(", ") || "None"}\n`;
      msg += `🗣 Language: ${brand.languagePreference}\n`;
      msg += `\n📝 ${brand.description.slice(0, 200)}${brand.description.length > 200 ? "..." : ""}`;

      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("❌ Error fetching brand profile");
    }
  });

  // /approve — show pending reviews
  bot.command("approve", async (ctx) => {
    if (!isAdmin(ctx)) return;

    try {
      const pending = await db
        .select()
        .from(reviewQueue)
        .where(eq(reviewQueue.reviewStatus, "pending_review"))
        .orderBy(reviewQueue.reviewOrder)
        .limit(5);

      if (pending.length === 0) {
        await ctx.reply("✅ No posts pending review. All caught up!");
        return;
      }

      let msg = `📋 *${pending.length} Posts Pending Review*\n\n`;

      for (const item of pending) {
        const emoji =
          item.platform === "twitter" ? "🐦" :
          item.platform === "linkedin" ? "💼" :
          item.platform === "instagram" ? "📷" : "📘";
        msg += `${emoji} *${item.platform}* — Score: ${item.aiScore}/100\n`;
        msg += `_${item.targetSignal} target_\n\n`;
      }

      msg += `Open the Review Deck to approve or reject: /review`;

      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("❌ Error fetching pending reviews");
    }
  });

  // /usage — show usage & billing meters
  bot.command("usage", async (ctx) => {
    if (!isAdmin(ctx)) return;

    try {
      const brand = await db.query.brandProfiles.findFirst({
        orderBy: (b, { desc: d }) => [d(b.createdAt)],
      });

      if (!brand) {
        await ctx.reply("🏢 No brand profile set up yet. Use the web dashboard to create one.");
        return;
      }

      const usage = await getUsage(brand.id);

      if (!usage) {
        await ctx.reply("📊 No usage data yet. Usage tracking begins after your first post.");
        return;
      }

      const postsBar = generateProgressBar(usage.posts.percentUsed);
      const insightsBar = generateProgressBar(usage.insights.percentUsed);

      let msg = `📊 *Usage Meters — ${usage.planTier.toUpperCase()} Plan*\n\n`;
      msg += `📝 *Posts*\n${postsBar} ${usage.posts.used}/${usage.posts.limit}\n`;
      if (usage.posts.overage > 0) msg += `⚠️ ${usage.posts.overage} overage posts\n`;
      msg += `\n🧠 *Insights*\n${insightsBar} ${usage.insights.used}/${usage.insights.limit}\n`;
      if (usage.insights.overage > 0) msg += `⚠️ ${usage.insights.overage} overage insights\n`;
      msg += `\n📅 Period: ${usage.period.start.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} — ${usage.period.end.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`;

      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("❌ Error fetching usage data");
    }
  });

  // /status — automation status overview
  bot.command("status", async (ctx) => {
    if (!isAdmin(ctx)) return;

    try {
      const res = await internalFetch(`/api/scheduler`);

      if (!res.ok) {
        await ctx.reply("❌ Failed to fetch scheduler status");
        return;
      }

      const data = await res.json();
      const status = data.status;

      let msg = `⚙️ *Automation Status*\n\n`;
      msg += `Status: ${status.running ? "🟢 Running" : "🔴 Stopped"}\n\n`;

      for (const job of status.jobs || []) {
        const running = job.running ? "🔄" : "⏸";
        msg += `${running} *${job.name}* — ${job.schedule}\n`;
        msg += `  Last: ${job.lastRun ? new Date(job.lastRun).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "Never"}\n`;
        msg += `  Result: _${job.lastResult}_\n\n`;
      }

      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("❌ Error fetching status");
    }
  });

  // ─── AGENT TEAM ───────────────────────────────────────────────────────────
  // Talk to any agent directly: /nova /researcher /rhea /copywriter
  // /iris /visual /dev /critic /atlas /manager <message>

  {
    const { TEAM, findAgentByCommand, agentChat } = require("./agents/team") as typeof import("./agents/team");

    const allCommands = TEAM.flatMap((a) => a.commands);
    for (const cmd of allCommands) {
      bot.command(cmd, async (ctx) => {
        if (!isAdmin(ctx)) return;
        const agent = findAgentByCommand(cmd)!;
        const message = ctx.match?.trim();

        if (!message) {
          await ctx.reply(
            `${agent.emoji} *${agent.name}* — ${agent.designation}\n\nTalk to me: \`/${cmd} <your message>\`\n\nExamples:\n/${cmd} what's hot in AI today?\n/${cmd} bring me 3 more topic options`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        await ctx.replyWithChatAction("typing");
        try {
          const reply = await agentChat(agent, message);
          await ctx.reply(`${agent.emoji} *${agent.name}:*\n\n${reply}`, { parse_mode: "Markdown" }).catch(
            // Markdown parse can fail on AI output — fall back to plain text
            () => ctx.reply(`${agent.emoji} ${agent.name}:\n\n${reply}`)
          );
        } catch (err) {
          await ctx.reply(`❌ ${agent.name} couldn't answer: ${err instanceof Error ? err.message : "unknown error"}`);
        }
      });
    }

    // /team — meet the team
    bot.command("team", async (ctx) => {
      if (!isAdmin(ctx)) return;
      let msg = "👥 *Your Agent Team*\n\n";
      for (const a of TEAM) {
        msg += `${a.emoji} *${a.name}* — ${a.designation}\n   ${a.commands.map((c) => `/${c}`).join(" · ")}\n\n`;
      }
      msg += "🪐 *Pluto* — Deep Agent (Antigravity)\n   /pluto · /doitdeep\n\n";
      msg += "_/build — have the team produce a new post_\n_/build <direction> — with your instructions_";
      await ctx.reply(msg, { parse_mode: "Markdown" });
    });

    // /build [direction] — run the full team pipeline
    bot.command("build", async (ctx) => {
      if (!isAdmin(ctx)) return;
      const direction = ctx.match?.trim() || undefined;
      await ctx.reply(
        `🏗 *The team is on it.*\n\n🔭 Saturn is researching trends...\n✍️ Mercury will draft\n🔎 Mars will tear it apart\n🎨 Venus will brief the visual\n\nYou'll get a review link when it's ready (1-2 min).`,
        { parse_mode: "Markdown" }
      );
      try {
        const res = await internalFetch("/api/team/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          await ctx.reply(`❌ Build failed: ${(d as { error?: string }).error || res.status}`);
        }
        // Success notification (with the review link) is sent by the pipeline itself
      } catch {
        await ctx.reply("❌ Build failed: could not reach the team pipeline.");
      }
    });
  }

  // /pluto <task> — talk to the big one directly (Antigravity, budgeted)
  bot.command("pluto", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const task = ctx.match?.trim();
    if (!task) {
      await ctx.reply(
        "🪐 *Pluto* — the deep agent (Antigravity)\n\nI browse the live web, run code, and think long. I'm budgeted (60 calls/day), so use me for the heavy stuff.\n\n`/pluto <task>` — direct task\n`/doitdeep` — full deep build with the team",
        { parse_mode: "Markdown" }
      );
      return;
    }
    await ctx.reply("🪐 Pluto is on it. Deep work takes a few minutes...");
    try {
      const { runAntigravity, antigravityCallsToday, DAILY_BUDGET } =
        require("./antigravity") as typeof import("./antigravity");
      const out = await runAntigravity(task, { action: "antigravity_pluto_chat" });
      const used = await antigravityCallsToday();
      const msg = `🪐 *Pluto:*\n\n${out.slice(0, 3500)}\n\n_Budget: ${used}/${DAILY_BUDGET} today_`;
      await ctx.reply(msg, { parse_mode: "Markdown" }).catch(() => ctx.reply(msg.replace(/[*_]/g, "")));
    } catch (err) {
      await ctx.reply(`❌ Pluto: ${err instanceof Error ? err.message : "failed"}`);
    }
  });

  // /doitdeep [direction] — Antigravity deep research + deep team build
  bot.command("doitdeep", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const direction = ctx.match?.trim() || undefined;
    await ctx.reply(
      `🚀 *Going deep.*\n\nPluto (the big one) is researching the live web right now — real browsing, real sources. Then the team builds in deep mode.\n\nThis takes a few minutes. You'll get the research brief + a review link.`,
      { parse_mode: "Markdown" }
    );
    try {
      const res = await internalFetch("/api/team/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const d = (await res.json()) as {
        error?: string;
        research?: string;
        budget?: { used: number; total: number };
      };
      if (!res.ok) {
        await ctx.reply(`❌ Deep run failed: ${d.error || res.status}`);
        return;
      }
      const brief = (d.research || "").slice(0, 3000);
      await ctx.reply(
        `🔬 *Deep Research Brief*\n\n${brief}${(d.research || "").length > 3000 ? "\n\n_...truncated_" : ""}\n\n_Pluto budget: ${d.budget?.used}/${d.budget?.total} today_`,
        { parse_mode: "Markdown" }
      ).catch(() => ctx.reply(`🔬 Deep Research Brief\n\n${brief}`));
    } catch {
      await ctx.reply("❌ Deep run failed: could not reach the pipeline.");
    }
  });

  // /cancel
  bot.command("cancel", async (ctx) => {
    await ctx.reply("✅ Context cleared. Use /start to see all commands.");
  });

  // Plain messages → Jupiter (the Manager) routes to the right specialist
  bot.on("message:text", async (ctx) => {
    if (!isAdmin(ctx)) return;
    if (ctx.message.text.startsWith("/")) return; // commands handled above

    await ctx.replyWithChatAction("typing");
    try {
      const { managerRoute } = require("./agents/team") as typeof import("./agents/team");
      const { agent, reply } = await managerRoute(ctx.message.text);
      const label =
        agent.key === "manager"
          ? `${agent.emoji} *Jupiter:*`
          : `🧠 Jupiter looped in ${agent.emoji} *${agent.name}* (${agent.designation}):`;
      await ctx
        .reply(`${label}\n\n${reply}`, { parse_mode: "Markdown" })
        .catch(() => ctx.reply(`${agent.emoji} ${agent.name}:\n\n${reply}`));
    } catch (err) {
      await ctx.reply(`❌ ${err instanceof Error ? err.message : "Team unavailable"}`);
    }
  });

  // Callback queries for platform selection
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith("platform:")) {
      const parts = data.split(":");
      const platform = parts[1];

      await ctx.answerCallbackQuery({
        text: `Selected: ${platform}`,
      });

      // In production, this would create a draft via the API
      await ctx.editMessageText(
        `✅ Draft created for *${platform}*!\n\nView in the web dashboard to review and schedule.`,
        { parse_mode: "Markdown" }
      );
    }
  });

  // Photo handler — the image round-trip:
  // bot sends Venus's brief → boss generates the image anywhere and sends it
  // here → Venus (vision) judges it → attach to the pending post, or send a
  // refined prompt to try again.
  bot.on("message:photo", async (ctx) => {
    if (!isAdmin(ctx)) return;

    try {
      const { desc: descOp, eq: eqOp } = await import("drizzle-orm");
      const pending = await db
        .select()
        .from(reviewQueue)
        .where(eqOp(reviewQueue.reviewStatus, "pending_review"))
        .orderBy(descOp(reviewQueue.createdAt))
        .limit(5);
      const target = pending.find(
        (r) => (r.previewData as { imagePrompt?: string })?.imagePrompt
      );
      if (!target) {
        await ctx.reply("No post is waiting for an image right now. Run /build first.");
        return;
      }
      const preview = target.previewData as {
        text?: string;
        imagePrompt?: string;
        imagePath?: string | null;
        topic?: string;
      };

      await ctx.reply("🎨 Venus is reviewing your image...");

      // Download the largest size from Telegram
      const photos = ctx.message.photo;
      const file = await ctx.api.getFile(photos[photos.length - 1].file_id);
      const fileRes = await fetch(
        `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`
      );
      if (!fileRes.ok) throw new Error("Could not download image from Telegram");
      const bytes = new Uint8Array(await fileRes.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      const dataUrl = `data:image/jpeg;base64,${btoa(binary)}`;

      // Venus judges the image against her own brief
      const { analyzeImage } = await import("./ai");
      const raw = await analyzeImage(
        dataUrl,
        `You are Venus, the Visual Director. This image was generated for a tweet.\n\nTweet: "${preview.text}"\nYour original brief: "${preview.imagePrompt}"\n\nJudge it: does it fit the tweet, look photorealistic, and avoid AI tells (plastic skin, warped hands, nonsense text)? Respond ONLY with JSON: {"fits": boolean, "feedback": "one sentence", "improvedPrompt": "a refined generation prompt, only if fits is false, else null"}`,
        { agent: "manager", action: "image_review" }
      );
      let verdict: { fits?: boolean; feedback?: string; improvedPrompt?: string | null };
      try {
        verdict = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim());
      } catch {
        verdict = { fits: true, feedback: "Looks usable." };
      }

      if (verdict.fits) {
        const { saveImage } = await import("./storage");
        const saved = await saveImage(bytes, "image/jpeg", "uploads");
        await db
          .update(reviewQueue)
          .set({ previewData: { ...preview, imagePath: saved.url } })
          .where(eqOp(reviewQueue.id, target.id));
        const { drafts } = await import("./schema");
        await db.update(drafts).set({ imagePath: saved.url }).where(eqOp(drafts.id, target.draftId));
        await ctx.reply(
          `✅ Venus approved it — "${verdict.feedback}"\n\nImage attached to the post "${preview.topic}". Approve the post and it ships with this image.`
        );
      } else {
        await ctx.reply(
          `❌ Venus: "${verdict.feedback}"\n\nTry this refined prompt:\n\n\`\`\`\n${verdict.improvedPrompt || preview.imagePrompt}\n\`\`\``,
          { parse_mode: "Markdown" }
        );
      }
    } catch (err) {
      console.error("[Telegram] Photo review failed:", err);
      await ctx.reply("Something broke while reviewing the image — try sending it again.");
    }
  });
}

// ─── NOTIFY ADMIN ────────────────────────────────────────────────────────────

function generateProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return "█".repeat(filled) + "░".repeat(empty) + ` ${percent.toFixed(0)}%`;
}

export async function notifyAdmin(message: string): Promise<boolean> {
  // Read at call time — module-scope env can be empty on a cold start
  const adminId = process.env.TELEGRAM_ADMIN_ID ? parseInt(process.env.TELEGRAM_ADMIN_ID) : ADMIN_ID;
  if (!adminId) {
    console.error("[Telegram] TELEGRAM_ADMIN_ID not set — cannot notify");
    return false;
  }

  try {
    const bot = getBot();
    await bot.api.sendMessage(adminId, message, { parse_mode: "Markdown" });
    return true;
  } catch (err) {
    const inner = (err as { error?: unknown })?.error;
    console.error("[Telegram] Failed to notify admin:", err, "| inner:", inner instanceof Error ? `${inner.name}: ${inner.message}` : JSON.stringify(inner)?.slice(0, 300));
    // Markdown parse failures are the usual culprit — retry as plain text
    try {
      await getBot().api.sendMessage(adminId, message.replace(/[*_`]/g, ""));
      return true;
    } catch {
      return false;
    }
  }
}
