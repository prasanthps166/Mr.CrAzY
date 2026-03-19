import { unstable_cache } from "next/cache";

import { CommunityPostView } from "@/types";
import { STARTER_PROMPTS } from "@/lib/starter-prompts";
import { createServiceRoleClient, isSupabaseServiceConfigured } from "@/lib/supabase";

export type CommunityFeedScope = "all" | "following";
export type CommunityFeedPageSort = "recent" | "top_week" | "most_liked";

export type CommunityFeedPageOptions = {
  limit?: number;
  offset?: number;
  category?: string;
  scope?: CommunityFeedScope;
  viewerUserId?: string | null;
  sort?: CommunityFeedPageSort;
  search?: string;
};

export type CommunityFeedPageResult = {
  posts: CommunityPostView[];
  hasMore: boolean;
  nextOffset: number;
};

type CommunityPostRow = {
  id: string;
  likes: number;
  created_at: string;
  generation_id: string;
  user_id: string;
};

type CommunityGenerationRow = {
  id: string;
  generated_image_url: string;
  prompt_id: string;
};

type CommunityPromptRow = {
  id: string;
  title: string;
  category: string;
};

type CommunityUserRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type CommunityFeedLookupState = {
  promptMap: Map<string, CommunityPromptRow>;
  userMap: Map<string, CommunityUserRow>;
  categoryPromptIds: Set<string> | null;
  searchPromptIds: Set<string> | null;
  searchUserIds: Set<string> | null;
  empty: boolean;
};

const QUERY_TIMEOUT_MS = 2000;
const PUBLIC_REVALIDATE_SECONDS = 120;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCategory(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || "All";
}

function clampInteger(value: number | null | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

async function withTimeout<T>(promiseLike: PromiseLike<T>, timeoutMs = QUERY_TIMEOUT_MS): Promise<T | null> {
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

function matchesSearch(post: CommunityPostView, normalizedSearch: string) {
  if (!normalizedSearch) return true;
  const haystack = normalize(`${post.prompt_title} ${post.prompt_category} ${post.username}`);
  return haystack.includes(normalizedSearch);
}

function sortPosts(posts: CommunityPostView[], sort: CommunityFeedPageSort) {
  return [...posts].sort((a, b) => {
    if (sort === "top_week" || sort === "most_liked") {
      if (b.likes !== a.likes) return b.likes - a.likes;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function getFallbackFeed(limit = 120) {
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

function filterPosts(
  posts: CommunityPostView[],
  category: string,
  search: string,
  sort: CommunityFeedPageSort,
) {
  const normalizedSearch = normalize(search);
  let result = [...posts];

  if (category !== "All") {
    result = result.filter((post) => post.prompt_category === category);
  }

  if (normalizedSearch) {
    result = result.filter((post) => matchesSearch(post, normalizedSearch));
  }

  return sortPosts(result, sort);
}

function getScanSize(limit: number, options: { category: string; scope: CommunityFeedScope; normalizedSearch: string }) {
  let multiplier = 3;

  if (options.scope === "following") multiplier = Math.max(multiplier, 4);
  if (options.category !== "All") multiplier = Math.max(multiplier, 5);
  if (options.normalizedSearch) multiplier = Math.max(multiplier, 6);

  return clampInteger(limit * multiplier, Math.max(limit * 3, 60), 60, 240);
}

function createCommunityView(
  post: CommunityPostRow,
  generation: CommunityGenerationRow,
  prompt: CommunityPromptRow,
  user: CommunityUserRow,
) {
  return {
    id: post.id,
    likes: post.likes,
    created_at: post.created_at,
    generation_id: post.generation_id,
    prompt_id: prompt.id,
    prompt_title: prompt.title,
    prompt_category: prompt.category,
    generated_image_url: generation.generated_image_url,
    user_id: post.user_id,
    username: user.full_name ?? "Anonymous",
    user_avatar_url: user.avatar_url,
  } satisfies CommunityPostView;
}

export function shouldIncludeCommunityView(
  post: Pick<CommunityPostView, "prompt_title" | "prompt_category" | "username">,
  filters: {
    normalizedSearch: string;
    promptId: string;
    userId: string;
    categoryPromptIds?: ReadonlySet<string> | null;
    searchPromptIds?: ReadonlySet<string> | null;
    searchUserIds?: ReadonlySet<string> | null;
  },
) {
  if (filters.categoryPromptIds && !filters.categoryPromptIds.has(filters.promptId)) {
    return false;
  }

  if (!filters.normalizedSearch) {
    return true;
  }

  if (filters.searchPromptIds?.has(filters.promptId) || filters.searchUserIds?.has(filters.userId)) {
    return true;
  }

  return matchesSearch(post as CommunityPostView, filters.normalizedSearch);
}

async function buildLookupState(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  options: { category: string; normalizedSearch: string },
): Promise<CommunityFeedLookupState> {
  const promptMap = new Map<string, CommunityPromptRow>();
  const userMap = new Map<string, CommunityUserRow>();
  let categoryPromptIds: Set<string> | null = null;
  let searchPromptIds: Set<string> | null = null;
  let searchUserIds: Set<string> | null = null;

  if (options.category !== "All") {
    const categoryPromptResult = await withTimeout(
      supabase.from("prompts").select("id, title, category").eq("category", options.category),
    );
    const categoryPromptRows = (categoryPromptResult?.data ?? []) as CommunityPromptRow[];
    for (const row of categoryPromptRows) {
      promptMap.set(row.id, row);
    }
    categoryPromptIds = categoryPromptResult ? new Set(categoryPromptRows.map((row) => row.id)) : null;

    if (categoryPromptResult && categoryPromptRows.length === 0) {
      return {
        promptMap,
        userMap,
        categoryPromptIds,
        searchPromptIds,
        searchUserIds,
        empty: true,
      };
    }
  }

  if (options.normalizedSearch) {
    const [promptSearchResult, userSearchResult] = await Promise.all([
      withTimeout(
        supabase
          .from("prompts")
          .select("id, title, category")
          .or(`title.ilike.%${options.normalizedSearch}%,category.ilike.%${options.normalizedSearch}%`),
      ),
      withTimeout(
        supabase
          .from("users")
          .select("id, full_name, avatar_url")
          .ilike("full_name", `%${options.normalizedSearch}%`),
      ),
    ]);

    const promptSearchRows = (promptSearchResult?.data ?? []) as CommunityPromptRow[];
    const userSearchRows = (userSearchResult?.data ?? []) as CommunityUserRow[];

    for (const row of promptSearchRows) {
      promptMap.set(row.id, row);
    }
    for (const row of userSearchRows) {
      userMap.set(row.id, row);
    }

    searchPromptIds = promptSearchResult ? new Set(promptSearchRows.map((row) => row.id)) : null;
    searchUserIds = userSearchResult ? new Set(userSearchRows.map((row) => row.id)) : null;

    const promptSearchMatchCount = searchPromptIds?.size ?? 0;
    const userSearchMatchCount = searchUserIds?.size ?? 0;

    if (promptSearchResult && userSearchResult && promptSearchMatchCount === 0 && userSearchMatchCount === 0) {
      return {
        promptMap,
        userMap,
        categoryPromptIds,
        searchPromptIds,
        searchUserIds,
        empty: true,
      };
    }
  }

  return {
    promptMap,
    userMap,
    categoryPromptIds,
    searchPromptIds,
    searchUserIds,
    empty: false,
  };
}

async function getCommunityFeedPageUncached(
  options: CommunityFeedPageOptions = {},
): Promise<CommunityFeedPageResult> {
  const limit = clampInteger(options.limit ?? 12, 12, 1, 60);
  const offset = clampInteger(options.offset ?? 0, 0, 0, 50_000);
  const category = normalizeCategory(options.category);
  const scope = options.scope ?? "all";
  const viewerUserId = options.viewerUserId ?? null;
  const sort = options.sort ?? "recent";
  const search = options.search ?? "";
  const normalizedSearch = normalize(search);

  if (scope === "following" && !viewerUserId) {
    return {
      posts: [],
      hasMore: false,
      nextOffset: offset,
    };
  }

  if (!isSupabaseServiceConfigured()) {
    const fallback = filterPosts(getFallbackFeed(240), category, search, sort);
    const posts = fallback.slice(offset, offset + limit);
    return {
      posts,
      hasMore: offset + posts.length < fallback.length,
      nextOffset: offset + posts.length,
    };
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    const fallback = filterPosts(getFallbackFeed(240), category, search, sort);
    const posts = fallback.slice(offset, offset + limit);
    return {
      posts,
      hasMore: offset + posts.length < fallback.length,
      nextOffset: offset + posts.length,
    };
  }

  const lookupState = await buildLookupState(supabase, {
    category,
    normalizedSearch,
  });

  if (lookupState.empty) {
    return {
      posts: [],
      hasMore: false,
      nextOffset: offset,
    };
  }

  let baseQuery = supabase.from("community_posts").select("id, likes, created_at, generation_id, user_id");

  if (scope === "following" && viewerUserId) {
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

    if (!followingUserIds.length) {
      return {
        posts: [],
        hasMore: false,
        nextOffset: offset,
      };
    }

    baseQuery = baseQuery.in("user_id", followingUserIds);
  }

  if (sort === "top_week") {
    const lowerBound = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    baseQuery = baseQuery.gte("created_at", lowerBound);
  }

  if (sort === "top_week" || sort === "most_liked") {
    baseQuery = baseQuery.order("likes", { ascending: false }).order("created_at", { ascending: false });
  } else {
    baseQuery = baseQuery.order("created_at", { ascending: false });
  }

  const scanSize = getScanSize(limit, { category, scope, normalizedSearch });
  let cursor = offset;
  let reachedEnd = false;
  const collected: CommunityPostView[] = [];
  const generationMap = new Map<string, CommunityGenerationRow>();
  const promptMap = lookupState.promptMap;
  const userMap = lookupState.userMap;

  while (collected.length < limit && !reachedEnd) {
    const postsResult = await withTimeout(baseQuery.range(cursor, cursor + scanSize - 1));
    const postRows = postsResult?.data as CommunityPostRow[] | undefined;

    if (!postRows?.length) {
      reachedEnd = true;
      break;
    }

    cursor += postRows.length;
    if (postRows.length < scanSize) {
      reachedEnd = true;
    }

    const generationIds = Array.from(new Set(postRows.map((post) => post.generation_id)));
    const userIds = Array.from(new Set(postRows.map((post) => post.user_id)));
    const missingGenerationIds = generationIds.filter((id) => !generationMap.has(id));
    const missingUserIds = userIds.filter((id) => !userMap.has(id));

    if (missingGenerationIds.length || missingUserIds.length) {
      const rowsResult = await withTimeout(
        Promise.all([
          missingGenerationIds.length
            ? supabase
                .from("generations")
                .select("id, generated_image_url, prompt_id")
                .in("id", missingGenerationIds)
            : Promise.resolve({ data: [] as CommunityGenerationRow[] }),
          missingUserIds.length
            ? supabase.from("users").select("id, full_name, avatar_url").in("id", missingUserIds)
            : Promise.resolve({ data: [] as CommunityUserRow[] }),
        ]),
      );

      if (!rowsResult) {
        reachedEnd = true;
        break;
      }

      const [generationResponse, userResponse] = rowsResult;

      for (const row of (generationResponse.data ?? []) as CommunityGenerationRow[]) {
        generationMap.set(row.id, row);
      }
      for (const row of (userResponse.data ?? []) as CommunityUserRow[]) {
        userMap.set(row.id, row);
      }
    }

    const promptIds = Array.from(
      new Set(
        generationIds
          .map((generationId) => generationMap.get(generationId)?.prompt_id)
          .filter(Boolean) as string[],
      ),
    );
    const missingPromptIds = promptIds.filter((id) => !promptMap.has(id));
    const promptResult = missingPromptIds.length
      ? await withTimeout(
          supabase.from("prompts").select("id, title, category").in("id", missingPromptIds),
        )
      : { data: [] as Array<{ id: string; title: string; category: string }> };

    if (!promptResult) {
      reachedEnd = true;
      break;
    }

    for (const row of (promptResult.data ?? []) as CommunityPromptRow[]) {
      promptMap.set(row.id, row);
    }

    const mapped = postRows
      .map((post) => {
        const generation = generationMap.get(post.generation_id);
        const prompt = generation ? promptMap.get(generation.prompt_id) : null;
        const user = userMap.get(post.user_id);
        if (!generation || !prompt || !user) return null;

        const view = createCommunityView(post, generation, prompt, user);

        if (
          !shouldIncludeCommunityView(view, {
            normalizedSearch,
            promptId: prompt.id,
            userId: post.user_id,
            categoryPromptIds: lookupState.categoryPromptIds,
            searchPromptIds: lookupState.searchPromptIds,
            searchUserIds: lookupState.searchUserIds,
          })
        ) {
          return null;
        }

        return view;
      })
      .filter(Boolean) as CommunityPostView[];

    for (const post of mapped) {
      if (collected.length >= limit) break;
      collected.push(post);
    }
  }

  return {
    posts: collected,
    hasMore: !reachedEnd,
    nextOffset: cursor,
  };
}
const getCommunityFeedPageCached = unstable_cache(
  async (category: string, sort: CommunityFeedPageSort, search: string, limit: number, offset: number) =>
    getCommunityFeedPageUncached({
      category,
      scope: "all",
      sort,
      search,
      limit,
      offset,
    }),
  ["community-feed-page-v1"],
  { revalidate: PUBLIC_REVALIDATE_SECONDS },
);

export async function getCommunityFeedPage(
  options: CommunityFeedPageOptions = {},
): Promise<CommunityFeedPageResult> {
  const limit = clampInteger(options.limit ?? 12, 12, 1, 60);
  const offset = clampInteger(options.offset ?? 0, 0, 0, 50_000);
  const category = normalizeCategory(options.category);
  const scope = options.scope ?? "all";
  const viewerUserId = options.viewerUserId ?? null;
  const sort = options.sort ?? "recent";
  const search = options.search ?? "";

  if (scope === "following") {
    return getCommunityFeedPageUncached({
      category,
      scope,
      viewerUserId,
      sort,
      search,
      limit,
      offset,
    });
  }

  return getCommunityFeedPageCached(category, sort, normalize(search), limit, offset);
}
