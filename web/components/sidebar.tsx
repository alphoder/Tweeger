"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Zap,
  LayoutDashboard,
  PenTool,
  Image,
  Clock,
  CalendarRange,
  BarChart3,
  Brain,
  CalendarDays,
  Megaphone,
  Target,
  Copy,
  Users,
  CalendarClock,
  Terminal,
  Settings,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Globe,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";

// ─── NAVIGATION CONFIG ───────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Command Center", href: "/", icon: LayoutDashboard },
  { label: "Brand Setup", href: "/brand", icon: Globe },
  { label: "Review Deck", href: "/review", icon: CheckSquare },
  { label: "Content Studio", href: "/content", icon: PenTool },
  { label: "Image Studio", href: "/images", icon: Image },
  { label: "Post Queue", href: "/queue", icon: Clock },
  { label: "Calendar", href: "/calendar", icon: CalendarRange },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Team Room", href: "/team", icon: Users },
  { label: "AI Insights", href: "/insights", icon: Brain },
  { label: "Events", href: "/events", icon: CalendarDays },
  {
    label: "Marketing Hub",
    href: "/marketing",
    icon: Megaphone,
    children: [
      { label: "Campaigns", href: "/marketing/campaigns", icon: Target },
      { label: "Ad Copy", href: "/marketing/ad-copy", icon: Copy },
      { label: "Competitors", href: "/marketing/competitors", icon: Users },
      { label: "Content Planner", href: "/marketing/planner", icon: CalendarClock },
    ],
  },
  { label: "Agent Logs", href: "/logs", icon: Terminal },
  { label: "Settings", href: "/settings", icon: Settings },
];

// ─── PLATFORM STATUS ─────────────────────────────────────────────────────────

const PLATFORMS = [
  { name: "Twitter", connected: true, color: "bg-zinc-500" },
  { name: "LinkedIn", connected: false, color: "bg-blue-600" },
  { name: "Instagram", connected: false, color: "bg-amber-500" },
  { name: "Facebook", connected: false, color: "bg-blue-500" },
];

// ─── SIDEBAR CONTENT ─────────────────────────────────────────────────────────

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [marketingOpen, setMarketingOpen] = useState(
    pathname.startsWith("/marketing")
  );

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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 shadow-lg shadow-zinc-500/20">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-50">
            Axon
          </h1>
          <p className="text-[11px] font-medium tracking-widest text-zinc-400 uppercase">
            Social AI
          </p>
        </div>
      </div>

      {/* Platform status indicators */}
      <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg bg-zinc-900/50 px-3 py-2">
        {PLATFORMS.map((p) => (
          <div key={p.name} className="flex items-center gap-1.5" title={p.name}>
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                p.connected ? p.color : "bg-zinc-700"
              )}
            />
            <span className="text-[10px] text-zinc-500">{p.name[0]}</span>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => {
          if (item.children) {
            return (
              <Collapsible
                key={item.href}
                open={marketingOpen}
                onOpenChange={setMarketingOpen}
              >
                <CollapsibleTrigger
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                    pathname.startsWith(item.href)
                      ? "bg-zinc-800/80 text-zinc-400"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      marketingOpen && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-4 mt-1 space-y-1 border-l border-zinc-800 pl-3">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onItemClick}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        pathname === child.href
                          ? "bg-zinc-800/80 text-zinc-400 font-medium"
                          : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                      )}
                    >
                      <child.icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{child.label}</span>
                    </Link>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          }

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
          <span className="font-bold text-zinc-50">Axon</span>
          <span className="text-[10px] font-medium tracking-widest text-zinc-400 uppercase">
            Social AI
          </span>
        </div>
      </div>
    </>
  );
}
