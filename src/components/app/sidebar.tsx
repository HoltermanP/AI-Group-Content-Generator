"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  Sparkles,
  CalendarDays,
  Package,
  Building2,
  SlidersHorizontal,
  Plug,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/posts/generate", label: "Nieuwe post", icon: Sparkles },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/products", label: "Producten", icon: Package },
  { href: "/settings/company", label: "Bedrijfsprofiel", icon: Building2 },
  { href: "/settings/content", label: "Contentinstellingen", icon: SlidersHorizontal },
  { href: "/settings/integrations", label: "Integraties", icon: Plug },
];

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    if (href === "/posts") return pathname === "/posts" || (pathname.startsWith("/posts/") && pathname !== "/posts/generate");
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex items-center gap-2 border-b px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          AI
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">AI-Group</p>
          <p className="text-xs text-muted-foreground">LinkedIn Content</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-3">
        <div className="flex items-center justify-between rounded-md px-3 py-2">
          <span className="truncate text-sm text-muted-foreground">{userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-muted-foreground transition-colors hover:text-foreground"
            title="Uitloggen"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
