import { User } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import { createServiceRoleClient, isSupabaseServiceConfigured } from "@/lib/supabase";
import { rankRecommendedPrompts } from "@/lib/recommendations";
import { matchesPromptTag, normalizePromptTag } from "@/lib/prompt-tags";
import { STARTER_PROMPTS } from "@/lib/starter-prompts";
import { CommunityPostView, GenerationWithPrompt, Prompt, UserProfile } from "@/types";

type PromptSort = "trending" | "newest" | "most_used";
const PUBLIC_DATA_REVALIDATE_SECONDS = 600;
const PUBLIC_QUERY_TIMEOUT_MS = 1500;

async function withTimeout<T>(promiseLike: PromiseLike<T>, timeoutMs = PUBLIC_QUERY_TIMEOUT_MS): Promise<T | null> {
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

function normalizeCategory(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || "All";
}

function getFallbackCommunityFeed(limit = 20) {
  return STARTER_PROMPTS.slice(0, limit).map((prompt, index) => ({
    id: `sample-${index + 1}`,
    likes: 10 + index * 3,
    created_at: new Date(Date.now() - index * 3600 * 1000).toISOString(),
    generation_id: `sample-generation-${index + 1}`,
    prompt_id: prompt.id,
    prompt_title: prompt.title,
    prompt_category: prompt.category,
    generated_image_url: prompt.example_image_url,
    user_id: `sample-user-${index + 1}`,
    username: `Artist${index + 1}`,
    user_avatar_url: null,
  })) as CommunityPostView[];
}

function sortPrompts(prompts: Prompt[], sort: PromptSort) {
  const sorted = [...prompts];
  if (sort === "newest") {
    sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return sorted;
  }
  if (sort === "most_used") {
    sorted.sort((a, b) => b.use_count - a.use_count);
    return sorted;
  }
  sorted.sort((a, b) => {
    if (a.is_featured === b.is_featured) return b.use_count - a.use_count;
    return a.is_featured ? -1 : 1;
  });
  return sorted;
}

type GetPromptsOptions = {
  category?: string;
  search?: string;
  sort?: PromptSort;
  featuredOnly?: boolean;
  limit?: number;
  tag?: string;
};

type GetRecommendedPromptsOptions = {
  userId: string | null | undefined;
  limit?: number;
};

const TITLE_STOPWORDS = new Set([
  "style",
  "edition",
  "portrait",
  "look",
  "scene",
  "frame",
  "pack",
  "pro",
  "new",
  "viral",
  "trending",
]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImageKey(value: string | null | undefined) {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimmed.split("?")[0]?.split("#")[0] ?? "";
  }
}

function getPromptThemeKey(prompt: Prompt) {
  const source = normalizeText(`${prompt.title} ${prompt.tags.join(" ")} ${prompt.category}`);
  const rules: Array<[RegExp, string]> = [
    [/\banime\b|\bghibli\b/, "anime"],
    [/\baction figure\b/, "action-figure"],
    [/\bbarbie box\b|\bdoll box\b/, "barbie-box"],
    [/\bnano\b|\bfigurine\b|\bdiorama\b|\bblind box\b/, "mini-figurine"],
    [/\blinkedin\b|\bheadshot\b|\bpassport\b/, "headshot"],
    [/\bbollywood\b|\bsaree\b/, "bollywood"],
    [/\bhaldi\b|\bmehendi\b|\bdiwali\b|\bholi\b|\bnavratri\b|\bgarba\b|\bfestival\b/, "festival"],
    [/\bneon\b|\bcyberpunk\b/, "neon"],
  ];

  for (const [pattern, key] of rules) {
    if (pattern.test(source)) return key;
  }

  const titleTokens = normalizeText(prompt.title)
    .split(" ")
    .filter((token) => token.length > 2 && !TITLE_STOPWORDS.has(token))
    .slice(0, 2);
  const fallbackToken = titleTokens.join("-") || "misc";
  return `${normalizeText(prompt.category) || "category"}:${fallbackToken}`;
}

function dedupeAndDiversifyPrompts(
  prompts: Prompt[],
  options: {
    maxPerTheme: number;
    maxPerCategory?: number;
    requireUniqueImages?: boolean;
    requireUniquePromptText?: boolean;
  },
) {
  const seenTitles = new Set<string>();
  const seenImages = new Set<string>();
  const seenPromptText = new Set<string>();
  const themeCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const result: Prompt[] = [];

  for (const prompt of prompts) {
    const normalizedTitle = normalizeText(prompt.title);
    if (seenTitles.has(normalizedTitle)) continue;

    if (options.requireUniquePromptText) {
      const normalizedPromptText = normalizeText(prompt.prompt_text);
      if (normalizedPromptText && seenPromptText.has(normalizedPromptText)) continue;
    }

    if (options.requireUniqueImages) {
      const normalizedImage = normalizeImageKey(prompt.example_image_url);
      if (normalizedImage && seenImages.has(normalizedImage)) continue;
    }

    const themeKey = getPromptThemeKey(prompt);
    const used = themeCounts.get(themeKey) ?? 0;
    if (used >= options.maxPerTheme) continue;

    if (options.maxPerCategory) {
      const categoryKey = normalizeText(prompt.category || "other");
      const categoryUsed = categoryCounts.get(categoryKey) ?? 0;
      if (categoryUsed >= options.maxPerCategory) continue;
      categoryCounts.set(categoryKey, categoryUsed + 1);
    }

    seenTitles.add(normalizedTitle);
    if (options.requireUniquePromptText) {
      const normalizedPromptText = normalizeText(prompt.prompt_text);
      if (normalizedPromptText) seenPromptText.add(normalizedPromptText);
    }
    if (options.requireUniqueImages) {
      const normalizedImage = normalizeImageKey(prompt.example_image_url);
      if (normalizedImage) seenImages.add(normalizedImage);
    }
    themeCounts.set(themeKey, used + 1);
    result.push(prompt);
  }

  return result;
}

function applyPromptFilters(
  prompts: Prompt[],
  category: string,
  featuredOnly: boolean,
  normalizedSearch: string,
  normalizedTag: string,
) {
  let result = [...prompts];
  if (category !== "All") result = result.filter((prompt) => prompt.category === category);
  if (featuredOnly) result = result.filter((prompt) => prompt.is_featured);
  if (normalizedTag) result = result.filter((prompt) => matchesPromptTag(prompt, normalizedTag));
  if (normalizedSearch) {
    result = result.filter((prompt) =>
      `${prompt.title} ${prompt.description} ${prompt.category} ${prompt.tags.join(" ")}`
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }
  return result;
}

function getPromptCandidateLimit(limit: number | undefined, hasTargetedFilters: boolean) {
  if (!limit) return 180;
  const paddedLimit = hasTargetedFilters ? limit * 4 : limit * 6;
  return Math.max(limit, Math.min(180, paddedLimit));
}

function appendPromptFallbacks(prompts: Prompt[], fallbackPrompts: Prompt[]) {
  const seenIds = new Set(prompts.map((prompt) => prompt.id));
  const combined = [...prompts];

  for (const prompt of fallbackPrompts) {
    if (seenIds.has(prompt.id)) continue;
    combined.push(prompt);
    seenIds.add(prompt.id);
  }

  return combined;
}

async function getPromptsFromSearchRpc(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  options: {
    category: string;
    search: string;
    sort: PromptSort;
    featuredOnly: boolean;
    limit: number;
    tag: string;
  },
) {
  const result = await withTimeout(
    supabase.rpc("search_public_prompts", {
      category_input: options.category,
      search_input: options.search,
      sort_input: options.sort,
      featured_only_input: options.featuredOnly,
      limit_input: options.limit,
      tag_input: options.tag,
    }),
  );

  return (result?.data as Prompt[] | null) ?? null;
}

async function getPromptsFromQueryBuilder(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  options: {
    category: string;
    search: string;
    sort: PromptSort;
    featuredOnly: boolean;
    limit: number;
    tag: string;
  },
) {
  function createBaseQuery() {
    let query = supabase.from("prompts").select("*");

    if (options.category !== "All") query = query.eq("category", options.category);
    if (options.featuredOnly) query = query.eq("is_featured", true);
    if (options.tag) query = query.contains("tags", [options.tag]);

    if (options.sort === "newest") query = query.order("created_at", { ascending: false });
    if (options.sort === "most_used") query = query.order("use_count", { ascending: false });
    if (options.sort === "trending") query = query.order("is_featured", { ascending: false }).order("use_count", { ascending: false });

    return query;
  }

  async function runQuery(query: ReturnType<typeof createBaseQuery>) {
    const result = await withTimeout(query.limit(options.limit));
    return (result?.data as Prompt[] | null) ?? null;
  }

  const queries: Array<Promise<Prompt[] | null>> = [];

  if (options.search) {
    queries.push(
      runQuery(
        createBaseQuery().or(
          `title.ilike.%${options.search}%,description.ilike.%${options.search}%,category.ilike.%${options.search}%`,
        ),
      ),
    );
    queries.push(runQuery(createBaseQuery().contains("tags", [options.search])));
  } else {
    queries.push(runQuery(createBaseQuery()));
  }

  const results = await Promise.all(queries);
  const merged = new Map<string, Prompt>();

  for (const rows of results) {
    for (const prompt of rows ?? []) {
      merged.set(prompt.id, prompt);
    }
  }

  if (!merged.size && results.every((rows) => rows === null)) {
    return null;
  }

  return Array.from(merged.values());
}

async function getPromptsUncached(options?: GetPromptsOptions) {
  const { category: rawCategory = "All", search = "", sort = "trending", featuredOnly = false, limit, tag = "" } = options ?? {};
  const category = normalizeCategory(rawCategory);
  const normalizedSearch = search.trim().toLowerCase();
  const normalizedTag = normalizePromptTag(tag);
  const fallbackPrompts = applyPromptFilters(STARTER_PROMPTS, category, featuredOnly, normalizedSearch, normalizedTag);
  const sortedFallbackPrompts = sortPrompts(fallbackPrompts, sort);
  const queryLimit = getPromptCandidateLimit(limit, Boolean(normalizedSearch || normalizedTag));
  const isAllFeed = category === "All" && !normalizedSearch && !normalizedTag;
  const diversityOptions = isAllFeed
    ? { maxPerTheme: 1, maxPerCategory: 3, requireUniqueImages: true, requireUniquePromptText: true }
    : { maxPerTheme: normalizedSearch || normalizedTag ? 4 : 2, requireUniqueImages: true, requireUniquePromptText: true };

  if (isSupabaseServiceConfigured()) {
    const supabase = createServiceRoleClient();
    if (supabase) {
      const rpcPrompts = await getPromptsFromSearchRpc(supabase, {
        category,
        search: normalizedSearch,
        sort,
        featuredOnly,
        limit: queryLimit,
        tag: normalizedTag,
      });

      if (rpcPrompts) {
        let merged = appendPromptFallbacks(rpcPrompts, sortedFallbackPrompts);
        merged = dedupeAndDiversifyPrompts(merged, diversityOptions);
        if (limit) merged = merged.slice(0, limit);
        return merged;
      }

      const queryBuilderPrompts = await getPromptsFromQueryBuilder(supabase, {
        category,
        search: normalizedSearch,
        sort,
        featuredOnly,
        limit: queryLimit,
        tag: normalizedTag,
      });

      if (queryBuilderPrompts) {
        let merged = applyPromptFilters(queryBuilderPrompts, category, featuredOnly, normalizedSearch, normalizedTag);
        merged = sortPrompts(merged, sort);
        merged = appendPromptFallbacks(merged, sortedFallbackPrompts);
        merged = dedupeAndDiversifyPrompts(merged, diversityOptions);
        if (limit) merged = merged.slice(0, limit);
        return merged;
      }
    }
  }

  let result = sortedFallbackPrompts;
  result = dedupeAndDiversifyPrompts(result, diversityOptions);
  if (limit) result = result.slice(0, limit);
  return result;
}

const getPromptsCached = unstable_cache(
  async (
    category: string,
    search: string,
    tag: string,
    sort: PromptSort,
    featuredOnly: boolean,
    limit: number | null,
  ) =>
    getPromptsUncached({
      category,
      search,
      sort,
      tag,
      featuredOnly,
      limit: limit ?? undefined,
    }),
  ["public-prompts-v7"],
  { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS },
);

export async function getPrompts(options?: GetPromptsOptions) {
  const { category: rawCategory = "All", search = "", sort = "trending", featuredOnly = false, limit, tag = "" } = options ?? {};
  const category = normalizeCategory(rawCategory);
  return getPromptsCached(category, search.trim().toLowerCase(), normalizePromptTag(tag), sort, featuredOnly, limit ?? null);
}

async function getPromptByIdUncached(id: string) {
  if (isSupabaseServiceConfigured()) {
    const supabase = createServiceRoleClient();
    if (supabase) {
      const result = await withTimeout(supabase.from("prompts").select("*").eq("id", id).single());
      if (result?.data) return result.data as Prompt;
    }
  }
  return STARTER_PROMPTS.find((prompt) => prompt.id === id) ?? null;
}

const getPromptByIdCached = unstable_cache(async (id: string) => getPromptByIdUncached(id), ["prompt-by-id-v1"], {
  revalidate: PUBLIC_DATA_REVALIDATE_SECONDS,
});

export async function getPromptById(id: string) {
  return getPromptByIdCached(id);
}

async function getRecommendedPromptsUncached(options: GetRecommendedPromptsOptions) {
  const { userId, limit = 12 } = options;
  if (!userId) return [] as Prompt[];

  const fallback = await getPrompts({ sort: "trending", limit });
  if (!isSupabaseServiceConfigured()) return fallback;

  const supabase = createServiceRoleClient();
  if (!supabase) return fallback;

  const [generationResult, collectionResult, followsResult] = await Promise.all([
    withTimeout(
      supabase
        .from("generations")
        .select("prompt_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(120),
    ),
    withTimeout(
      supabase
        .from("prompt_collections")
        .select("id")
        .eq("user_id", userId),
    ),
    withTimeout(
      supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", userId),
    ),
  ]);

  const signalMap = new Map<string, number>();

  const generationRows = generationResult?.data ?? [];
  for (const row of generationRows) {
    if (!row.prompt_id) continue;
    signalMap.set(row.prompt_id, (signalMap.get(row.prompt_id) ?? 0) + 3);
  }

  const collectionIds = (collectionResult?.data ?? []).map((row) => row.id);
  if (collectionIds.length) {
    const itemsResult = await withTimeout(
      supabase
        .from("prompt_collection_items")
        .select("prompt_id")
        .in("collection_id", collectionIds)
        .limit(300),
    );

    for (const row of itemsResult?.data ?? []) {
      if (!row.prompt_id) continue;
      signalMap.set(row.prompt_id, (signalMap.get(row.prompt_id) ?? 0) + 5);
    }
  }

  const followingIds = Array.from(
    new Set((followsResult?.data ?? []).map((row) => row.following_id).filter(Boolean)),
  );

  if (followingIds.length) {
    const followPostsResult = await withTimeout(
      supabase
        .from("community_posts")
        .select("generation_id")
        .in("user_id", followingIds)
        .order("created_at", { ascending: false })
        .limit(200),
    );

    const followGenerationIds = Array.from(
      new Set((followPostsResult?.data ?? []).map((row) => row.generation_id).filter(Boolean)),
    );

    if (followGenerationIds.length) {
      const followGenerationsResult = await withTimeout(
        supabase
          .from("generations")
          .select("id, prompt_id")
          .in("id", followGenerationIds),
      );

      for (const row of followGenerationsResult?.data ?? []) {
        if (!row.prompt_id) continue;
        signalMap.set(row.prompt_id, (signalMap.get(row.prompt_id) ?? 0) + 2);
      }
    }
  }

  const sourcePromptIds = Array.from(signalMap.keys());
  if (!sourcePromptIds.length) return fallback;

  const sourcePromptsResult = await withTimeout(
    supabase
      .from("prompts")
      .select("*")
      .in("id", sourcePromptIds),
  );

  const sourcePrompts = (sourcePromptsResult?.data as Prompt[] | null) ?? [];
  if (!sourcePrompts.length) return fallback;

  const candidateResult = await withTimeout(
    supabase
      .from("prompts")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("use_count", { ascending: false })
      .limit(180),
  );

  const candidates = (candidateResult?.data as Prompt[] | null) ?? [];

  let ranked = rankRecommendedPrompts({
    sourcePrompts,
    candidates,
    signals: signalMap,
    limit,
  });

  if (ranked.length < limit) {
    const existingIds = new Set(ranked.map((prompt) => prompt.id));
    const sourceIds = new Set(sourcePrompts.map((prompt) => prompt.id));

    for (const prompt of fallback) {
      if (existingIds.has(prompt.id) || sourceIds.has(prompt.id)) continue;
      ranked.push(prompt);
      existingIds.add(prompt.id);
      if (ranked.length >= limit) break;
    }
  }

  return ranked.slice(0, limit);
}

const getRecommendedPromptsCached = unstable_cache(
  async (userId: string, limit: number) => getRecommendedPromptsUncached({ userId, limit }),
  ["recommended-prompts-v1"],
  { revalidate: 300 },
);

export async function getRecommendedPrompts(options: GetRecommendedPromptsOptions) {
  const { userId, limit = 12 } = options;
  if (!userId) return [] as Prompt[];
  return getRecommendedPromptsCached(userId, Math.max(1, Math.min(24, Math.floor(limit))));
}
export async function getUserProfileById(userId: string) {
  if (!isSupabaseServiceConfigured()) return null;
  const supabase = createServiceRoleClient();
  if (!supabase) return null;

  const { data } = await supabase.from("users").select("*").eq("id", userId).single();
  return (data as UserProfile) ?? null;
}

export async function ensureUserProfile(authUser: User) {
  if (!isSupabaseServiceConfigured()) return null;
  const supabase = createServiceRoleClient();
  if (!supabase) return null;

  const { data: existing } = await supabase.from("users").select("*").eq("id", authUser.id).maybeSingle();
  const existingProfile = (existing as UserProfile | null) ?? null;
  const nextEmail = authUser.email ?? existingProfile?.email ?? null;
  const nextFullName =
    authUser.user_metadata?.full_name ??
    authUser.user_metadata?.name ??
    existingProfile?.full_name ??
    authUser.email?.split("@")[0] ??
    "PromptGallery User";
  const nextAvatarUrl = authUser.user_metadata?.avatar_url ?? existingProfile?.avatar_url ?? null;

  if (!nextEmail) {
    return existingProfile;
  }

  const needsSync =
    !existingProfile ||
    existingProfile.email !== nextEmail ||
    existingProfile.full_name !== nextFullName ||
    existingProfile.avatar_url !== nextAvatarUrl;

  if (!needsSync) {
    return existingProfile;
  }

  const { data } = await supabase
    .from("users")
    .upsert(
      {
        id: authUser.id,
        email: nextEmail,
        full_name: nextFullName,
        avatar_url: nextAvatarUrl,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  return (data as UserProfile) ?? existingProfile ?? null;
}

export async function getGenerationHistory(userId: string, limit = 30) {
  if (!isSupabaseServiceConfigured()) return [] as GenerationWithPrompt[];
  const supabase = createServiceRoleClient();
  if (!supabase) return [] as GenerationWithPrompt[];

  const [{ data: generationRows }, { data: userRow }] = await Promise.all([
    supabase
      .from("generations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("users").select("id, is_pro").eq("id", userId).maybeSingle(),
  ]);

  if (!generationRows || generationRows.length === 0) return [] as GenerationWithPrompt[];

  const promptIds = Array.from(new Set(generationRows.map((generation) => generation.prompt_id)));
  const { data: promptRows } = await supabase.from("prompts").select("*").in("id", promptIds);
  const promptMap = new Map((promptRows ?? []).map((prompt) => [prompt.id, prompt as Prompt]));

  const isPro = Boolean(userRow?.is_pro);

  return generationRows.map((generation) => {
    const generatedImageUrl = isPro
      ? generation.generated_image_url_clean ?? generation.generated_image_url
      : generation.generated_image_url_watermarked ?? generation.generated_image_url;

    return {
      ...(generation as object),
      generated_image_url: generatedImageUrl,
      prompt: promptMap.get(generation.prompt_id) ?? null,
    };
  }) as GenerationWithPrompt[];
}

type GetCommunityFeedOptions = {
  category?: string;
  limit?: number;
  mostLikedThisWeek?: boolean;
  scope?: "all" | "following";
  viewerUserId?: string | null;
};

async function getCommunityFeedUncached(options?: GetCommunityFeedOptions) {
  if (!isSupabaseServiceConfigured()) {
    return getFallbackCommunityFeed(options?.limit ?? 20);
  }

  const supabase = createServiceRoleClient();
  if (!supabase) return getFallbackCommunityFeed(options?.limit ?? 20);

  let postsQuery = supabase.from("community_posts").select("*");
  const scope = options?.scope ?? "all";
  const viewerUserId = options?.viewerUserId ?? null;

  if (scope === "following") {
    if (!viewerUserId) return [];

    const followsResult = await withTimeout(
      supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", viewerUserId),
    );
    const followRows = followsResult?.data;
    const followingUserIds = Array.from(
      new Set((followRows ?? []).map((row) => row.following_id).filter(Boolean)),
    );
    if (!followingUserIds.length) return [];

    postsQuery = postsQuery.in("user_id", followingUserIds);
  }

  const lowerBound = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  if (options?.mostLikedThisWeek) {
    postsQuery = postsQuery.gte("created_at", lowerBound).order("likes", { ascending: false });
  } else {
    postsQuery = postsQuery.order("created_at", { ascending: false });
  }
  if (options?.limit) postsQuery = postsQuery.limit(options.limit);

  const postsResult = await withTimeout(postsQuery);
  const postRows = postsResult?.data;
  if (!postRows || postRows.length === 0) return [];

  const generationIds = Array.from(new Set(postRows.map((post) => post.generation_id)));
  const userIds = Array.from(new Set(postRows.map((post) => post.user_id)));

  const rowsResult = await withTimeout(
    Promise.all([
      supabase
        .from("generations")
        .select("id, generated_image_url, prompt_id")
        .in("id", generationIds),
      supabase
        .from("users")
        .select("id, full_name, avatar_url")
        .in("id", userIds),
    ]),
  );
  if (!rowsResult) return getFallbackCommunityFeed(options?.limit ?? 20);
  const [generationResponse, userResponse] = rowsResult;
  const generationRows = generationResponse.data;
  const userRows = userResponse.data;

  const promptIds = Array.from(new Set((generationRows ?? []).map((generation) => generation.prompt_id)));
  const promptResult = await withTimeout(supabase.from("prompts").select("id, title, category").in("id", promptIds));
  const promptRows = promptResult?.data;

  const generationMap = new Map((generationRows ?? []).map((generation) => [generation.id, generation]));
  const userMap = new Map((userRows ?? []).map((user) => [user.id, user]));
  const promptMap = new Map((promptRows ?? []).map((prompt) => [prompt.id, prompt]));

  let mapped = postRows
    .map((post) => {
      const generation = generationMap.get(post.generation_id);
      const prompt = generation ? promptMap.get(generation.prompt_id) : null;
      const user = userMap.get(post.user_id);
      if (!generation || !prompt || !user) return null;

      return {
        id: post.id,
        likes: post.likes,
        created_at: post.created_at,
        generation_id: generation.id,
        prompt_id: prompt.id,
        prompt_title: prompt.title,
        prompt_category: prompt.category,
        generated_image_url: generation.generated_image_url,
        user_id: post.user_id,
        username: user.full_name ?? "Anonymous",
        user_avatar_url: user.avatar_url,
      } satisfies CommunityPostView;
    })
    .filter(Boolean) as CommunityPostView[];

  const category = normalizeCategory(options?.category);
  if (category !== "All") {
    mapped = mapped.filter((post) => post.prompt_category === category);
  }
  return mapped;
}

const getCommunityFeedCached = unstable_cache(
  async (category: string, limit: number, mostLikedThisWeek: boolean) =>
    getCommunityFeedUncached({
      category,
      limit,
      mostLikedThisWeek,
    }),
  ["community-feed-v2"],
  { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS },
);

export async function getCommunityFeed(options?: GetCommunityFeedOptions) {
  const {
    category: rawCategory = "All",
    limit = 20,
    mostLikedThisWeek = false,
    scope = "all",
    viewerUserId = null,
  } = options ?? {};
  const category = normalizeCategory(rawCategory);

  if (scope === "following") {
    return getCommunityFeedUncached({
      category,
      limit,
      mostLikedThisWeek,
      scope,
      viewerUserId,
    });
  }

  return getCommunityFeedCached(category, limit, mostLikedThisWeek);
}

async function getPromptCommunityResultsUncached(promptId: string, limit = 12) {
  if (!isSupabaseServiceConfigured()) {
    return [] as CommunityPostView[];
  }

  const supabase = createServiceRoleClient();
  if (!supabase) return [] as CommunityPostView[];

  const generationsResult = await withTimeout(
    supabase
      .from("generations")
      .select("id, generated_image_url, prompt_id")
      .eq("prompt_id", promptId)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(limit * 2),
  );
  const generations = generationsResult?.data;

  if (!generations || generations.length === 0) return [] as CommunityPostView[];

  const generationIds = generations.map((generation) => generation.id);
  const postsResult = await withTimeout(
    supabase
      .from("community_posts")
      .select("*")
      .in("generation_id", generationIds)
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  const posts = postsResult?.data;

  if (!posts || posts.length === 0) return [] as CommunityPostView[];

  const userIds = Array.from(new Set(posts.map((post) => post.user_id)));
  const promptAndUserResult = await withTimeout(
    Promise.all([
      supabase
        .from("users")
        .select("id, full_name, avatar_url")
        .in("id", userIds),
      supabase
        .from("prompts")
        .select("id, title, category")
        .eq("id", promptId)
        .single(),
    ]),
  );
  if (!promptAndUserResult) return [] as CommunityPostView[];
  const [usersResponse, promptResponse] = promptAndUserResult;
  const users = usersResponse.data;
  const prompt = promptResponse.data;

  const generationMap = new Map(generations.map((generation) => [generation.id, generation]));
  const userMap = new Map((users ?? []).map((user) => [user.id, user]));

  return posts
    .map((post) => {
      const generation = generationMap.get(post.generation_id);
      const user = userMap.get(post.user_id);
      if (!generation || !user || !prompt) return null;
      return {
        id: post.id,
        likes: post.likes,
        created_at: post.created_at,
        generation_id: generation.id,
        prompt_id: prompt.id,
        prompt_title: prompt.title,
        prompt_category: prompt.category,
        generated_image_url: generation.generated_image_url,
        user_id: post.user_id,
        username: user.full_name ?? "Anonymous",
        user_avatar_url: user.avatar_url,
      } satisfies CommunityPostView;
    })
    .filter(Boolean) as CommunityPostView[];
}

const getPromptCommunityResultsCached = unstable_cache(
  async (promptId: string, limit: number) => getPromptCommunityResultsUncached(promptId, limit),
  ["prompt-community-results-v1"],
  { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS },
);

export async function getPromptCommunityResults(promptId: string, limit = 12) {
  return getPromptCommunityResultsCached(promptId, limit);
}
