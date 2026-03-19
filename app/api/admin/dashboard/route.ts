import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/auth-helpers";
import { BILLING_PLANS, isBillingPlanId } from "@/lib/billing";
import { createRouteTimer, getRequestId } from "@/lib/logging";
import { createServiceRoleClient } from "@/lib/supabase";

type ServiceRoleClient = NonNullable<ReturnType<typeof createServiceRoleClient>>;
type DashboardSection = "overview" | "review" | "users" | "prompts" | "revenue" | "all";
type MonthlyRevenueTotals = {
  total: number;
  marketplaceFees: number;
  subscriptions: number;
  creditPacks: number;
};
type PurchaseRevenueRow = {
  amount_paid: number | string | null;
  platform_fee: number | string | null;
  created_at: string;
};
type BillingRevenueRow = {
  plan_id: string | null;
  amount_total: number | string | null;
  status: string | null;
  created_at: string;
};

function isDashboardSection(value: string | null): value is DashboardSection {
  return (
    value === "overview" ||
    value === "review" ||
    value === "users" ||
    value === "prompts" ||
    value === "revenue" ||
    value === "all"
  );
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function monthStart(date: Date, monthOffset = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1));
}

function formatMonthLabel(month: string) {
  const [year, part] = month.split("-");
  const monthIndex = Number(part) - 1;
  const date = new Date(Date.UTC(Number(year), monthIndex, 1));
  return date.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function getBillingPlanType(planId: string) {
  if (isBillingPlanId(planId)) {
    return BILLING_PLANS[planId].type;
  }

  return planId.startsWith("pro_") ? "pro" : "credits";
}

function buildMonthlyRevenueMap(purchaseRows: PurchaseRevenueRow[], billingRows: BillingRevenueRow[]) {
  const monthlyRevenueMap = new Map<string, MonthlyRevenueTotals>();

  const addMonthlyRevenue = (
    key: string,
    values: Partial<{ total: number; marketplaceFees: number; subscriptions: number; creditPacks: number }>,
  ) => {
    const current = monthlyRevenueMap.get(key) ?? {
      total: 0,
      marketplaceFees: 0,
      subscriptions: 0,
      creditPacks: 0,
    };

    current.total += values.total ?? 0;
    current.marketplaceFees += values.marketplaceFees ?? 0;
    current.subscriptions += values.subscriptions ?? 0;
    current.creditPacks += values.creditPacks ?? 0;

    monthlyRevenueMap.set(key, current);
  };

  for (const row of purchaseRows) {
    const amountPaid = Number(row.amount_paid) || 0;
    const platformFee = Number(row.platform_fee) || 0;
    addMonthlyRevenue(monthKey(new Date(row.created_at)), {
      total: amountPaid,
      marketplaceFees: platformFee,
    });
  }

  for (const row of billingRows) {
    if (row.status !== "succeeded") continue;

    const amount = Number(row.amount_total) || 0;
    if (amount <= 0) continue;

    const planId = String(row.plan_id ?? "");
    const billingPlanType = getBillingPlanType(planId);

    addMonthlyRevenue(monthKey(new Date(row.created_at)), {
      total: amount,
      subscriptions: billingPlanType === "pro" ? amount : 0,
      creditPacks: billingPlanType === "credits" ? amount : 0,
    });
  }

  return monthlyRevenueMap;
}

function buildMonthlyRevenueSeries(monthlyRevenueMap: Map<string, MonthlyRevenueTotals>) {
  return Array.from(monthlyRevenueMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, values]) => ({
      month,
      label: formatMonthLabel(month),
      total: Number(values.total.toFixed(2)),
      subscriptions: Number(values.subscriptions.toFixed(2)),
      creditPacks: Number(values.creditPacks.toFixed(2)),
      marketplaceFees: Number(values.marketplaceFees.toFixed(2)),
    }));
}

function jsonWithRequestId(requestId: string, body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("x-request-id", requestId);
  return response;
}

async function getOverviewData(supabase: ServiceRoleClient) {
  const now = new Date();
  const currentMonth = monthKey(monthStart(now));
  const lastMonth = monthKey(monthStart(now, -1));
  const revenueWindowStart = monthStart(now, -1).toISOString();

  const [
    { count: totalUsers },
    { count: totalGenerations },
    { count: totalMarketplaceSales },
    { data: recentSignups },
    { data: recentGenerationsRows },
    { data: recentPurchaseRows },
    { data: recentBillingRows },
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("generations").select("id", { count: "exact", head: true }),
    supabase.from("prompt_purchases").select("id", { count: "exact", head: true }),
    supabase
      .from("users")
      .select("id, email, full_name, credits, is_pro, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("generations")
      .select("id, user_id, prompt_id, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("prompt_purchases")
      .select("amount_paid, platform_fee, created_at")
      .gte("created_at", revenueWindowStart),
    supabase
      .from("billing_transactions")
      .select("plan_id, amount_total, status, created_at")
      .gte("created_at", revenueWindowStart)
      .eq("status", "succeeded"),
  ]);

  const generationUserIds = Array.from(new Set((recentGenerationsRows ?? []).map((item) => item.user_id).filter(Boolean)));
  const generationPromptIds = Array.from(
    new Set((recentGenerationsRows ?? []).map((item) => item.prompt_id).filter(Boolean)),
  );

  const [usersForGenerations, promptsForGenerations] = await Promise.all([
    generationUserIds.length
      ? supabase.from("users").select("id, email, full_name").in("id", generationUserIds)
      : Promise.resolve({ data: [] as Array<{ id: string; email: string; full_name: string | null }> }),
    generationPromptIds.length
      ? supabase.from("prompts").select("id, title").in("id", generationPromptIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
  ]);

  const generationUserMap = new Map((usersForGenerations.data ?? []).map((user) => [user.id, user]));
  const generationPromptMap = new Map((promptsForGenerations.data ?? []).map((prompt) => [prompt.id, prompt]));
  const monthlyRevenueMap = buildMonthlyRevenueMap(
    (recentPurchaseRows ?? []) as PurchaseRevenueRow[],
    (recentBillingRows ?? []) as BillingRevenueRow[],
  );

  const recentGenerations = (recentGenerationsRows ?? []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    user:
      row.user_id && generationUserMap.get(row.user_id)
        ? generationUserMap.get(row.user_id)
        : null,
    prompt:
      row.prompt_id && generationPromptMap.get(row.prompt_id)
        ? generationPromptMap.get(row.prompt_id)
        : null,
  }));

  return {
    overview: {
      totalUsers: totalUsers ?? 0,
      totalGenerations: totalGenerations ?? 0,
      totalRevenueThisMonth: Number((monthlyRevenueMap.get(currentMonth)?.total ?? 0).toFixed(2)),
      totalRevenueLastMonth: Number((monthlyRevenueMap.get(lastMonth)?.total ?? 0).toFixed(2)),
      totalMarketplaceSales: totalMarketplaceSales ?? 0,
    },
    recentSignups: recentSignups ?? [],
    recentGenerations,
  };
}

async function getReviewData(supabase: ServiceRoleClient) {
  const { data: pendingPromptRows } = await supabase
    .from("marketplace_prompts")
    .select(
      "id, title, description, prompt_text, cover_image_url, category, price, is_free, created_at, creator_id",
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });

  const { data: creatorProfiles } = pendingPromptRows?.length
    ? await supabase
        .from("creator_profiles")
        .select("id, user_id, display_name")
        .in(
          "id",
          Array.from(new Set((pendingPromptRows ?? []).map((item) => item.creator_id))),
        )
    : { data: [] as Array<{ id: string; user_id: string; display_name: string }> };

  const creatorUserIds = Array.from(new Set((creatorProfiles ?? []).map((profile) => profile.user_id)));
  const { data: creatorUsers } = creatorUserIds.length
    ? await supabase.from("users").select("id, email").in("id", creatorUserIds)
    : { data: [] as Array<{ id: string; email: string }> };

  const creatorProfileMap = new Map((creatorProfiles ?? []).map((profile) => [profile.id, profile]));
  const creatorUserMap = new Map((creatorUsers ?? []).map((user) => [user.id, user]));

  const pendingPrompts = (pendingPromptRows ?? []).map((prompt) => {
    const creator = creatorProfileMap.get(prompt.creator_id);
    const creatorUser = creator ? creatorUserMap.get(creator.user_id) : null;

    return {
      ...prompt,
      creator_name: creator?.display_name ?? "Unknown creator",
      creator_email: creatorUser?.email ?? null,
    };
  });

  return { pendingPrompts };
}

async function getUsersData(supabase: ServiceRoleClient, search: string) {
  let usersQuery = supabase
    .from("users")
    .select("id, email, full_name, credits, is_pro, is_suspended, created_at")
    .order("created_at", { ascending: false })
    .limit(250);

  if (search) {
    usersQuery = usersQuery.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  const { data: usersRows } = await usersQuery;

  const userIds = (usersRows ?? []).map((user) => user.id);
  const { data: userGenerationRows } = userIds.length
    ? await supabase.from("generations").select("id, user_id").in("user_id", userIds)
    : { data: [] as Array<{ id: string; user_id: string | null }> };

  const generationCounts = new Map<string, number>();
  for (const row of userGenerationRows ?? []) {
    if (!row.user_id) continue;
    generationCounts.set(row.user_id, (generationCounts.get(row.user_id) ?? 0) + 1);
  }

  const users = (usersRows ?? []).map((user) => ({
    ...user,
    total_generations: generationCounts.get(user.id) ?? 0,
  }));

  return { users };
}

async function getPromptsData(supabase: ServiceRoleClient) {
  const { data: curatedPrompts } = await supabase
    .from("prompts")
    .select("id, title, description, prompt_text, category, example_image_url, tags, is_featured, use_count, created_at")
    .order("created_at", { ascending: false });

  return {
    curatedPrompts: curatedPrompts ?? [],
  };
}

async function getRevenueData(supabase: ServiceRoleClient) {
  const [{ data: topSellingPrompts }, { data: purchaseRows }, { data: billingRows }] = await Promise.all([
    supabase
      .from("marketplace_prompts")
      .select("id, title, purchase_count, price, is_free")
      .eq("status", "approved")
      .order("purchase_count", { ascending: false })
      .limit(10),
    supabase
      .from("prompt_purchases")
      .select("amount_paid, platform_fee, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("billing_transactions")
      .select("plan_id, amount_total, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const monthlyRevenueMap = buildMonthlyRevenueMap(
    (purchaseRows ?? []) as PurchaseRevenueRow[],
    (billingRows ?? []) as BillingRevenueRow[],
  );

  const totalMarketplaceFees = Number(
    ((purchaseRows ?? []) as PurchaseRevenueRow[])
      .reduce((sum, row) => sum + (Number(row.platform_fee) || 0), 0)
      .toFixed(2),
  );

  const totalSubscriptionsRevenue = Number(
    ((billingRows ?? []) as BillingRevenueRow[])
      .filter((row) => row.status === "succeeded")
      .reduce((sum, row) => {
        const planId = String(row.plan_id ?? "");
        return sum + (getBillingPlanType(planId) === "pro" ? Number(row.amount_total) || 0 : 0);
      }, 0)
      .toFixed(2),
  );

  const totalCreditPackRevenue = Number(
    ((billingRows ?? []) as BillingRevenueRow[])
      .filter((row) => row.status === "succeeded")
      .reduce((sum, row) => {
        const planId = String(row.plan_id ?? "");
        return sum + (getBillingPlanType(planId) === "credits" ? Number(row.amount_total) || 0 : 0);
      }, 0)
      .toFixed(2),
  );

  return {
    revenue: {
      monthly: buildMonthlyRevenueSeries(monthlyRevenueMap),
      topSellingPrompts: topSellingPrompts ?? [],
      breakdown: {
        subscriptions: totalSubscriptionsRevenue,
        creditPacks: totalCreditPackRevenue,
        marketplaceFees: totalMarketplaceFees,
      },
    },
  };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const search = request.nextUrl.searchParams.get("q")?.trim() || "";
  const sectionParam = request.nextUrl.searchParams.get("section");
  const section: DashboardSection = isDashboardSection(sectionParam) ? sectionParam : "all";
  const timer = createRouteTimer("admin_dashboard", {
    request_id: requestId,
    section,
    search_present: search.length > 0,
  });

  try {
    if (!(await isAdminRequest(request))) {
      timer.finish({
        status_code: 403,
        authorized: false,
      });
      return jsonWithRequestId(requestId, { message: "Forbidden" }, { status: 403 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      const error = new Error("Supabase service role key is missing");
      timer.fail(error, {
        status_code: 500,
      });
      return jsonWithRequestId(requestId, { message: error.message }, { status: 500 });
    }

    if (section === "overview") {
      const payload = await getOverviewData(supabase);
      timer.finish({
        status_code: 200,
        authorized: true,
      });
      return jsonWithRequestId(requestId, payload);
    }

    if (section === "review") {
      const payload = await getReviewData(supabase);
      timer.finish({
        status_code: 200,
        authorized: true,
      });
      return jsonWithRequestId(requestId, payload);
    }

    if (section === "users") {
      const payload = await getUsersData(supabase, search);
      timer.finish({
        status_code: 200,
        authorized: true,
        user_count: payload.users.length,
      });
      return jsonWithRequestId(requestId, payload);
    }

    if (section === "prompts") {
      const payload = await getPromptsData(supabase);
      timer.finish({
        status_code: 200,
        authorized: true,
        prompt_count: payload.curatedPrompts.length,
      });
      return jsonWithRequestId(requestId, payload);
    }

    if (section === "revenue") {
      const payload = await getRevenueData(supabase);
      timer.finish({
        status_code: 200,
        authorized: true,
        revenue_months: payload.revenue.monthly.length,
      });
      return jsonWithRequestId(requestId, payload);
    }

    const [overviewData, reviewData, usersData, promptsData, revenueData] = await Promise.all([
      getOverviewData(supabase),
      getReviewData(supabase),
      getUsersData(supabase, search),
      getPromptsData(supabase),
      getRevenueData(supabase),
    ]);

    timer.finish({
      status_code: 200,
      authorized: true,
      user_count: usersData.users.length,
      prompt_count: promptsData.curatedPrompts.length,
      pending_prompt_count: reviewData.pendingPrompts.length,
      revenue_months: revenueData.revenue.monthly.length,
    });

    return jsonWithRequestId(requestId, {
      ...overviewData,
      ...reviewData,
      ...usersData,
      ...promptsData,
      ...revenueData,
    });
  } catch (error) {
    timer.fail(error, {
      status_code: 500,
    });
    return jsonWithRequestId(requestId, { message: "Failed to load admin dashboard" }, { status: 500 });
  }
}
