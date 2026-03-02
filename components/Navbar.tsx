"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Camera, LogOut, Menu, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

import { CreditBadge } from "@/components/CreditBadge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { WatchAdButton } from "@/components/WatchAdButton";
import { createBrowserSupabaseClient } from "@/lib/supabase";

const navItems = [
  { href: "/gallery", label: "Gallery" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/community", label: "Community" },
  { href: "/api-access", label: "API" },
  { href: "/pricing", label: "Pricing" },
];

type CreditState = {
  credits: number | null;
  isPro: boolean;
};

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<CreditState>({
    credits: null,
    isPro: false,
  });

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      if (data.session?.access_token) {
        await refreshCredits(data.session.access_token);
      } else {
        setCredits({ credits: 1, isPro: false });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (session?.access_token) {
        await refreshCredits(session.access_token);
      } else {
        setCredits({ credits: 1, isPro: false });
      }
      router.refresh();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    async function refreshFromSession() {
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await refreshCredits(token);
      } else {
        setCredits({ credits: 1, isPro: false });
      }
    }

    function onCreditsUpdated() {
      void refreshFromSession();
    }

    window.addEventListener("credits-updated", onCreditsUpdated);
    return () => {
      window.removeEventListener("credits-updated", onCreditsUpdated);
    };
  }, [supabase]);

  async function refreshCredits(token: string) {
    const response = await fetch("/api/credits", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = await response.json();
    setCredits({
      credits: payload.credits ?? 0,
      isPro: Boolean(payload.isPro),
    });
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed out");
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <div className="rounded-full bg-primary/18 p-1.5">
              <Camera className="h-4 w-4 text-primary" />
            </div>
            <span>PromptGallery</span>
          </Link>

          <nav aria-label="Primary navigation" className="hidden items-center gap-5 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm transition-colors ${
                  isActiveRoute(pathname, item.href)
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={isActiveRoute(pathname, item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <Link
                href="/dashboard"
                className={`text-sm transition-colors ${
                  isActiveRoute(pathname, "/dashboard")
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={isActiveRoute(pathname, "/dashboard") ? "page" : undefined}
              >
                Dashboard
              </Link>
            ) : null}
            {user ? (
              <Link
                href="/dashboard/api"
                className={`text-sm transition-colors ${
                  isActiveRoute(pathname, "/dashboard/api")
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={isActiveRoute(pathname, "/dashboard/api") ? "page" : undefined}
              >
                API Keys
              </Link>
            ) : null}
            {user ? (
              <Link
                href="/creator"
                className={`text-sm transition-colors ${
                  isActiveRoute(pathname, "/creator")
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={isActiveRoute(pathname, "/creator") ? "page" : undefined}
              >
                Creator
              </Link>
            ) : null}
            {user ? (
              <Link
                href="/admin"
                className={`text-sm transition-colors ${
                  isActiveRoute(pathname, "/admin")
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={isActiveRoute(pathname, "/admin") ? "page" : undefined}
              >
                Admin
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <CreditBadge credits={credits.credits} isPro={credits.isPro} />
          <ThemeToggle />
          {!user ? (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Try Free</Link>
              </Button>
            </>
          ) : (
            <>
              {!credits.isPro && (credits.credits ?? 0) < 3 && (
                <WatchAdButton label="Watch Ad" variant="secondary" />
              )}
              {!credits.isPro && (
                <Button variant="secondary" asChild>
                  <Link href="/pricing" className="gap-1">
                    <Sparkles className="h-4 w-4" />
                    Upgrade
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMobileOpen((state) => !state)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-controls="mobile-navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div id="mobile-navigation" className="border-t border-border/60 bg-background px-4 py-3 md:hidden">
          <div className="mb-3">
            <CreditBadge credits={credits.credits} isPro={credits.isPro} />
          </div>
          <nav aria-label="Mobile navigation" className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-current={isActiveRoute(pathname, item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            {user && (
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-current={isActiveRoute(pathname, "/dashboard") ? "page" : undefined}
              >
                Dashboard
              </Link>
            )}
            {user && (
              <Link
                href="/dashboard/api"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-current={isActiveRoute(pathname, "/dashboard/api") ? "page" : undefined}
              >
                API Keys
              </Link>
            )}
            {user && (
              <Link
                href="/creator"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-current={isActiveRoute(pathname, "/creator") ? "page" : undefined}
              >
                Creator
              </Link>
            )}
            {user && (
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-current={isActiveRoute(pathname, "/admin") ? "page" : undefined}
              >
                Admin
              </Link>
            )}
          </nav>
          <div className="mt-3 flex gap-2">
            {!user ? (
              <>
                <Button variant="outline" className="flex-1" asChild>
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    Login
                  </Link>
                </Button>
                <Button className="flex-1" asChild>
                  <Link href="/signup" onClick={() => setMobileOpen(false)}>
                    Try Free
                  </Link>
                </Button>
              </>
            ) : (
              <div className="grid w-full gap-2">
                {!credits.isPro && (credits.credits ?? 0) < 3 ? (
                  <WatchAdButton label="Watch Ad" variant="secondary" className="w-full" />
                ) : null}
                <Button variant="outline" className="w-full" onClick={signOut}>
                  Sign Out
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
