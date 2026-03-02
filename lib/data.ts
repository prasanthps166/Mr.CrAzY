import { User } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import { createServiceRoleClient, isSupabaseServiceConfigured } from "@/lib/supabase";
import { STARTER_PROMPTS } from "@/lib/starter-prompts";
import { CommunityPostView, GenerationWithPrompt, Prompt, UserProfile } from "@/types";

type PromptSort = "trending" | "newest" | "most_used";
const PUBLIC_DATA_REVALIDATE_SECONDS = 90;

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
};

async function getPromptsUncached(options?: GetPromptsOptions) {
  const { category = "All", search = "", sort = "trending", featuredOnly = false, limit } = options ?? {};
  const normalizedSearch = search.trim().toLowerCase();

  if (isSupabaseServiceConfigured()) {
    const supabase = createServiceRoleClient();
    if (supabase) {
      let query = supabase.from("prompts").select("*");

      if (category !== "All") query = query.eq("category", category);
      if (featuredOnly) query = query.eq("is_featured", true);
      if (normalizedSearch) {
        query = query.or(
          `title.ilike.%${normalizedSearch}%,description.ilike.%${normalizedSearch}%,category.ilike.%${normalizedSearch}%`,
        );
      }

      if (sort === "newest") query = query.order("created_at", { ascending: false });
      if (sort === "most_used") query = query.order("use_count", { ascending: false });
      if (sort === "trending") query = query.order("is_featured", { ascending: false }).order("use_count", { ascending: false });

      if (limit) query = query.limit(limit);

      const { data } = await query;
      if (data) return data as Prompt[];
    }
  }

  let result = [...STARTER_PROMPTS];
  if (category !== "All") result = result.filter((prompt) => prompt.category === category);
  if (featuredOnly) result = result.filter((prompt) => prompt.is_featured);
  if (normalizedSearch) {
    result = result.filter((prompt) =>
      `${prompt.title} ${prompt.description} ${prompt.category} ${prompt.tags.join(" ")}`
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }
  result = sortPrompts(result, sort);
  if (limit) result = result.slice(0, limit);
  return result;
}

const getPromptsCached = unstable_cache(
  async (
    category: string,
    search: string,
    sort: PromptSort,
    featuredOnly: boolean,
    limit: number | null,
  ) =>
    getPromptsUncached({
      category,
      search,
      sort,
      featuredOnly,
      limit: limit ?? undefined,
    }),
  ["public-prompts-v1"],
  { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS },
);

export async function getPrompts(options?: GetPromptsOptions) {
  const { category = "All", search = "", sort = "trending", featuredOnly = false, limit } = options ?? {};
  return getPromptsCached(category, search.trim().toLowerCase(), sort, featuredOnly, limit ?? null);
}

async function getPromptByIdUncached(id: string) {
  if (isSupabaseServiceConfigured()) {
    const supabase = createServiceRoleClient();
    if (supabase) {
      const { data } = await supabase.from("prompts").select("*").eq("id", id).single();
      if (data) return data as Prompt;
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

  const fullName =
    authUser.user_metadata?.full_name ??
    authUser.user_metadata?.name ??
    authUser.email?.split("@")[0] ??
    "PromptGallery User";
  const avatarUrl = authUser.user_metadata?.avatar_url ?? null;

  const { data } = await supabase
    .from("users")
    .upsert(
      {
        id: authUser.id,
        email: authUser.email,
        full_name: fullName,
        avatar_url: avatarUrl,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  return (data as UserProfile) ?? null;
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
};

async function getCommunityFeedUncached(options?: GetCommunityFeedOptions) {
  if (!isSupabaseServiceConfigured()) {
    return STARTER_PROMPTS.slice(0, options?.limit ?? 20).map((prompt, index) => ({
      id: `sample-${index + 1}`,
      likes: 10 + index * 3,
      created_at: new Date(Date.now() - index * 3600 * 1000).toISOString(),
      prompt_title: prompt.title,
      prompt_category: prompt.category,
      generated_image_url: prompt.example_image_url,
      username: `Artist${index + 1}`,
      user_avatar_url: null,
    })) as CommunityPostView[];
  }

  const supabase = createServiceRoleClient();
  if (!supabase) return [];

  let postsQuery = supabase.from("community_posts").select("*");
  const lowerBound = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  if (options?.mostLikedThisWeek) {
    postsQuery = postsQuery.gte("created_at", lowerBound).order("likes", { ascending: false });
  } else {
    postsQuery = postsQuery.order("created_at", { ascending: false });
  }
  if (options?.limit) postsQuery = postsQuery.limit(options.limit);

  const { data: postRows } = await postsQuery;
  if (!postRows || postRows.length === 0) return [];

  const generationIds = Array.from(new Set(postRows.map((post) => post.generation_id)));
  const userIds = Array.from(new Set(postRows.map((post) => post.user_id)));

  const [{ data: generationRows }, { data: userRows }] = await Promise.all([
    supabase
      .from("generations")
      .select("id, generated_image_url, prompt_id")
      .in("id", generationIds),
    supabase
      .from("users")
      .select("id, full_name, avatar_url")
      .in("id", userIds),
  ]);

  const promptIds = Array.from(new Set((generationRows ?? []).map((generation) => generation.prompt_id)));
  const { data: promptRows } = await supabase.from("prompts").select("id, title, category").in("id", promptIds);

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
        prompt_title: prompt.title,
        prompt_category: prompt.category,
        generated_image_url: generation.generated_image_url,
        username: user.full_name ?? "Anonymous",
        user_avatar_url: user.avatar_url,
      } satisfies CommunityPostView;
    })
    .filter(Boolean) as CommunityPostView[];

  const category = options?.category ?? "All";
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
  ["community-feed-v1"],
  { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS },
);

export async function getCommunityFeed(options?: GetCommunityFeedOptions) {
  const { category = "All", limit = 20, mostLikedThisWeek = false } = options ?? {};
  return getCommunityFeedCached(category, limit, mostLikedThisWeek);
}

async function getPromptCommunityResultsUncached(promptId: string, limit = 12) {
  if (!isSupabaseServiceConfigured()) {
    return [] as CommunityPostView[];
  }

  const supabase = createServiceRoleClient();
  if (!supabase) return [] as CommunityPostView[];

  const { data: generations } = await supabase
    .from("generations")
    .select("id, generated_image_url, prompt_id")
    .eq("prompt_id", promptId)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit * 2);

  if (!generations || generations.length === 0) return [] as CommunityPostView[];

  const generationIds = generations.map((generation) => generation.id);
  const { data: posts } = await supabase
    .from("community_posts")
    .select("*")
    .in("generation_id", generationIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!posts || posts.length === 0) return [] as CommunityPostView[];

  const userIds = Array.from(new Set(posts.map((post) => post.user_id)));
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, avatar_url")
    .in("id", userIds);
  const { data: prompt } = await supabase
    .from("prompts")
    .select("id, title, category")
    .eq("id", promptId)
    .single();

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
        prompt_title: prompt.title,
        prompt_category: prompt.category,
        generated_image_url: generation.generated_image_url,
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
