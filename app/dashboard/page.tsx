"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Bookmark, Download, Loader2, Search, Sparkles } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";

import { CopyButton } from "@/components/CopyButton";
import { WatchAdButton } from "@/components/WatchAdButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildDashboardHistoryCsv,
  DashboardHistoryPeriod,
  DashboardHistorySort,
  filterDashboardHistory,
} from "@/lib/dashboard-history";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { Generation, Prompt, UserProfile } from "@/types";

type HistoryItem = Generation & {
  prompt: Prompt | null;
};

type ReferralStats = {
  referralCode: string | null;
  referralLink: string | null;
  totalReferrals: number;
  rewardedReferrals: number;
  pendingReferrals: number;
};

function getIstResetCountdown() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const istMs = utcMs + 330 * 60_000;
  const ist = new Date(istMs);
  const nextIstMidnightMs =
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1) - 330 * 60_000;
  const diffMs = Math.max(0, nextIstMidnightMs - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetCountdown, setResetCountdown] = useState(getIstResetCountdown());
  const [historySearch, setHistorySearch] = useState("");
  const [historyPeriod, setHistoryPeriod] = useState<DashboardHistoryPeriod>("all");
  const [historySort, setHistorySort] = useState<DashboardHistorySort>("newest");

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const filteredHistory = useMemo(
    () =>
      filterDashboardHistory(history, {
        search: historySearch,
        period: historyPeriod,
        sort: historySort,
      }),
    [history, historyPeriod, historySearch, historySort],
  );

  const sharedGenerations = useMemo(
    () => history.filter((item) => item.is_public).length,
    [history],
  );

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);

      if (!sessionUser) {
        setLoading(false);
        return;
      }

      const [{ data: profileData }, { data: generationRows }] = await Promise.all([
        supabase.from("users").select("*").eq("id", sessionUser.id).single(),
        supabase
          .from("generations")
          .select("*")
          .eq("user_id", sessionUser.id)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      setProfile((profileData as UserProfile | null) ?? null);

      if (generationRows && generationRows.length) {
        const promptIds = Array.from(new Set(generationRows.map((item) => item.prompt_id)));
        const { data: promptRows } = await supabase.from("prompts").select("*").in("id", promptIds);
        const promptMap = new Map((promptRows ?? []).map((prompt) => [prompt.id, prompt as Prompt]));
        setHistory(
          generationRows.map((generation) => ({
            ...(generation as Generation),
            prompt: promptMap.get(generation.prompt_id) ?? null,
          })),
        );
      } else {
        setHistory([]);
      }

      if (data.session?.access_token) {
        const token = data.session.access_token;
        const [creditResponse, referralResponse] = await Promise.all([
          fetch("/api/credits", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/referrals/stats", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (creditResponse.ok) {
          const payload = await creditResponse.json();
          setProfile((current) =>
            current
              ? {
                  ...current,
                  credits: payload.credits ?? current.credits,
                  is_pro: payload.isPro ?? current.is_pro,
                }
              : current,
          );
        }

        if (referralResponse.ok) {
          const referralPayload = (await referralResponse.json()) as ReferralStats;
          setReferralStats(referralPayload);
        }
      }
      setLoading(false);
    }

    void load();
  }, [supabase]);

  useEffect(() => {
    const interval = setInterval(() => {
      setResetCountdown(getIstResetCountdown());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function downloadHistoryCsv() {
    if (!filteredHistory.length) {
      toast.error("No history rows to export");
      return;
    }

    const csv = buildDashboardHistoryCsv(filteredHistory);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `promptgallery-history-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Login Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign in to access your dashboard, generation history, and credit usage.
            </p>
            <Button asChild>
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Track your generations and credits.</p>
          <div className="mt-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/saved" className="gap-1.5">
                <Bookmark className="h-4 w-4" />
                Saved Prompts
              </Link>
            </Button>
          </div>
        </div>
        <Card className="border-border/60 bg-card/70">
          <CardContent className="flex items-center gap-3 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Credits Remaining</p>
              <p className="text-2xl font-bold">
                {profile?.is_pro ? "Unlimited" : (profile?.credits ?? 0).toString()}
              </p>
              {!profile?.is_pro ? (
                <p className="text-xs text-muted-foreground">Daily reset (IST): {resetCountdown}</p>
              ) : null}
            </div>
            {!profile?.is_pro ? (
              <div className="flex gap-2">
                <WatchAdButton
                  label="Watch Ad"
                  onCredited={(credits) =>
                    setProfile((current) => (current ? { ...current, credits } : current))
                  }
                />
                <Button variant="secondary" asChild>
                  <Link href="/pricing" className="gap-1">
                    <Sparkles className="h-4 w-4" />
                    Upgrade to Pro
                  </Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {referralStats ? (
        <Card className="mb-6 border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="font-display text-xl">Referral Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Total referrals: {referralStats.totalReferrals} | Rewarded: {referralStats.rewardedReferrals}
            </p>
            <p className="text-muted-foreground">
              Your referral code: <span className="font-semibold text-foreground">{referralStats.referralCode ?? "-"}</span>
            </p>
            {referralStats.referralLink ? (
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/70 p-3">
                <p className="line-clamp-1 flex-1 text-xs text-muted-foreground">{referralStats.referralLink}</p>
                <CopyButton value={referralStats.referralLink} />
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Join me on PromptGallery and claim your free credits: ${referralStats.referralLink}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-6 border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle className="font-display text-xl">Generation History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Search prompt title, category, description"
                className="pl-9"
              />
            </div>
            <select
              value={historyPeriod}
              onChange={(event) => setHistoryPeriod(event.target.value as DashboardHistoryPeriod)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter history by period"
            >
              <option value="all">All Time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <select
              value={historySort}
              onChange={(event) => setHistorySort(event.target.value as DashboardHistorySort)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Sort history"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <Button variant="outline" onClick={downloadHistoryCsv} disabled={!filteredHistory.length}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Total: {history.length}</span>
            <span>Visible: {filteredHistory.length}</span>
            <span>Shared: {sharedGenerations}</span>
          </div>
        </CardContent>
      </Card>

      {history.length === 0 ? (
        <Card className="border-border/60 bg-card/70">
          <CardContent className="p-8 text-sm text-muted-foreground">
            No generations yet. Visit the gallery and start creating.
          </CardContent>
        </Card>
      ) : filteredHistory.length === 0 ? (
        <Card className="border-border/60 bg-card/70">
          <CardContent className="p-8 text-sm text-muted-foreground">
            No generations matched your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredHistory.map((item) => (
            <Card key={item.id} className="overflow-hidden border-border/60 bg-card/70">
              <div className="grid grid-cols-2">
                <div className="relative aspect-square">
                  <Image
                    src={item.original_image_url}
                    alt="Original"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 240px"
                  />
                </div>
                <div className="relative aspect-square">
                  <Image
                    src={item.generated_image_url}
                    alt="Generated"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 240px"
                  />
                </div>
              </div>
              <CardContent className="space-y-1 p-4">
                <p className="line-clamp-1 text-sm font-semibold">{item.prompt?.title ?? "Unknown prompt"}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(item.created_at), "MMM d, yyyy h:mm a")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
