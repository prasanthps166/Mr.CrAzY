import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/auth-helpers";
import { BILLING_PLANS, isBillingPlanId } from "@/lib/billing";
import { createServiceRoleClient } from "@/lib/supabase";

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function formatMonthLabel(month: string) {
  const [year, part] = month.split("-");
  const monthIndex = Number(part) - 1;
  const date = new Date(Date.UTC(Number(year), monthIndex, 1));
  return date.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const search = request.nextUrl.searchParams.get("q")?.trim() || "";

  const now = new Date();
  const currentMonth = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const lastMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastMonth = monthKey(lastMonthDate);

  const [
    { count: totalUsers },
    { count: totalGenerations },
    { data: recentSignups },
    { data: recentGenerationsRows },
    { data: pendingPromptRows },
    { data: curatedPrompts },
    { data: topSellingPrompts },
    { data: purchaseRows },
    { data: billingRows },
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("generations").select("id", { count: "exact", head: true }),
    supabase
      .from("users")
      .select("id, email, full_name, credits, is_pro, is_suspended, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("generations")
      .select("id, user_id, prompt_id, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("marketplace_prompts")
      .select(
        "id, title, description, prompt_text, cover_image_url, category, price, is_free, status, created_at, creator_id",
      )
      .eq("status", "pending_review")
      .order("created_at", { ascending: false }),
    supabase
      .from("prompts")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("marketplace_prompts")
      .select("id, title, purchase_count, price, is_free")
      .eq("status", "approved")
      .order("purchase_count", { ascending: false })
      .limit(10),
    supabase
      .from("prompt_purchases")
      .select("id, amount_paid, platform_fee, created_at, marketplace_prompt_id")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("billing_transactions")
      .select("id, plan_id, amount_total, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const generationUserIds = Array.from(new Set((recentGenerationsRows ?? []).map((item) => item.user_id).filter(Boolean)));
  const generationPromptIds = Array.from(
    new Set((recentGenerationsRows ?? []).map((item) => item.prompt_id).filter(Boolean)),
  );

  const [usersForGenerations, promptsForGenerations, creatorProfiles] = await Promise.all([
    generationUserIds.length
      ? supabase
          .from("users")
          .select("id, email, full_name")
          .in("id", generationUserIds)
      : Promise.resolve({ data: [] as Array<{ id: string; email: string; full_name: string | null }> }),
    generationPromptIds.length
      ? supabase.from("prompts").select("id, title").in("id", generationPromptIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    pendingPromptRows?.length
      ? supabase
          .from("creator_profiles")
          .select("id, user_id, display_name")
          .in(
            "id",
            Array.from(new Set((pendingPromptRows ?? []).map((item) => item.creator_id))),
          )
      : Promise.resolve({ data: [] as Array<{ id: string; user_id: string; display_name: string }> }),
  ]);

  const creatorUserIds = Array.from(new Set((creatorProfiles.data ?? []).map((profile) => profile.user_id)));
  const { data: creatorUsers } = creatorUserIds.length
    ? await supabase.from("users").select("id, email").in("id", creatorUserIds)
    : { data: [] as Array<{ id: string; email: string }> };

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

  const generationUserMap = new Map((usersForGenerations.data ?? []).map((user) => [user.id, user]));
  const generationPromptMap = new Map((promptsForGenerations.data ?? []).map((prompt) => [prompt.id, prompt]));
  const creatorProfileMap = new Map((creatorProfiles.data ?? []).map((profile) => [profile.id, profile]));
  const creatorUserMap = new Map((creatorUsers ?? []).map((user) => [user.id, user]));

  const monthlyRevenueMap = new Map<
    string,
    { total: number; marketplaceFees: number; subscriptions: number; creditPacks: number }
  >();

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

  for (const row of purchaseRows ?? []) {
    const amountPaid = Number(row.amount_paid) || 0;
    const platformFee = Number(row.platform_fee) || 0;
    addMonthlyRevenue(monthKey(new Date(row.created_at)), {
      total: amountPaid,
      marketplaceFees: platformFee,
    });
  }

  for (const row of billingRows ?? []) {
    if (row.status !== "succeeded") continue;
    const amount = Number(row.amount_total) || 0;
    if (amount <= 0) continue;

    const planId = String(row.plan_id ?? "");
    const billingPlanType = isBillingPlanId(planId)
      ? BILLING_PLANS[planId].type
      : planId.startsWith("pro_")
        ? "pro"
        : "credits";

    addMonthlyRevenue(monthKey(new Date(row.created_at)), {
      total: amount,
      subscriptions: billingPlanType === "pro" ? amount : 0,
      creditPacks: billingPlanType === "credits" ? amount : 0,
    });
  }

  const monthlyRevenue = Array.from(monthlyRevenueMap.entries())
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

  const thisMonthRevenue = monthlyRevenueMap.get(currentMonth)?.total ?? 0;
  const lastMonthRevenue = monthlyRevenueMap.get(lastMonth)?.total ?? 0;

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

  const pendingPrompts = (pendingPromptRows ?? []).map((prompt) => {
    const creator = creatorProfileMap.get(prompt.creator_id);
    const creatorUser = creator ? creatorUserMap.get(creator.user_id) : null;
    return {
      ...prompt,
      creator_name: creator?.display_name ?? "Unknown creator",
      creator_email: creatorUser?.email ?? null,
    };
  });

  const users = (usersRows ?? []).map((user) => ({
    ...user,
    total_generations: generationCounts.get(user.id) ?? 0,
  }));

  const totalMarketplaceFees = Number(
    (purchaseRows ?? []).reduce((sum, row) => sum + (Number(row.platform_fee) || 0), 0).toFixed(2),
  );
  const totalSubscriptionsRevenue = Number(
    (billingRows ?? [])
      .filter((row) => row.status === "succeeded")
      .reduce((sum, row) => {
        const planId = String(row.plan_id ?? "");
        const isProPlan = isBillingPlanId(planId) ? BILLING_PLANS[planId].type === "pro" : planId.startsWith("pro_");
        return sum + (isProPlan ? Number(row.amount_total) || 0 : 0);
      }, 0)
      .toFixed(2),
  );
  const totalCreditPackRevenue = Number(
    (billingRows ?? [])
      .filter((row) => row.status === "succeeded")
      .reduce((sum, row) => {
        const planId = String(row.plan_id ?? "");
        const isCreditPlan = isBillingPlanId(planId) ? BILLING_PLANS[planId].type === "credits" : !planId.startsWith("pro_");
        return sum + (isCreditPlan ? Number(row.amount_total) || 0 : 0);
      }, 0)
      .toFixed(2),
  );

  return NextResponse.json({
    overview: {
      totalUsers: totalUsers ?? 0,
      totalGenerations: totalGenerations ?? 0,
      totalRevenueThisMonth: Number(thisMonthRevenue.toFixed(2)),
      totalRevenueLastMonth: Number(lastMonthRevenue.toFixed(2)),
      totalMarketplaceSales: (purchaseRows ?? []).length,
    },
    recentSignups: recentSignups ?? [],
    recentGenerations,
    pendingPrompts,
    users,
    curatedPrompts: curatedPrompts ?? [],
    revenue: {
      monthly: monthlyRevenue,
      topSellingPrompts: topSellingPrompts ?? [],
      breakdown: {
        subscriptions: totalSubscriptionsRevenue,
        creditPacks: totalCreditPackRevenue,
        marketplaceFees: totalMarketplaceFees,
      },
    },
  });
}
