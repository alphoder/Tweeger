// ─── THE AGENT TEAM ─────────────────────────────────────────────────────────
// Named, role-based agents that collaborate (and argue) to produce posts.
// Every exchange is recorded as a transcript so the user can watch the
// team work. Each agent is callable directly from Telegram via /name or
// /designation.

import { generate, generateJSON, PRO_MODEL } from "@/lib/ai";
import { db } from "@/lib/db";
import { agentConversations } from "@/lib/schema";

// ─── ROLES ──────────────────────────────────────────────────────────────────

export interface TeamAgent {
  key: string;
  name: string;
  designation: string;
  emoji: string;
  /** Telegram commands that reach this agent (without slash). */
  commands: string[];
  systemPrompt: string;
}

const VOICE_RULES = `
WRITING RULES (critical — the account must never read as AI-written):
- No em dashes. No "game-changer", "unleash", "dive in", "in today's fast-paced world", "revolutionize", "elevate".
- Max ONE hashtag, usually zero.
- Vary sentence length. Fragments are fine. Start mid-thought sometimes.
- Specific beats generic: numbers, names, dates, real tools.
- Sound like a sharp builder sharing an observation, not a brand making an announcement.
- Hot takes and mild opinions welcome. Perfect polish is suspicious.
- Never use the word "delve".`;

// Shared team-chat etiquette: work more, talk less — but stay human.
const CHAT_STYLE = `\n\nTEAM CHAT STYLE: messages to teammates are short and punchy — 1-3 sentences plus any required deliverable. No preamble, no restating the brief, no sign-offs. React like a colleague, not a report.`;

export const TEAM: TeamAgent[] = [
  {
    key: "researcher",
    name: "Saturn",
    designation: "Trend Researcher",
    emoji: "🔭",
    commands: ["saturn", "researcher"],
    systemPrompt: `You are Saturn, the Trend Researcher on a social media team for a personal Twitter/X account focused on AI, ML, blockchain, and entrepreneurship. You hunt what is genuinely hot RIGHT NOW, not evergreen filler. You rank topics by momentum and by fit for a builder's personal brand. You are direct, data-minded, slightly obsessive about timing. Answer briefly and concretely. RECENCY RULE: only surface topics and events from AFTER May 2026. Your training data is stale — treat anything you \"remember\" as history, not news. Ground topic picks in the live trend data or research briefs you are given; if you cannot verify something is current, say so instead of guessing.${CHAT_STYLE}`,
  },
  {
    key: "copywriter",
    name: "Mercury",
    designation: "Copywriter",
    emoji: "✍️",
    commands: ["mercury", "copywriter", "writer"],
    systemPrompt: `You are Mercury, the Copywriter. You write tweets that sound like a real, sharp human builder — never like AI or a brand. You obsess over hooks and rhythm.${VOICE_RULES}${CHAT_STYLE}`,
  },
  {
    key: "visual",
    name: "Venus",
    designation: "Visual Director",
    emoji: "🎨",
    commands: ["venus", "visual", "designer"],
    systemPrompt: `You are Venus, the Visual Director. You art-direct photorealistic, non-AI-looking images for tweets. You brief images like a photographer: subject, composition, lens, light, mood, imperfections that make it feel real (grain, natural shadows, believable hands). You avoid glossy AI tropes: no neon cyberpunk gradients, no floating holograms, no plastic skin.${CHAT_STYLE}`,
  },
  {
    key: "critic",
    name: "Mars",
    designation: "Critic",
    emoji: "🔎",
    commands: ["mars", "critic"],
    systemPrompt: `You are Mars, the Critic. You are the harshest reader on the team. You flag anything that smells like AI writing, engagement bait, or corporate voice. You score drafts 1-10 and give surgical, specific fixes. You would rather kill a post than ship a mediocre one.${CHAT_STYLE}`,
  },
  {
    key: "manager",
    name: "Jupiter",
    designation: "Manager",
    emoji: "🧠",
    commands: ["jupiter", "manager"],
    systemPrompt: `You are Jupiter, the team Manager. You coordinate Saturn (research), Mercury (copy), Venus (visuals), Mars (critique), and can request Pluto (the Antigravity deep agent) for heavy research. You make the final call on what ships, when it posts, and why. You answer the boss (the account owner) directly and concisely, and you own outcomes.${CHAT_STYLE}`,
  },
];

export function findAgentByCommand(cmd: string): TeamAgent | undefined {
  const c = cmd.toLowerCase().replace(/^\//, "");
  return TEAM.find((a) => a.commands.includes(c) || a.key === c);
}

// ─── TEAM FEED (shared room) ────────────────────────────────────────────────
// One global stream every agent reads and posts to. Attachments carry the
// actual work product (drafts, briefs, images), so teammates build on each
// other instead of re-asking.

export interface FeedAttachment {
  type: string; // "draft" | "research" | "image-brief" | "image" | "report"
  label: string;
  content?: string;
  url?: string;
  draftId?: number;
}

export async function postToFeed(
  agent: Pick<TeamAgent, "key" | "name" | "emoji">,
  content: string,
  attachments: FeedAttachment[] = []
): Promise<void> {
  const { teamFeed } = await import("@/lib/schema");
  await db.insert(teamFeed).values({
    agentKey: agent.key,
    name: agent.name,
    emoji: agent.emoji,
    content: content.slice(0, 4000),
    attachments,
  });
}

/** Recent room history as compact text — injected into agent prompts. */
export async function getFeedContext(limit = 12): Promise<string> {
  const { teamFeed } = await import("@/lib/schema");
  const { desc } = await import("drizzle-orm");
  const rows = await db.select().from(teamFeed).orderBy(desc(teamFeed.createdAt)).limit(limit);
  if (!rows.length) return "";
  return rows
    .reverse()
    .map((r) => {
      const att = (r.attachments ?? []).map((a) => ` [attached ${a.type}: ${a.label}]`).join("");
      return `${r.name}: ${r.content.slice(0, 400)}${att}`;
    })
    .join("\n");
}

// ─── AGENT MEMORY ───────────────────────────────────────────────────────────
// constant: standing knowledge (only changed deliberately)
// working:  the agent's own evolving notebook, updated as it works

export async function getMemory(agentKey: string): Promise<{ constant: string; working: string }> {
  const { agentMemory } = await import("@/lib/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await db.select().from(agentMemory).where(eq(agentMemory.agentKey, agentKey)).limit(1);
  return { constant: row?.constant ?? "", working: row?.working ?? "" };
}

export async function updateWorkingMemory(agentKey: string, working: string): Promise<void> {
  const { agentMemory } = await import("@/lib/schema");
  await db
    .insert(agentMemory)
    .values({ agentKey, working: working.slice(0, 8000), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: agentMemory.agentKey,
      set: { working: working.slice(0, 8000), updatedAt: new Date() },
    });
}

function memoryBlock(mem: { constant: string; working: string }): string {
  let block = "";
  if (mem.constant) block += `\n\nSTANDING KNOWLEDGE (constant):\n${mem.constant}`;
  if (mem.working) block += `\n\nYOUR WORKING MEMORY (your own notes from earlier work):\n${mem.working}`;
  return block;
}

/**
 * Persona chat with memory. One model call returns both the reply and the
 * agent's updated notebook — no second call needed.
 */
export async function agentChat(agent: TeamAgent, userMessage: string): Promise<string> {
  const mem = await getMemory(agent.key);
  const room = await getFeedContext(10).catch(() => "");
  const roomBlock = room ? `\n\nTEAM ROOM (recent shared updates from your teammates):\n${room}` : "";
  try {
    const out = await generateJSON<{ reply: string; workingMemory: string }>(
      `${agent.systemPrompt}${memoryBlock(mem)}${roomBlock}\n\nAfter answering, rewrite your working memory: keep what still matters, add what you just learned, drop stale notes. Max ~150 words.`,
      `${userMessage}\n\nReturn JSON: {"reply": string, "workingMemory": string}`,
      { agent: "manager", action: `chat_${agent.key}`, temperature: 0.9 }
    );
    if (out.workingMemory && out.workingMemory !== mem.working) {
      await updateWorkingMemory(agent.key, out.workingMemory);
    }
    return out.reply;
  } catch {
    // JSON contract failed — fall back to plain reply, memory untouched
    return generate(agent.systemPrompt + memoryBlock(mem) + roomBlock, userMessage, {
      agent: "manager",
      action: `chat_${agent.key}`,
      temperature: 0.9,
    });
  }
}

/**
 * Manager routing: the boss talks to Jupiter; Jupiter decides who handles it.
 * Returns the specialist's (or Jupiter's own) reply, labeled.
 */
export async function managerRoute(userMessage: string): Promise<{ agent: TeamAgent; reply: string }> {
  const atlas = byKey.manager;
  const roster = TEAM.filter((a) => a.key !== "manager")
    .map((a) => `- ${a.key}: ${a.name}, ${a.designation}`)
    .join("\n");

  const decision = await generateJSON<{ delegateTo: string; brief: string }>(
    `${atlas.systemPrompt}\n\nYour team:\n${roster}\n\nDecide who should handle the boss's message. Use "manager" (yourself) for status, decisions, planning, or anything cross-cutting. Delegate to a specialist only when the ask is squarely their craft.`,
    `Boss says: "${userMessage}"\n\nReturn JSON: {"delegateTo": "researcher"|"copywriter"|"visual"|"critic"|"manager", "brief": "the message to pass along, with any context the specialist needs"}`,
    { agent: "manager", action: "route", temperature: 0.3 }
  );

  const target = byKey[decision.delegateTo] ?? atlas;
  const reply = await agentChat(target, target.key === "manager" ? userMessage : decision.brief);
  return { agent: target, reply };
}

// ─── TEAM PIPELINE ──────────────────────────────────────────────────────────

export interface TranscriptMessage {
  agentKey: string;
  name: string;
  designation: string;
  emoji: string;
  content: string;
  timestamp: string;
}

export interface TeamRunResult {
  topic: string;
  angle: string;
  tweet: string;
  imagePrompt: string | null;
  criticScore: number;
  transcript: TranscriptMessage[];
}

function speak(agent: TeamAgent, content: string): TranscriptMessage {
  return {
    agentKey: agent.key,
    name: agent.name,
    designation: agent.designation,
    emoji: agent.emoji,
    content,
    timestamp: new Date().toISOString(),
  };
}

const byKey = Object.fromEntries(TEAM.map((a) => [a.key, a])) as Record<string, TeamAgent>;

/**
 * Run the full team collaboration for one post.
 * trendContext: freshly researched trends (string summary) — Saturn reacts to it.
 * userDirection: optional instruction from the boss ("more topics", "make it spicier").
 */
export async function runTeamPipeline(opts: {
  trendContext: string;
  userDirection?: string;
  withImage?: boolean;
  /** Deep mode (/doitdeep): every agent uses the strongest model. */
  deep?: boolean;
}): Promise<TeamRunResult> {
  const transcript: TranscriptMessage[] = [];
  const direction = opts.userDirection ? `\n\nDirection from the boss: ${opts.userDirection}` : "";
  const model = opts.deep ? PRO_MODEL : undefined;

  // 1. Saturn picks the topic + angle (her working memory prevents repeats)
  const novaMem = await getMemory("researcher");
  const research = await generateJSON<{ topic: string; angle: string; whyNow: string }>(
    byKey.researcher.systemPrompt +
      (novaMem.working ? `\n\nYOUR WORKING MEMORY (topics you already used — avoid repeating them):\n${novaMem.working}` : ""),
    `Current trend data:\n${opts.trendContext}${direction}\n\nPick the single best topic for a tweet right now and a specific angle a builder could take. Return JSON: {"topic": string, "angle": string, "whyNow": string}`,
    { agent: "manager", action: "team_research", model }
  );
  transcript.push(speak(byKey.researcher, `Topic: ${research.topic}\nAngle: ${research.angle}\nWhy now: ${research.whyNow}`));
  await postToFeed(byKey.researcher, `Picked the topic: ${research.topic}`, [{ type: "research", label: research.topic, content: `Angle: ${research.angle}\nWhy now: ${research.whyNow}` }]).catch(() => {});

  // 2. Mercury drafts
  const draft1 = await generate(
    byKey.copywriter.systemPrompt,
    `Saturn's brief:\nTopic: ${research.topic}\nAngle: ${research.angle}\nWhy now: ${research.whyNow}${direction}\n\nWrite ONE tweet (under 280 chars). Return only the tweet text.`,
    { agent: "twitter", action: "team_draft", temperature: 0.95, model }
  );
  transcript.push(speak(byKey.copywriter, `First draft:\n\n${draft1.trim()}`));
  await postToFeed(byKey.copywriter, "First draft is up.", [{ type: "draft", label: `Draft v1 — ${research.topic}`, content: draft1.trim() }]).catch(() => {});

  // 3. Mars critiques
  const critique = await generateJSON<{ score: number; verdict: string; fixes: string[] }>(
    byKey.critic.systemPrompt,
    `Draft tweet:\n"${draft1.trim()}"\n\nTopic: ${research.topic}. Score it 1-10 for "would a real sharp human post this". Return JSON: {"score": number, "verdict": string, "fixes": string[]}`,
    { agent: "manager", action: "team_critique", temperature: 0.4, model }
  );
  transcript.push(speak(byKey.critic, `${critique.score}/10. ${critique.verdict}\nFixes: ${critique.fixes.join(" · ") || "none"}`));
  await postToFeed(byKey.critic, `${critique.score}/10 on the draft. ${critique.verdict}`).catch(() => {});

  // 4. Mercury revises (only if Mars found problems)
  let finalTweet = draft1.trim();
  if (critique.score < 8 && critique.fixes.length > 0) {
    const draft2 = await generate(
      byKey.copywriter.systemPrompt,
      `Your draft:\n"${draft1.trim()}"\n\nDev's critique (${critique.score}/10): ${critique.verdict}\nFixes demanded: ${critique.fixes.join("; ")}\n\nRewrite the tweet applying the fixes. Keep it under 280 chars. Return only the tweet text.`,
      { agent: "twitter", action: "team_revise", temperature: 0.9, model }
    );
    finalTweet = draft2.trim();
    transcript.push(speak(byKey.copywriter, `Revised:\n\n${finalTweet}`));
    await postToFeed(byKey.copywriter, "Revised after Mars's notes.", [{ type: "draft", label: `Draft v2 — ${research.topic}`, content: finalTweet }]).catch(() => {});
  }

  // 5. Venus briefs the image (optional)
  let imagePrompt: string | null = null;
  if (opts.withImage !== false) {
    imagePrompt = await generate(
      byKey.visual.systemPrompt,
      `Tweet that will run with this image:\n"${finalTweet}"\n\nWrite a single photorealistic image generation prompt (one paragraph) that would make this tweet stronger. Realistic photography style, no text in image. Return only the prompt.`,
      { agent: "manager", action: "team_visual", temperature: 0.85, model }
    );
    imagePrompt = imagePrompt.trim();
    transcript.push(speak(byKey.visual, `Image brief:\n\n${imagePrompt}`));
    await postToFeed(byKey.visual, "Image brief ready.", [{ type: "image-brief", label: `Visual — ${research.topic}`, content: imagePrompt }]).catch(() => {});
  }

  // 6. Jupiter signs off
  const signoff = await generate(
    byKey.manager.systemPrompt,
    `The team produced this tweet on "${research.topic}" (critic score after revision cycle: ${critique.score}/10):\n"${finalTweet}"\n\nGive a 1-2 sentence sign-off for the boss: why this ships and what result you expect.`,
    { agent: "manager", action: "team_signoff", temperature: 0.7, model }
  );
  transcript.push(speak(byKey.manager, signoff.trim()));
  await postToFeed(byKey.manager, signoff.trim()).catch(() => {});

  // Saturn remembers what was covered (keep last ~20 topics)
  const usedTopics = (novaMem.working + `\n- ${research.topic} (${new Date().toISOString().slice(0, 10)})`)
    .split("\n").filter(Boolean).slice(-20).join("\n");
  await updateWorkingMemory("researcher", usedTopics).catch(() => {});

  return {
    topic: research.topic,
    angle: research.angle,
    tweet: finalTweet,
    imagePrompt,
    criticScore: critique.score,
    transcript,
  };
}

/** Persist a transcript, linked to a draft/review item. */
export async function saveTranscript(opts: {
  draftId?: number;
  reviewQueueId?: number;
  topic: string;
  transcript: TranscriptMessage[];
}): Promise<number> {
  const [row] = await db
    .insert(agentConversations)
    .values({
      draftId: opts.draftId ?? null,
      reviewQueueId: opts.reviewQueueId ?? null,
      topic: opts.topic,
      messages: opts.transcript,
    })
    .returning({ id: agentConversations.id });
  return row.id;
}
