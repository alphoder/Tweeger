"use client";

// ─── TEAM ROOM ───────────────────────────────────────────────────────────────
// The shared channel where all six agents post their work with attachments.

import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Search, Paperclip } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { agentColor } from "@/lib/agents/colors";
import { PageHeader } from "@/components/page-shell";

interface FeedMessage {
  id: number;
  agentKey: string;
  name: string;
  emoji: string;
  content: string;
  attachments: { type: string; label: string; content?: string; url?: string }[];
  createdAt: string;
}

const ATT_ICON: Record<string, React.ElementType> = {
  draft: FileText,
  research: Search,
  "image-brief": ImageIcon,
  image: ImageIcon,
};

export default function TeamRoomPage() {
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/team/feed?limit=80");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 6000); // the room stays live
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col space-y-4">
      <PageHeader title="Team Room" description="One channel, six agents — live">
        <span className="flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </PageHeader>

      <Card className="flex-1 overflow-hidden border-zinc-800 bg-zinc-900/40">
        <CardContent className="h-full overflow-y-auto p-4">
          {loading ? (
            <p className="py-12 text-center text-sm text-zinc-500">Loading the room...</p>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-zinc-400">The room is quiet.</p>
              <p className="mt-1 text-sm text-zinc-600">
                Run <span className="font-mono text-zinc-200">/build</span> or{" "}
                <span className="font-mono text-zinc-200">/doitdeep</span> on Telegram — the team
                will start posting their work here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <div key={m.id} className="flex gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ring-1 ${agentColor(m.agentKey).bg} ${agentColor(m.agentKey).ring}`}>
                    {m.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className={`font-semibold ${agentColor(m.agentKey).text}`}>{m.name}</span>{" "}
                      <span className="text-xs text-zinc-500">
                        {new Date(m.createdAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                      {m.content}
                    </p>
                    {m.attachments?.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {m.attachments.map((a, i) => {
                          const Icon = ATT_ICON[a.type] || Paperclip;
                          const key = m.id * 100 + i;
                          return (
                            <div
                              key={i}
                              className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 transition-colors hover:border-zinc-600/40"
                              onClick={() => setExpanded(expanded === key ? null : key)}
                            >
                              <p className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                                <Icon className="h-3.5 w-3.5" />
                                {a.label}
                                <span className="ml-auto font-normal uppercase tracking-wider text-zinc-600">
                                  {a.type}
                                </span>
                              </p>
                              {a.url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={a.url} alt={a.label} className="mt-2 max-h-64 rounded-md border border-zinc-800" />
                              )}
                              {a.content && (
                                <p
                                  className={`mt-2 whitespace-pre-wrap text-sm text-zinc-300 ${
                                    expanded === key ? "" : "line-clamp-3"
                                  }`}
                                >
                                  {a.content}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
