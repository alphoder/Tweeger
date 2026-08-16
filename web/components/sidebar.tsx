"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Zap,
  LayoutDashboard,
  Clock,
  BarChart3,
  Users,
  Terminal,
  Settings,
  LogOut,
  Menu,
  X,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

// ─── NAVIGATION CONFIG ───────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

// ponytail: single-account Twitter tool — 7 items max. The removed pages
// (/brand, /content, /images, /calendar, /insights, /events, /marketing)
// still exist at their URLs if ever needed.
const NAV_ITEMS: NavItem[] = [
  { label: "Command Center", href: "/", icon: LayoutDashboard },
  { label: "Review Deck", href: "/review", icon: CheckSquare },
  { label: "Team Room", href: "/team", icon: Users },
  { label: "Post Queue", href: "/queue", icon: Clock },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Agent Logs", href: "/logs", icon: Terminal },
  { label: "Settings", href: "/settings", icon: Settings },
];

// ─── SIDEBAR CONTENT ─────────────────────────────────────────────────────────

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/auth", { method: "DELETE" });
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Logout failed");
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
          <Zap className="h-5 w-5 text-black" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-50">
            FineTweet
          </h1>
          <p className="text-[11px] font-medium tracking-widest text-zinc-400 uppercase">
            Agent Team
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => {
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-zinc-800/80 text-zinc-400"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-zinc-800 px-3 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

// ─── SIDEBAR WRAPPER ─────────────────────────────────────────────────────────

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-zinc-800 bg-zinc-950">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl px-4 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger className="inline-flex items-center justify-center rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-64 border-zinc-800 bg-zinc-950 p-0"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent onItemClick={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 ml-3">
          <Zap className="h-5 w-5 text-zinc-400" />
          <span className="font-bold text-zinc-50">FineTweet</span>
          <span className="text-[10px] font-medium tracking-widest text-zinc-400 uppercase">
            Agent Team
          </span>
        </div>
      </div>
    </>
  );
}
