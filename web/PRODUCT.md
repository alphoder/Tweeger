# FineTweet

One-line: A personal multi-agent Twitter/X manager — five named AI agents research trends, draft tweets, critique, generate images, and schedule posts, with the owner approving everything from Telegram or the web dashboard.

- **Register:** product (dashboard/tool — design serves the work)
- **User:** exactly one — Vedant, the account owner. Uses it on a laptop at night and from a phone via Telegram. Dark, quiet, monospace-adjacent: a command room, not a marketing site.
- **Platform:** Next.js 16 App Router on Cloudflare Workers (OpenNext). Tailwind v4, shadcn/ui, lucide icons. Neon Postgres. Telegram (grammY) is the primary remote control.
- **Theme:** Codex-style monochrome dark. Near-black surfaces (`#0d0d0d` bg, `#171717` cards), off-white type, white primary buttons. **The only color comes from the six agents** (Jupiter orange, Saturn sky, Mercury emerald, Venus pink, Mars red, Pluto violet — `lib/agents/colors.ts`) and semantic green/red.
- **Core surfaces (sidebar, in order):** Command Center `/`, Review Deck `/review`, Team Room `/team`, Post Queue `/queue`, Analytics `/analytics`, Agent Logs `/logs`, Settings `/settings`.
- **Voice:** terse, operator-grade. No marketing copy inside the tool. Empty states tell you the exact command to run next (usually a Telegram command like `/build`).
- **Never:** multi-platform chrome (this is Twitter-only), AI-slop gradients, glassmorphism, hero-metric templates, side-stripe accents.
