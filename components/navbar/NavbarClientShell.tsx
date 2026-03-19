"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

import { CreditBadge } from "@/components/CreditBadge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { WatchAdButton } from "@/components/WatchAdButton";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { primaryNavItems, secondaryNavItems, workspaceNavItems } from "@/components/navbar/config";

type CreditState = {
  credits: number | null;
  isPro: boolean;
};

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavbarClientShell() {
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

    async function updateFromSession(sessionUser: User | null, accessToken: string | null | undefined) {
      if (!active) return;
      setUser(sessionUser);

      if (accessToken) {
        await refreshCredits(accessToken);
      } else {
        setCredits({ credits: 1, isPro: false });
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      void updateFromSession(data.session?.user ?? null, data.session?.access_token);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void updateFromSession(session?.user ?? null, session?.access_token);
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
    setMobileOpen(false);
    router.push("/");
    router.refresh();
  }

  const desktopWorkspaceLinks = user ? [...workspaceNavItems, { href: "/admin", label: "Admin" }] : [];

  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        {user ? (
          <div className="flex items-center gap-4">
            {desktopWorkspaceLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  isActiveRoute(pathname, item.href) ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={isActiveRoute(pathname, item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}

        <CreditBadge credits={credits.credits} isPro={credits.isPro} />
        <ThemeToggle />

        {!user ? (
          <>
            <Button variant="ghost" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/generate">Generate</Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild>
              <Link href="/generate">Generate</Link>
            </Button>
            {!credits.isPro && (credits.credits ?? 0) < 3 ? (
              <WatchAdButton label="Watch Ad" variant="secondary" />
            ) : null}
            {!credits.isPro ? (
              <Button variant="secondary" asChild>
                <Link href="/pricing" className="gap-1">
                  <Sparkles className="h-4 w-4" />
                  Upgrade
                </Link>
              </Button>
            ) : null}
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

      {mobileOpen ? (
        <div id="mobile-navigation" className="border-t border-border/60 bg-background px-4 py-3 md:hidden">
          <div className="mb-3">
            <CreditBadge credits={credits.credits} isPro={credits.isPro} />
          </div>

          <nav aria-label="Mobile navigation" className="flex flex-col gap-5">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Browse</p>
              {[...primaryNavItems, ...secondaryNavItems].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-current={isActiveRoute(pathname, item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {user ? (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Workspace
                </p>
                {[...workspaceNavItems, { href: "/admin", label: "Admin" }].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-current={isActiveRoute(pathname, item.href) ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
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
                  <Link href="/generate" onClick={() => setMobileOpen(false)}>
                    Generate
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
    </>
  );
}
