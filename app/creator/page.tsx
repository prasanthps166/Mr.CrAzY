"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, UploadCloud } from "lucide-react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { MarketplacePrompt } from "@/types";

type DashboardResponse = {
  creator: {
    id: string;
    display_name: string;
    razorpay_account_id: string | null;
    total_earnings: number;
    stripe_account_id: string | null;
  } | null;
  stats: {
    totalEarnings: number;
    totalSales: number;
    totalPrompts: number;
    averageRating: number;
  };
  chart: Array<{ month: string; earnings: number }>;
  prompts: Array<{ prompt: MarketplacePrompt; sales: number; earnings: number }>;
  pendingPayouts: number;
  onboardingStatus: {
    connected: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  };
};

function statusVariant(status: MarketplacePrompt["status"]) {
  if (status === "approved") return "default" as const;
  if (status === "rejected") return "destructive" as const;
  return "secondary" as const;
}

export default function CreatorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [deleteLoadingPromptId, setDeleteLoadingPromptId] = useState<string | null>(null);
  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token ?? null;
      setToken(accessToken);

      if (!accessToken) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/creator/dashboard", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as DashboardResponse;
      if (response.status === 403) {
        setData({
          creator: null,
          stats: { totalEarnings: 0, totalSales: 0, totalPrompts: 0, averageRating: 0 },
          chart: [],
          prompts: [],
          pendingPayouts: 0,
          onboardingStatus: { connected: false, chargesEnabled: false, payoutsEnabled: false },
        });
        setLoading(false);
        return;
      }

      if (!response.ok) {
        toast.error((payload as { message?: string }).message || "Failed to load creator dashboard");
        setLoading(false);
        return;
      }

      setData(payload);
      setLoading(false);
    }

    void load();
  }, [supabase]);

  async function refreshDashboard() {
    if (!token) return;
    const response = await fetch("/api/creator/dashboard", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as DashboardResponse;
    if (!response.ok) {
      toast.error((payload as { message?: string }).message || "Failed to refresh dashboard");
      return;
    }

    setData(payload);
  }

  async function requestPayout() {
    if (!token || !data) return;
    setPayoutLoading(true);

    const response = await fetch("/api/creator/payout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount: data.pendingPayouts }),
    });

    const payload = await response.json().catch(() => ({}));
    setPayoutLoading(false);

    if (!response.ok) {
      toast.error(payload.message || "Payout request failed");
      return;
    }

    toast.success("Payout requested successfully");
    await refreshDashboard();
  }

  async function openCreatorPayoutSetup() {
    if (!token) return;
    setConnectLoading(true);

    const response = await fetch("/api/creator/connect/onboarding", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    setConnectLoading(false);

    if (!response.ok) {
      toast.error(payload.message || "Could not start payout onboarding");
      return;
    }

    if (payload.onboardingUrl) {
      window.location.href = payload.onboardingUrl;
      return;
    }

    toast.message(payload.message || "Payout onboarding is not configured.");
  }

  async function deletePrompt(promptId: string) {
    if (!token) return;
    if (!confirm("Delete this prompt? This action cannot be undone.")) return;

    setDeleteLoadingPromptId(promptId);
    const response = await fetch(`/api/creator/prompt/manage?id=${encodeURIComponent(promptId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    setDeleteLoadingPromptId(null);

    if (!response.ok) {
      toast.error(payload.message || "Failed to delete prompt");
      return;
    }

    toast.success("Prompt deleted");
    await refreshDashboard();
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Login Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">Login to access your creator dashboard.</p>
            <Button asChild>
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.creator) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Creator Profile Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              You need a creator profile before you can access this dashboard.
            </p>
            <Button asChild>
              <Link href="/creator/signup">Become a Creator</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Creator Dashboard</h1>
          <p className="text-muted-foreground">Manage prompts, sales, and payouts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refreshDashboard()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/creator/upload">
              <UploadCloud className="mr-2 h-4 w-4" />
              Upload New Prompt
            </Link>
          </Button>
        </div>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₹{data.stats.totalEarnings.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.stats.totalSales}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Prompts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.stats.totalPrompts}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.stats.averageRating.toFixed(2)}</p>
          </CardContent>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle>Earnings by Month</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `₹${Number(value ?? 0).toFixed(2)}`} />
                <Line type="monotone" dataKey="earnings" stroke="hsl(var(--primary))" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle>Payout Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Status: {data.onboardingStatus.connected ? "Connected" : "Not connected"}
            </p>
            <p className="text-muted-foreground">
              Charges: {data.onboardingStatus.chargesEnabled ? "Enabled" : "Pending"}
            </p>
            <p className="text-muted-foreground">
              Payouts: {data.onboardingStatus.payoutsEnabled ? "Enabled" : "Pending"}
            </p>
            <Button onClick={openCreatorPayoutSetup} disabled={connectLoading} variant="outline" className="w-full">
              {connectLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {data.onboardingStatus.connected ? "Open Setup" : "Connect Account"}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle>Pending Payouts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold">₹{data.pendingPayouts.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Minimum payout request is ₹500.</p>
            <Button onClick={requestPayout} disabled={payoutLoading || data.pendingPayouts < 500}>
              {payoutLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Request Payout
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle>Creator Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="inline-flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              Creator profile active
            </p>
            <p className="text-muted-foreground">Display name: {data.creator.display_name}</p>
            <p className="text-muted-foreground">
              Razorpay account: {data.creator.razorpay_account_id ? "Connected" : "Not connected"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle>My Prompts</CardTitle>
          </CardHeader>
          <CardContent>
            {!data.prompts.length ? (
              <div className="rounded-md border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                No prompts yet. Upload your first prompt to start selling.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-3">Title</th>
                      <th className="px-2 py-3">Status</th>
                      <th className="px-2 py-3">Sales</th>
                      <th className="px-2 py-3">Earnings</th>
                      <th className="px-2 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.prompts.map((item) => (
                      <tr key={item.prompt.id} className="border-b border-border/40">
                        <td className="px-2 py-3">
                          <p className="font-medium">{item.prompt.title}</p>
                          <p className="text-xs text-muted-foreground">{item.prompt.category}</p>
                        </td>
                        <td className="px-2 py-3">
                          <Badge variant={statusVariant(item.prompt.status)}>{item.prompt.status}</Badge>
                        </td>
                        <td className="px-2 py-3">{item.sales}</td>
                        <td className="px-2 py-3">₹{item.earnings.toFixed(2)}</td>
                        <td className="px-2 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/creator/upload?edit=${encodeURIComponent(item.prompt.id)}`}>Edit</Link>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deleteLoadingPromptId === item.prompt.id}
                              onClick={() => void deletePrompt(item.prompt.id)}
                            >
                              {deleteLoadingPromptId === item.prompt.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Delete"
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
