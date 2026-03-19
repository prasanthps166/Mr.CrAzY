"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase";

type DashboardPayload = {
  overview: {
    totalUsers: number;
    totalGenerations: number;
    totalRevenueThisMonth: number;
    totalRevenueLastMonth: number;
    totalMarketplaceSales: number;
  };
  recentSignups: Array<{
    id: string;
    email: string;
    full_name: string | null;
    credits: number;
    is_pro: boolean;
    created_at: string;
  }>;
  recentGenerations: Array<{
    id: string;
    created_at: string;
    user: { id: string; email: string; full_name: string | null } | null;
    prompt: { id: string; title: string } | null;
  }>;
  pendingPrompts: Array<{
    id: string;
    title: string;
    description: string;
    prompt_text: string;
    cover_image_url: string;
    category: string;
    price: number;
    is_free: boolean;
    created_at: string;
    creator_name: string;
    creator_email: string | null;
  }>;
  users: Array<{
    id: string;
    email: string;
    full_name: string | null;
    credits: number;
    is_pro: boolean;
    is_suspended: boolean;
    total_generations: number;
    created_at: string;
  }>;
  curatedPrompts: Array<{
    id: string;
    title: string;
    description: string;
    prompt_text: string;
    category: string;
    example_image_url: string;
    tags: string[];
    is_featured: boolean;
    use_count: number;
    created_at: string;
  }>;
  revenue: {
    monthly: Array<{
      month: string;
      label: string;
      total: number;
      subscriptions: number;
      creditPacks: number;
      marketplaceFees: number;
    }>;
    topSellingPrompts: Array<{
      id: string;
      title: string;
      purchase_count: number;
      price: number;
      is_free: boolean;
    }>;
    breakdown: {
      subscriptions: number;
      creditPacks: number;
      marketplaceFees: number;
    };
  };
};

type DashboardSection = "overview" | "review" | "users" | "prompts" | "revenue";
type OverviewSectionData = Pick<DashboardPayload, "overview" | "recentSignups" | "recentGenerations">;
type ReviewSectionData = Pick<DashboardPayload, "pendingPrompts">;
type UsersSectionData = Pick<DashboardPayload, "users">;
type PromptsSectionData = Pick<DashboardPayload, "curatedPrompts">;
type RevenueSectionData = Pick<DashboardPayload, "revenue">;
type DashboardSections = {
  overview: OverviewSectionData | null;
  review: ReviewSectionData | null;
  users: UsersSectionData | null;
  prompts: PromptsSectionData | null;
  revenue: RevenueSectionData | null;
};

type CuratedPromptInput = {
  id?: string;
  title: string;
  description: string;
  prompt_text: string;
  category: string;
  example_image_url: string;
  tags: string;
  is_featured: boolean;
};

const defaultLoadingSections: Record<DashboardSection, boolean> = {
  overview: false,
  review: false,
  users: false,
  prompts: false,
  revenue: false,
};

function emptyDashboardSections(): DashboardSections {
  return {
    overview: null,
    review: null,
    users: null,
    prompts: null,
    revenue: null,
  };
}

function emptyPrompt(): CuratedPromptInput {
  return {
    title: "",
    description: "",
    prompt_text: "",
    category: "Anime",
    example_image_url: "",
    tags: "",
    is_featured: false,
  };
}

export function AdminDashboardClient({
  userEmail,
  initialAccessToken = null,
}: {
  userEmail: string;
  initialAccessToken?: string | null;
}) {
  const [sections, setSections] = useState<DashboardSections>(emptyDashboardSections);
  const [authLoading, setAuthLoading] = useState(!initialAccessToken);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [loadedUsersQuery, setLoadedUsersQuery] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardSection>("overview");
  const [token, setToken] = useState<string | null>(initialAccessToken);
  const [previewPromptId, setPreviewPromptId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [curatedPromptForm, setCuratedPromptForm] = useState<CuratedPromptInput>(emptyPrompt());
  const [loadingSections, setLoadingSections] = useState<Record<DashboardSection, boolean>>(defaultLoadingSections);
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<DashboardSection, string>>>({});

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const fetchDashboardSection = useCallback(
    async (section: DashboardSection, searchValue = "") => {
      if (!token) return;

      setLoadingSections((current) => ({
        ...current,
        [section]: true,
      }));

      const params = new URLSearchParams({ section });
      const trimmedSearch = searchValue.trim();
      if (section === "users" && trimmedSearch) {
        params.set("q", trimmedSearch);
      }

      try {
        const response = await fetch(`/api/admin/dashboard?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
          message?: string;
        };

        if (!response.ok) {
          const message = payload.message || "Failed to load admin dashboard";
          setSectionErrors((current) => ({
            ...current,
            [section]: String(message),
          }));
          toast.error(String(message));
          return;
        }

        setSectionErrors((current) => {
          const next = { ...current };
          delete next[section];
          return next;
        });

        if (section === "overview") {
          setSections((current) => ({ ...current, overview: payload as OverviewSectionData }));
          return;
        }

        if (section === "review") {
          setSections((current) => ({ ...current, review: payload as ReviewSectionData }));
          return;
        }

        if (section === "users") {
          setSections((current) => ({ ...current, users: payload as UsersSectionData }));
          setLoadedUsersQuery(trimmedSearch);
          return;
        }

        if (section === "prompts") {
          setSections((current) => ({ ...current, prompts: payload as PromptsSectionData }));
          return;
        }

        setSections((current) => ({ ...current, revenue: payload as RevenueSectionData }));
      } finally {
        setLoadingSections((current) => ({
          ...current,
          [section]: false,
        }));
      }
    },
    [token],
  );

  useEffect(() => {
    if (token) {
      setAuthLoading(false);
      return;
    }

    const browserSupabase = supabase;
    if (!browserSupabase) {
      setAuthLoading(false);
      return;
    }

    const authClient = browserSupabase.auth;
    let cancelled = false;

    async function load() {
      const { data } = await authClient.getSession();
      if (cancelled) return;

      setToken(data.session?.access_token ?? null);
      setAuthLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [supabase, token]);

  useEffect(() => {
    if (!token || sections.overview) return;
    void fetchDashboardSection("overview");
  }, [token, sections.overview, fetchDashboardSection]);

  useEffect(() => {
    if (!token || activeTab === "overview") return;

    if (activeTab === "users") {
      if (!sections.users || loadedUsersQuery !== appliedQuery) {
        void fetchDashboardSection("users", appliedQuery);
      }
      return;
    }

    if (!sections[activeTab]) {
      void fetchDashboardSection(activeTab);
    }
  }, [token, activeTab, sections, loadedUsersQuery, appliedQuery, fetchDashboardSection]);

  const overviewData = sections.overview;
  const reviewData = sections.review;
  const usersData = sections.users;
  const promptsData = sections.prompts;
  const revenueData = sections.revenue;
  const previewPrompt = reviewData?.pendingPrompts.find((prompt) => prompt.id === previewPromptId) ?? null;

  function renderSectionFallback(section: DashboardSection) {
    const error = sectionErrors[section];

    if (error) {
      return (
        <Card className="border-border/60 bg-card/70">
          <CardContent className="flex flex-col gap-3 p-6">
            <p className="text-sm text-muted-foreground">{error}</p>
            <div>
              <Button
                onClick={() =>
                  void fetchDashboardSection(section, section === "users" ? appliedQuery : "")
                }
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  async function reviewPrompt(promptId: string, action: "approve" | "reject") {
    if (!token) return;

    if (action === "reject" && !rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    const response = await fetch("/api/admin/marketplace/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt_id: promptId,
        action,
        reason: action === "reject" ? rejectReason : undefined,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.message || `Failed to ${action} prompt`);
      return;
    }

    toast.success(action === "approve" ? "Prompt approved" : "Prompt rejected");
    setPreviewPromptId(null);
    setRejectReason("");
    await fetchDashboardSection("review");
  }

  async function manageUser(
    userId: string,
    action: "add_credits" | "toggle_pro" | "suspend",
    payload: Record<string, unknown>,
  ) {
    if (!token) return;

    const response = await fetch("/api/admin/users/manage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: userId, action, ...payload }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.message || "User update failed");
      return;
    }

    toast.success("User updated");
    await fetchDashboardSection("users", loadedUsersQuery);
  }

  async function deleteCuratedPrompt(promptId: string) {
    if (!token) return;

    if (!confirm("Delete this curated prompt?")) return;

    const response = await fetch(`/api/admin/prompts?id=${encodeURIComponent(promptId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.message || "Failed to delete prompt");
      return;
    }

    toast.success("Prompt deleted");
    await fetchDashboardSection("prompts");
  }

  async function saveCuratedPrompt() {
    if (!token) return;

    if (
      !curatedPromptForm.title.trim() ||
      !curatedPromptForm.description.trim() ||
      !curatedPromptForm.prompt_text.trim() ||
      !curatedPromptForm.category.trim() ||
      !curatedPromptForm.example_image_url.trim()
    ) {
      toast.error("Fill all required prompt fields");
      return;
    }

    setSavingPrompt(true);
    const method = curatedPromptForm.id ? "PUT" : "POST";

    const response = await fetch("/api/admin/prompts", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...curatedPromptForm,
        tags: curatedPromptForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    setSavingPrompt(false);

    if (!response.ok) {
      toast.error(payload.message || "Failed to save prompt");
      return;
    }

    setCuratedPromptForm(emptyPrompt());
    toast.success(curatedPromptForm.id ? "Prompt updated" : "Prompt created");
    await fetchDashboardSection("prompts");
  }

  if (authLoading || (token && !overviewData && !sectionErrors.overview)) {
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
          <CardContent className="text-sm text-muted-foreground">
            Admin access requires an authenticated account matching <code>ADMIN_EMAIL</code>.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!overviewData) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        {renderSectionFallback("overview")}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Signed in as {userEmail}</p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            void fetchDashboardSection(activeTab, activeTab === "users" ? loadedUsersQuery : "")
          }
          disabled={loadingSections[activeTab]}
        >
          {loadingSections[activeTab] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardSection)} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="review">Prompt Review</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/60 bg-card/70">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{overviewData.overview.totalUsers}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/70">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Total Generations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{overviewData.overview.totalGenerations}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/70">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Revenue (This Month)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">${overviewData.overview.totalRevenueThisMonth.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  Last month: ${overviewData.overview.totalRevenueLastMonth.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/70">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Marketplace Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{overviewData.overview.totalMarketplaceSales}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/60 bg-card/70">
              <CardHeader>
                <CardTitle>Recent Signups</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-2">Email</th>
                        <th className="px-2 py-2">Name</th>
                        <th className="px-2 py-2">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewData.recentSignups.map((user) => (
                        <tr key={user.id} className="border-b border-border/40">
                          <td className="px-2 py-2">{user.email}</td>
                          <td className="px-2 py-2">{user.full_name || "-"}</td>
                          <td className="px-2 py-2">{new Date(user.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/70">
              <CardHeader>
                <CardTitle>Recent Generations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-2">User</th>
                        <th className="px-2 py-2">Prompt</th>
                        <th className="px-2 py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewData.recentGenerations.map((item) => (
                        <tr key={item.id} className="border-b border-border/40">
                          <td className="px-2 py-2">{item.user?.email || "Guest"}</td>
                          <td className="px-2 py-2">{item.prompt?.title || "Unknown"}</td>
                          <td className="px-2 py-2">{new Date(item.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="review" className="space-y-4">
          {!reviewData ? (
            renderSectionFallback("review")
          ) : (
            <>
              <Card className="border-border/60 bg-card/70">
                <CardHeader>
                  <CardTitle>Pending Marketplace Prompts</CardTitle>
                </CardHeader>
                <CardContent>
                  {!reviewData.pendingPrompts.length ? (
                    <p className="text-sm text-muted-foreground">No pending prompts.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-2 py-2">Prompt</th>
                            <th className="px-2 py-2">Creator</th>
                            <th className="px-2 py-2">Category</th>
                            <th className="px-2 py-2">Price</th>
                            <th className="px-2 py-2">Submitted</th>
                            <th className="px-2 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reviewData.pendingPrompts.map((prompt) => (
                            <tr key={prompt.id} className="border-b border-border/40">
                              <td className="px-2 py-2">{prompt.title}</td>
                              <td className="px-2 py-2">{prompt.creator_name}</td>
                              <td className="px-2 py-2">{prompt.category}</td>
                              <td className="px-2 py-2">
                                {prompt.is_free ? "Free" : `$${Number(prompt.price).toFixed(2)}`}
                              </td>
                              <td className="px-2 py-2">{new Date(prompt.created_at).toLocaleDateString()}</td>
                              <td className="px-2 py-2 text-right">
                                <div className="inline-flex gap-2">
                                  <Button variant="outline" size="sm" onClick={() => setPreviewPromptId(prompt.id)}>
                                    Preview
                                  </Button>
                                  <Button size="sm" onClick={() => void reviewPrompt(prompt.id, "approve")}>
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setPreviewPromptId(prompt.id);
                                    }}
                                  >
                                    Reject
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

              <Dialog open={Boolean(previewPrompt)} onOpenChange={(open) => !open && setPreviewPromptId(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{previewPrompt?.title || "Prompt Preview"}</DialogTitle>
                    <DialogDescription>
                      Category: {previewPrompt?.category} | Creator: {previewPrompt?.creator_name}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    {previewPrompt ? (
                      <>
                        <p className="text-sm text-muted-foreground">{previewPrompt.description}</p>
                        <div className="rounded-md border border-border/60 bg-background/70 p-3">
                          <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Prompt Text</p>
                          <pre className="whitespace-pre-wrap text-sm">{previewPrompt.prompt_text}</pre>
                        </div>
                      </>
                    ) : null}
                    <Textarea
                      placeholder="Rejection reason"
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setPreviewPromptId(null)}>
                        Close
                      </Button>
                      {previewPrompt ? (
                        <Button variant="destructive" onClick={() => void reviewPrompt(previewPrompt.id, "reject")}>
                          Reject with Reason
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const nextQuery = query.trim();
                  setAppliedQuery(nextQuery);
                  void fetchDashboardSection("users", nextQuery);
                }}
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by email or name"
                    className="pl-9"
                  />
                </div>
                <Button type="submit">Search</Button>
              </form>

              {!usersData ? (
                renderSectionFallback("users")
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-2">Email</th>
                        <th className="px-2 py-2">Name</th>
                        <th className="px-2 py-2">Credits</th>
                        <th className="px-2 py-2">Pro</th>
                        <th className="px-2 py-2">Suspended</th>
                        <th className="px-2 py-2">Generations</th>
                        <th className="px-2 py-2">Joined</th>
                        <th className="px-2 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersData.users.map((user) => (
                        <tr key={user.id} className="border-b border-border/40">
                          <td className="px-2 py-2">{user.email}</td>
                          <td className="px-2 py-2">{user.full_name || "-"}</td>
                          <td className="px-2 py-2">{user.credits}</td>
                          <td className="px-2 py-2">{user.is_pro ? "Yes" : "No"}</td>
                          <td className="px-2 py-2">{user.is_suspended ? "Yes" : "No"}</td>
                          <td className="px-2 py-2">{user.total_generations}</td>
                          <td className="px-2 py-2">{new Date(user.created_at).toLocaleDateString()}</td>
                          <td className="px-2 py-2 text-right">
                            <div className="inline-flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const input = prompt("Credits to add", "10");
                                  const amount = Number(input ?? "0");
                                  if (!amount) return;
                                  void manageUser(user.id, "add_credits", { amount });
                                }}
                              >
                                Add Credits
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void manageUser(user.id, "toggle_pro", { is_pro: !user.is_pro })}
                              >
                                Toggle Pro
                              </Button>
                              <Button
                                size="sm"
                                variant={user.is_suspended ? "outline" : "destructive"}
                                onClick={() =>
                                  void manageUser(user.id, "suspend", { is_suspended: !user.is_suspended })
                                }
                              >
                                {user.is_suspended ? "Unsuspend" : "Suspend"}
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
        </TabsContent>

        <TabsContent value="prompts" className="space-y-4">
          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle>{curatedPromptForm.id ? "Edit Curated Prompt" : "Add Curated Prompt"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={curatedPromptForm.title}
                onChange={(event) => setCuratedPromptForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Title"
              />
              <Textarea
                value={curatedPromptForm.description}
                onChange={(event) =>
                  setCuratedPromptForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Description"
                rows={3}
              />
              <Textarea
                value={curatedPromptForm.prompt_text}
                onChange={(event) =>
                  setCuratedPromptForm((current) => ({ ...current, prompt_text: event.target.value }))
                }
                placeholder="Prompt text"
                rows={5}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  value={curatedPromptForm.category}
                  onChange={(event) =>
                    setCuratedPromptForm((current) => ({ ...current, category: event.target.value }))
                  }
                  placeholder="Category"
                />
                <Input
                  value={curatedPromptForm.example_image_url}
                  onChange={(event) =>
                    setCuratedPromptForm((current) => ({ ...current, example_image_url: event.target.value }))
                  }
                  placeholder="Example image URL"
                />
              </div>
              <Input
                value={curatedPromptForm.tags}
                onChange={(event) => setCuratedPromptForm((current) => ({ ...current, tags: event.target.value }))}
                placeholder="Tags (comma separated)"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={curatedPromptForm.is_featured}
                  onChange={(event) =>
                    setCuratedPromptForm((current) => ({ ...current, is_featured: event.target.checked }))
                  }
                />
                Featured prompt
              </label>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveCuratedPrompt()} disabled={savingPrompt}>
                  {savingPrompt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {curatedPromptForm.id ? "Update Prompt" : "Create Prompt"}
                </Button>
                {curatedPromptForm.id ? (
                  <Button variant="outline" onClick={() => setCuratedPromptForm(emptyPrompt())}>
                    Cancel Edit
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {!promptsData ? (
            renderSectionFallback("prompts")
          ) : (
            <Card className="border-border/60 bg-card/70">
              <CardHeader>
                <CardTitle>Curated Prompts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-2">Title</th>
                        <th className="px-2 py-2">Category</th>
                        <th className="px-2 py-2">Featured</th>
                        <th className="px-2 py-2">Use Count</th>
                        <th className="px-2 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promptsData.curatedPrompts.map((prompt) => (
                        <tr key={prompt.id} className="border-b border-border/40">
                          <td className="px-2 py-2">{prompt.title}</td>
                          <td className="px-2 py-2">{prompt.category}</td>
                          <td className="px-2 py-2">{prompt.is_featured ? "Yes" : "No"}</td>
                          <td className="px-2 py-2">{prompt.use_count}</td>
                          <td className="px-2 py-2 text-right">
                            <div className="inline-flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setCuratedPromptForm({
                                    id: prompt.id,
                                    title: prompt.title,
                                    description: prompt.description,
                                    prompt_text: prompt.prompt_text,
                                    category: prompt.category,
                                    example_image_url: prompt.example_image_url,
                                    tags: (prompt.tags || []).join(", "),
                                    is_featured: prompt.is_featured,
                                  })
                                }
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => void deleteCuratedPrompt(prompt.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          {!revenueData ? (
            renderSectionFallback("revenue")
          ) : (
            <>
              <Card className="border-border/60 bg-card/70">
                <CardHeader>
                  <CardTitle>Total Revenue by Month</CardTitle>
                </CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData.revenue.monthly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip formatter={(value) => `$${Number(value ?? 0).toFixed(2)}`} />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-border/60 bg-card/70">
                  <CardHeader>
                    <CardTitle>Revenue Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>Subscriptions: ${revenueData.revenue.breakdown.subscriptions.toFixed(2)}</p>
                    <p>Credit Packs: ${revenueData.revenue.breakdown.creditPacks.toFixed(2)}</p>
                    <p>Marketplace Fees: ${revenueData.revenue.breakdown.marketplaceFees.toFixed(2)}</p>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/70">
                  <CardHeader>
                    <CardTitle>Top Selling Marketplace Prompts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {revenueData.revenue.topSellingPrompts.map((prompt) => (
                        <div key={prompt.id} className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
                          <span className="line-clamp-1">{prompt.title}</span>
                          <span className="text-muted-foreground">{prompt.purchase_count} sales</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
