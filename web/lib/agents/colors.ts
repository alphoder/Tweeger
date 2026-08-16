// ─── AGENT COLORS ───────────────────────────────────────────────────────────
// Client-safe (no db imports). In a monochrome Codex-style UI, the agents
// are the only source of color — one hue each, everywhere they appear.

export const AGENT_COLORS: Record<
  string,
  { text: string; bg: string; ring: string }
> = {
  manager: { text: "text-orange-400", bg: "bg-orange-400/15", ring: "ring-orange-400/40" }, // Jupiter
  researcher: { text: "text-sky-400", bg: "bg-sky-400/15", ring: "ring-sky-400/40" }, // Saturn
  copywriter: { text: "text-emerald-400", bg: "bg-emerald-400/15", ring: "ring-emerald-400/40" }, // Mercury
  visual: { text: "text-pink-400", bg: "bg-pink-400/15", ring: "ring-pink-400/40" }, // Venus
  critic: { text: "text-red-400", bg: "bg-red-400/15", ring: "ring-red-400/40" }, // Mars
  pluto: { text: "text-violet-400", bg: "bg-violet-400/15", ring: "ring-violet-400/40" }, // Pluto
};

export function agentColor(key: string) {
  return AGENT_COLORS[key] ?? { text: "text-zinc-300", bg: "bg-zinc-400/15", ring: "ring-zinc-400/40" };
}
