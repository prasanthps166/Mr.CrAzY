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

const QUERY_TIMEOUT_MS = 3500;

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

export async function getCommunityFeedPage(
  options: CommunityFeedPageOptions = {},
): Promise<CommunityFeedPageResult> {
  const limit = clampInteger(options.limit ?? 24, 24, 1, 60);
  const offset = clampInteger(options.offset ?? 0, 0, 0, 50_000);
  const category = normalizeCategory(options.category);
  const scope = options.scope ?? "all";
  const viewerUserId = options.viewerUserId ?? null;
  const sort = options.sort ?? "recent";
  const search = options.search ?? "";

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

  let baseQuery = supabase.from("community_posts").select("*");

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

  const normalizedSearch = normalize(search);
  const scanSize = Math.max(limit * 3, 60);
  let cursor = offset;
  let reachedEnd = false;
  const collected: CommunityPostView[] = [];

  while (collected.length < limit && !reachedEnd) {
    const postsResult = await withTimeout(baseQuery.range(cursor, cursor + scanSize - 1));
    const postRows = postsResult?.data;

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

    const rowsResult = await withTimeout(
      Promise.all([
        supabase.from("generations").select("id, generated_image_url, prompt_id").in("id", generationIds),
        supabase.from("users").select("id, full_name, avatar_url").in("id", userIds),
      ]),
    );

    if (!rowsResult) {
      break;
    }

    const [generationResponse, userResponse] = rowsResult;
    const generationRows = generationResponse.data;
    const userRows = userResponse.data;

    const promptIds = Array.from(new Set((generationRows ?? []).map((generation) => generation.prompt_id)));
    const promptResult = promptIds.length
      ? await withTimeout(
          supabase.from("prompts").select("id, title, category").in("id", promptIds),
        )
      : { data: [] as Array<{ id: string; title: string; category: string }> };

    const promptRows = promptResult?.data ?? [];

    const generationMap = new Map((generationRows ?? []).map((generation) => [generation.id, generation]));
    const promptMap = new Map((promptRows ?? []).map((prompt) => [prompt.id, prompt]));
    const userMap = new Map((userRows ?? []).map((user) => [user.id, user]));

    const mapped = postRows
      .map((post) => {
        const generation = generationMap.get(post.generation_id);
        const prompt = generation ? promptMap.get(generation.prompt_id) : null;
        const user = userMap.get(post.user_id);
        if (!generation || !prompt || !user) return null;

        const view = {
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

        if (category !== "All" && view.prompt_category !== category) return null;
        if (!matchesSearch(view, normalizedSearch)) return null;
        return view;
      })
      .filter(Boolean) as CommunityPostView[];

    const sortedMapped = sortPosts(mapped, sort);

    for (const post of sortedMapped) {
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
