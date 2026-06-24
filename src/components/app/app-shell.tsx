"use client";

import { useEffect, useState } from "react";
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
  Menu,
  X,
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

function useIsActive() {
  const pathname = usePathname();
  return (href: string): boolean => {
    if (href === "/") return pathname === "/";
    if (href === "/posts")
      return pathname === "/posts" || (pathname.startsWith("/posts/") && pathname !== "/posts/generate");
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        AI
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight">AI-Group</p>
        <p className="text-xs text-muted-foreground">LinkedIn Content</p>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const isActive = useIsActive();
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
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
  );
}

function UserFooter({ userName }: { userName: string }) {
  return (
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
  );
}

export function AppShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Sluit de drawer bij navigatie.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Voorkom scrollen van de achtergrond als de drawer open is.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="border-b px-6 py-5">
          <Brand />
        </div>
        <NavLinks />
        <UserFooter userName={userName} />
      </aside>

      {/* Mobiele drawer + overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[80%] flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-4">
              <Brand />
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                title="Menu sluiten"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setDrawerOpen(false)} />
            <UserFooter userName={userName} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobiele topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <Brand />
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            title="Menu openen"
            aria-label="Menu openen"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
