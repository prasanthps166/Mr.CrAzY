import {
  CreatorProfile,
  MarketplacePrompt,
  MarketplacePromptReview,
  MarketplacePromptWithCreator,
  PromptPurchase,
  UserProfile,
} from "@/types";
import { unstable_cache } from "next/cache";
import { createServiceRoleClient, isSupabaseServiceConfigured } from "@/lib/supabase";

export type MarketplacePriceFilter = "all" | "free" | "under_50" | "under_100";
export type MarketplaceSort = "trending" | "newest" | "top_rated" | "best_selling";
const MARKETPLACE_REVALIDATE_SECONDS = 600;
const MARKETPLACE_QUERY_TIMEOUT_MS = 2500;

async function withTimeout<T>(promiseLike: PromiseLike<T>, timeoutMs = MARKETPLACE_QUERY_TIMEOUT_MS): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });

  const result = await Promise.race([Promise.resolve(promiseLike).catch(() => null), timeoutPromise]);

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  return result as T | null;
}

type GetMarketplacePromptsOptions = {
  category?: string;
  price?: MarketplacePriceFilter;
  minRating?: number;
  sort?: MarketplaceSort;
  tab?: "all" | "free";
  limit?: number;
  search?: string;
};

function normalizeMarketplaceSearch(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeMarketplaceCategory(value?: string) {
  const normalized = value?.trim();
  return normalized || "All";
}

function matchesMarketplaceSearch(
  prompt: Pick<MarketplacePrompt, "title" | "description" | "category" | "tags">,
  normalizedSearch: string,
) {
  if (!normalizedSearch) return true;
  const haystack = `${prompt.title} ${prompt.description} ${prompt.category} ${(prompt.tags ?? []).join(" ")}`
    .toLowerCase();
  return haystack.includes(normalizedSearch);
}

async function getMarketplacePromptsUncached(options?: GetMarketplacePromptsOptions) {
  if (!isSupabaseServiceConfigured()) return [] as MarketplacePromptWithCreator[];

  const supabase = createServiceRoleClient();
  if (!supabase) return [] as MarketplacePromptWithCreator[];

  const {
    category: rawCategory = "All",
    price = "all",
    minRating = 0,
    sort = "trending",
    tab = "all",
    limit = 24,
    search = "",
  } = options ?? {};

  const category = normalizeMarketplaceCategory(rawCategory);
  const normalizedSearch = normalizeMarketplaceSearch(search);

  let query = supabase.from("marketplace_prompts").select("*").eq("status", "approved");

  if (tab === "free") query = query.eq("is_free", true);
  if (category !== "All") query = query.eq("category", category);
  if (normalizedSearch) {
    query = query.or(
      `title.ilike.%${normalizedSearch}%,description.ilike.%${normalizedSearch}%,category.ilike.%${normalizedSearch}%`,
    );
  }

  if (price === "free") {
    query = query.eq("is_free", true);
  } else if (price === "under_50") {
    query = query.lte("price_inr", 50);
  } else if (price === "under_100") {
    query = query.lte("price_inr", 100);
  }

  if (minRating > 0) query = query.gte("rating_avg", minRating);

  if (sort === "newest") {
    query = query.order("created_at", { ascending: false });
  } else if (sort === "top_rated") {
    query = query.order("rating_avg", { ascending: false }).order("rating_count", { ascending: false });
  } else if (sort === "best_selling") {
    query = query.order("purchase_count", { ascending: false }).order("created_at", { ascending: false });
  } else {
    query = query
      .order("purchase_count", { ascending: false })
      .order("rating_avg", { ascending: false })
      .order("created_at", { ascending: false });
  }

  query = query.limit(limit);
  const promptsResponse = await withTimeout(query);
  const prompts = promptsResponse?.data;
  if (!prompts?.length) return [] as MarketplacePromptWithCreator[];

  const filteredPrompts = normalizedSearch
    ? (prompts as MarketplacePrompt[]).filter((prompt) => matchesMarketplaceSearch(prompt, normalizedSearch))
    : (prompts as MarketplacePrompt[]);

  if (!filteredPrompts.length) return [] as MarketplacePromptWithCreator[];

  const creatorIds = Array.from(new Set(filteredPrompts.map((item) => item.creator_id)));
  const creatorsResponse = await withTimeout(
    supabase
      .from("creator_profiles")
      .select("*")
      .in("id", creatorIds),
  );
  const creators = creatorsResponse?.data;

  const creatorMap = new Map((creators ?? []).map((creator) => [creator.id, creator as CreatorProfile]));

  return filteredPrompts.map((prompt) => ({
    ...(prompt as MarketplacePrompt),
    creator: creatorMap.get(prompt.creator_id) ?? null,
  }));
}

const getMarketplacePromptsCached = unstable_cache(
  async (
    category: string,
    price: MarketplacePriceFilter,
    minRating: number,
    sort: MarketplaceSort,
    tab: "all" | "free",
    limit: number,
    search: string,
  ) =>
    getMarketplacePromptsUncached({
      category,
      price,
      minRating,
      sort,
      tab,
      limit,
      search,
    }),
  ["marketplace-prompts-v2"],
  { revalidate: MARKETPLACE_REVALIDATE_SECONDS },
);

export async function getMarketplacePrompts(options?: GetMarketplacePromptsOptions) {
  const {
    category: rawCategory = "All",
    price = "all",
    minRating = 0,
    sort = "trending",
    tab = "all",
    limit = 24,
    search = "",
  } = options ?? {};

  const category = normalizeMarketplaceCategory(rawCategory);
  const normalizedSearch = normalizeMarketplaceSearch(search);

  return getMarketplacePromptsCached(category, price, minRating, sort, tab, limit, normalizedSearch);
}

export async function getMarketplacePromptDetail(promptId: string, userId?: string | null) {
  if (!isSupabaseServiceConfigured()) {
    return {
      prompt: null as MarketplacePromptWithCreator | null,
      reviews: [] as MarketplacePromptReview[],
      moreFromCreator: [] as MarketplacePromptWithCreator[],
      hasPurchased: false,
    };
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return {
      prompt: null as MarketplacePromptWithCreator | null,
      reviews: [] as MarketplacePromptReview[],
      moreFromCreator: [] as MarketplacePromptWithCreator[],
      hasPurchased: false,
    };
  }

  const promptResponse = await withTimeout(
    supabase
      .from("marketplace_prompts")
      .select("*")
      .eq("id", promptId)
      .single(),
  );
  const promptRow = promptResponse?.data;

  if (!promptRow) {
    return {
      prompt: null as MarketplacePromptWithCreator | null,
      reviews: [] as MarketplacePromptReview[],
      moreFromCreator: [] as MarketplacePromptWithCreator[],
      hasPurchased: false,
    };
  }

  if (promptRow.status !== "approved") {
    const creatorProfileResponse = userId
      ? await withTimeout(
          supabase
            .from("creator_profiles")
            .select("id")
            .eq("id", promptRow.creator_id)
            .eq("user_id", userId)
            .maybeSingle(),
        )
      : { data: null };
    if (!creatorProfileResponse?.data) {
      return {
        prompt: null as MarketplacePromptWithCreator | null,
        reviews: [] as MarketplacePromptReview[],
        moreFromCreator: [] as MarketplacePromptWithCreator[],
        hasPurchased: false,
      };
    }
  }

  const [creatorResponse, reviewRowsResponse, moreRowsResponse, hasPurchasedResponse] = await Promise.all([
    withTimeout(
      supabase
        .from("creator_profiles")
        .select("*")
        .eq("id", promptRow.creator_id)
        .single(),
    ),
    withTimeout(
      supabase
        .from("prompt_ratings")
        .select("*")
        .eq("marketplace_prompt_id", promptId)
        .order("created_at", { ascending: false }),
    ),
    withTimeout(
      supabase
        .from("marketplace_prompts")
        .select("*")
        .eq("creator_id", promptRow.creator_id)
        .eq("status", "approved")
        .neq("id", promptId)
        .order("purchase_count", { ascending: false })
        .limit(4),
    ),
    userId
      ? withTimeout(
          supabase
            .from("prompt_purchases")
            .select("id")
            .eq("user_id", userId)
            .eq("marketplace_prompt_id", promptId)
            .maybeSingle(),
        )
      : Promise.resolve(null),
  ]);

  const creator = creatorResponse?.data;
  const reviewRows = reviewRowsResponse?.data;
  const moreRows = moreRowsResponse?.data;

  const reviewUserIds = Array.from(new Set((reviewRows ?? []).map((review) => review.user_id)));
  const usersResponse = reviewUserIds.length
    ? await withTimeout(
        supabase
          .from("users")
          .select("id, full_name, avatar_url")
          .in("id", reviewUserIds),
      )
    : { data: [] as Pick<UserProfile, "id" | "full_name" | "avatar_url">[] };
  const users = usersResponse?.data ?? [];

  const userMap = new Map((users ?? []).map((user) => [user.id, user]));

  const hasPurchased = Boolean(userId && hasPurchasedResponse?.data);

  return {
    prompt: {
      ...(promptRow as MarketplacePrompt),
      creator: (creator as CreatorProfile | null) ?? null,
    },
    reviews: (reviewRows ?? []).map((review) => ({
      ...(review as Omit<MarketplacePromptReview, "user">),
      user: (userMap.get(review.user_id) as MarketplacePromptReview["user"]) ?? null,
    })),
    moreFromCreator: (moreRows ?? []).map((item) => ({
      ...(item as MarketplacePrompt),
      creator: (creator as CreatorProfile | null) ?? null,
    })),
    hasPurchased,
  };
}

export async function getPurchasedMarketplacePromptIds(userId: string) {
  if (!isSupabaseServiceConfigured()) return [] as string[];
  const supabase = createServiceRoleClient();
  if (!supabase) return [] as string[];

  const { data } = await supabase
    .from("prompt_purchases")
    .select("marketplace_prompt_id")
    .eq("user_id", userId);

  return (data ?? []).map((item) => item.marketplace_prompt_id);
}

export async function getCreatorProfileByUserId(userId: string) {
  if (!isSupabaseServiceConfigured()) return null;
  const supabase = createServiceRoleClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return (data as CreatorProfile | null) ?? null;
}

export async function getCreatorDashboardData(userId: string) {
  if (!isSupabaseServiceConfigured()) {
    return {
      creator: null as CreatorProfile | null,
      stats: {
        totalEarnings: 0,
        totalSales: 0,
        totalPrompts: 0,
        averageRating: 0,
      },
      chart: [] as Array<{ month: string; earnings: number }>,
      prompts: [] as Array<{
        prompt: MarketplacePrompt;
        sales: number;
        earnings: number;
      }>,
    };
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return {
      creator: null as CreatorProfile | null,
      stats: {
        totalEarnings: 0,
        totalSales: 0,
        totalPrompts: 0,
        averageRating: 0,
      },
      chart: [] as Array<{ month: string; earnings: number }>,
      prompts: [] as Array<{
        prompt: MarketplacePrompt;
        sales: number;
        earnings: number;
      }>,
    };
  }

  const creator = await getCreatorProfileByUserId(userId);
  if (!creator) {
    return {
      creator: null as CreatorProfile | null,
      stats: {
        totalEarnings: 0,
        totalSales: 0,
        totalPrompts: 0,
        averageRating: 0,
      },
      chart: [] as Array<{ month: string; earnings: number }>,
      prompts: [] as Array<{
        prompt: MarketplacePrompt;
        sales: number;
        earnings: number;
      }>,
    };
  }

  const { data: promptRows } = await supabase
    .from("marketplace_prompts")
    .select("*")
    .eq("creator_id", creator.id)
    .order("created_at", { ascending: false });

  const prompts = (promptRows ?? []) as MarketplacePrompt[];
  if (!prompts.length) {
    return {
      creator,
      stats: {
        totalEarnings: Number(creator.total_earnings) || 0,
        totalSales: 0,
        totalPrompts: 0,
        averageRating: 0,
      },
      chart: [] as Array<{ month: string; earnings: number }>,
      prompts: [] as Array<{
        prompt: MarketplacePrompt;
        sales: number;
        earnings: number;
      }>,
    };
  }

  const promptIds = prompts.map((prompt) => prompt.id);
  const { data: purchaseRows } = await supabase
    .from("prompt_purchases")
    .select("*")
    .in("marketplace_prompt_id", promptIds)
    .order("created_at", { ascending: false });

  const purchases = (purchaseRows ?? []) as PromptPurchase[];

  const statsByPrompt = new Map<string, { sales: number; earnings: number }>();
  const byMonth = new Map<string, number>();

  for (const purchase of purchases) {
    const stat = statsByPrompt.get(purchase.marketplace_prompt_id) ?? { sales: 0, earnings: 0 };
    stat.sales += 1;
    stat.earnings += Number(purchase.creator_earnings) || 0;
    statsByPrompt.set(purchase.marketplace_prompt_id, stat);

    const month = new Date(purchase.created_at).toISOString().slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + (Number(purchase.creator_earnings) || 0));
  }

  const promptRowsWithStats = prompts.map((prompt) => {
    const stat = statsByPrompt.get(prompt.id) ?? { sales: 0, earnings: 0 };
    return {
      prompt,
      sales: stat.sales,
      earnings: Number(stat.earnings.toFixed(2)),
    };
  });

  const weightedRatingTotal = prompts.reduce(
    (total, prompt) => total + (Number(prompt.rating_avg) || 0) * (prompt.rating_count || 0),
    0,
  );
  const ratingVotes = prompts.reduce((total, prompt) => total + (prompt.rating_count || 0), 0);

  const monthlyEntries = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, earnings]) => ({
      month,
      earnings: Number(earnings.toFixed(2)),
    }));

  return {
    creator,
    stats: {
      totalEarnings: Number(creator.total_earnings) || 0,
      totalSales: purchases.length,
      totalPrompts: prompts.length,
      averageRating: ratingVotes ? Number((weightedRatingTotal / ratingVotes).toFixed(2)) : 0,
    },
    chart: monthlyEntries,
    prompts: promptRowsWithStats,
  };
}

async function getMarketplaceCategoriesUncached() {
  if (!isSupabaseServiceConfigured()) return ["All"];
  const supabase = createServiceRoleClient();
  if (!supabase) return ["All"];

  const response = await withTimeout(
    supabase
      .from("marketplace_prompts")
      .select("category")
      .eq("status", "approved"),
  );
  const data = response?.data;

  const categories = Array.from(new Set((data ?? []).map((item) => item.category))).sort((a, b) =>
    a.localeCompare(b),
  );

  return ["All", ...categories];
}

const getMarketplaceCategoriesCached = unstable_cache(
  async () => getMarketplaceCategoriesUncached(),
  ["marketplace-categories-v1"],
  { revalidate: MARKETPLACE_REVALIDATE_SECONDS },
);

export async function getMarketplaceCategories() {
  return getMarketplaceCategoriesCached();
}
