"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ─── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────────
// Global keyboard shortcuts for power-user navigation
// Ctrl/Cmd + N → Content Studio
// Ctrl/Cmd + K → Command palette (search)
// Escape → Close dialogs

const ROUTES = [
  { label: "Dashboard", path: "/", keywords: ["home", "dashboard", "overview"] },
  { label: "Content Studio", path: "/content", keywords: ["content", "create", "post", "write"] },
  { label: "Queue", path: "/queue", keywords: ["queue", "schedule", "pending"] },
  { label: "Calendar", path: "/calendar", keywords: ["calendar", "plan"] },
  { label: "Analytics", path: "/analytics", keywords: ["analytics", "stats", "metrics"] },
  { label: "AI Insights", path: "/insights", keywords: ["insights", "learning", "ai"] },
  { label: "Events", path: "/events", keywords: ["events", "dates"] },
  { label: "Images", path: "/images", keywords: ["images", "photos", "generate"] },
  { label: "Trends", path: "/trends", keywords: ["trends", "trending", "hashtags"] },
  { label: "Marketing Hub", path: "/marketing", keywords: ["marketing", "hub"] },
  { label: "Campaigns", path: "/marketing/campaigns", keywords: ["campaigns", "campaign"] },
  { label: "Ad Copy", path: "/marketing/ad-copy", keywords: ["ad", "copy", "ads"] },
  { label: "Competitors", path: "/marketing/competitors", keywords: ["competitors", "competitor", "intelligence"] },
  { label: "Content Planner", path: "/marketing/planner", keywords: ["planner", "content calendar"] },
  { label: "Settings", path: "/settings", keywords: ["settings", "config", "configuration"] },
  { label: "Agent Logs", path: "/logs", keywords: ["logs", "agent", "activity"] },
];

export function KeyboardShortcuts() {
  const router = useRouter();
  const [showPalette, setShowPalette] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = ROUTES.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.label.toLowerCase().includes(q) ||
      r.keywords.some((k) => k.includes(q))
    );
  });

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + N → Content Studio
      if (mod && e.key === "n") {
        e.preventDefault();
        router.push("/content");
        return;
      }

      // Ctrl/Cmd + K → Command palette
      if (mod && e.key === "k") {
        e.preventDefault();
        setShowPalette((v) => !v);
        setSearch("");
        return;
      }

      // Escape → Close palette
      if (e.key === "Escape") {
        setShowPalette(false);
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  if (!showPalette) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setShowPalette(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center border-b border-zinc-800 px-4">
          <svg
            className="h-4 w-4 text-zinc-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages..."
            className="flex-1 bg-transparent px-3 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) {
                router.push(filtered[0].path);
                setShowPalette(false);
              }
            }}
          />
          <kbd className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length > 0 ? (
            filtered.map((route) => (
              <button
                key={route.path}
                onClick={() => {
                  router.push(route.path);
                  setShowPalette(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-left"
              >
                <span className="text-zinc-500 text-xs font-mono w-6 text-right">
                  /
                </span>
                <span>{route.label}</span>
                <span className="ml-auto text-[10px] text-zinc-600">
                  {route.path}
                </span>
              </button>
            ))
          ) : (
            <p className="px-4 py-6 text-center text-xs text-zinc-600">
              No pages found
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-4 py-2 flex items-center justify-between text-[10px] text-zinc-600">
          <span>Navigate with keyboard</span>
          <div className="flex gap-2">
            <span>
              <kbd className="bg-zinc-800 px-1 py-0.5 rounded">Enter</kbd> to
              go
            </span>
            <span>
              <kbd className="bg-zinc-800 px-1 py-0.5 rounded">Esc</kbd> to
              close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
