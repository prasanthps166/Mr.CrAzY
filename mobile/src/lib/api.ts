import {
  CommunityComment,
  CommunityPost,
  GenerationHistoryItem,
  MarketplacePrompt,
  Profile,
  Prompt,
  PromptCollection,
} from "@/src/types";

const baseApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
  isFormData?: boolean;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function buildUrl(path: string) {
  if (!baseApiUrl) {
    throw new Error("EXPO_PUBLIC_API_URL is missing.");
  }
  if (path.startsWith("http")) return path;
  return `${baseApiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}) {
  const url = buildUrl(path);
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.isFormData) {
      body = options.body as FormData;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) {
    throw new ApiError(payload.message || `Request failed (${response.status})`, response.status);
  }

  return payload;
}

export async function getCredits(token: string) {
  return apiFetch<{
    credits: number;
    isPro: boolean;
    guest: boolean;
    dailyAdCredits?: number;
    dailyShareCredits?: number;
  }>("/api/credits", { token });
}

export async function getPrompts(
  token: string,
  options: {
    category?: string;
    search?: string;
    sort?: "trending" | "newest" | "most_used";
    tag?: string;
    featuredOnly?: boolean;
    limit?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (options.category) params.set("category", options.category);
  if (options.search) params.set("search", options.search);
  if (options.sort) params.set("sort", options.sort);
  if (options.tag) params.set("tag", options.tag);
  if (options.featuredOnly) params.set("featuredOnly", "true");
  if (typeof options.limit === "number") params.set("limit", String(options.limit));

  const query = params.toString();
  return apiFetch<{ prompts: Prompt[] }>(`/api/prompts${query ? `?${query}` : ""}`, { token });
}

export async function getPromptTags(
  token: string,
  options: {
    category?: string;
    search?: string;
    sort?: "trending" | "newest" | "most_used";
    tag?: string;
    limit?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (options.category) params.set("category", options.category);
  if (options.search) params.set("search", options.search);
  if (options.sort) params.set("sort", options.sort);
  if (options.tag) params.set("tag", options.tag);
  if (typeof options.limit === "number") params.set("limit", String(options.limit));
  const query = params.toString();

  return apiFetch<{ tags: Array<{ tag: string; count: number }>; sampleSize: number }>(`/api/prompts/tags${query ? `?${query}` : ""}`, { token });
}

export async function getPrompt(token: string, promptId: string) {
  return apiFetch<{ prompt: Prompt }>(`/api/prompts/${promptId}`, { token });
}

export async function getPromptCommunity(token: string, promptId: string, limit = 12) {
  return apiFetch<{ results: CommunityPost[] }>(`/api/prompts/${promptId}/community?limit=${limit}`, { token });
}

export async function generateImage(token: string, formData: FormData) {
  return apiFetch<{
    generatedImageUrl: string;
    generationId: string | null;
    remainingCredits: number | null;
    isPro: boolean;
  }>("/api/generate", {
    method: "POST",
    token,
    body: formData,
    isFormData: true,
  });
}

export async function shareGenerationToCommunity(token: string, generationId: string) {
  return apiFetch<{ ok: boolean }>("/api/community/share", {
    method: "POST",
    token,
    body: { generationId },
  });
}

export async function likeCommunityPost(token: string, postId: string) {
  return apiFetch<{ likes: number }>("/api/community/like", {
    method: "POST",
    token,
    body: { postId },
  });
}

export async function getCommunityFeed(
  token: string,
  options: {
    offset?: number;
    limit?: number;
    category?: string;
    sort?: "recent" | "top_week";
    scope?: "all" | "following";
  } = {},
) {
  const params = new URLSearchParams();
  if (typeof options.offset === "number") params.set("offset", String(options.offset));
  if (typeof options.limit === "number") params.set("limit", String(options.limit));
  if (options.category) params.set("category", options.category);
  if (options.sort) params.set("sort", options.sort);
  if (options.scope && options.scope !== "all") params.set("scope", options.scope);
  const query = params.toString();

  return apiFetch<{
    posts: CommunityPost[];
    hasMore: boolean;
    nextOffset: number;
  }>(`/api/community/feed${query ? `?${query}` : ""}`, { token });
}

export async function getCommunityPost(token: string, postId: string) {
  return apiFetch<{ post: CommunityPost }>(`/api/community/post/${postId}`, { token });
}

export async function getCommunityComments(token: string, postId: string, limit = 60) {
  return apiFetch<{ comments: CommunityComment[] }>(
    `/api/community/comments?postId=${encodeURIComponent(postId)}&limit=${limit}`,
    { token },
  );
}

export async function addCommunityComment(token: string, postId: string, commentText: string) {
  return apiFetch<{ comment: CommunityComment }>("/api/community/comments", {
    method: "POST",
    token,
    body: {
      postId,
      commentText,
    },
  });
}

export async function deleteCommunityComment(token: string, commentId: string) {
  return apiFetch<{ ok: boolean }>(`/api/community/comments/${encodeURIComponent(commentId)}`, {
    method: "DELETE",
    token,
  });
}

export async function getFollowingUserIds(token: string) {
  return apiFetch<{ followingUserIds: string[] }>("/api/community/follow", {
    token,
  });
}

export async function followUser(token: string, targetUserId: string) {
  return apiFetch<{ ok: boolean; following: boolean; targetUserId: string }>("/api/community/follow", {
    method: "POST",
    token,
    body: { targetUserId },
  });
}

export async function unfollowUser(token: string, targetUserId: string) {
  return apiFetch<{ ok: boolean; following: boolean; targetUserId: string }>("/api/community/follow", {
    method: "DELETE",
    token,
    body: { targetUserId },
  });
}

export async function getSavedPromptStatus(token: string, promptId: string) {
  return apiFetch<{ promptId: string; isSaved: boolean; savedCollectionIds: string[] }>(
    `/api/saved/prompts?promptId=${encodeURIComponent(promptId)}`,
    { token },
  );
}

export async function savePrompt(token: string, promptId: string, collectionId?: string | null) {
  return apiFetch<{ ok: boolean; collectionId: string }>("/api/saved/prompts", {
    method: "POST",
    token,
    body: {
      promptId,
      ...(collectionId ? { collectionId } : {}),
    },
  });
}

export async function unsavePrompt(token: string, promptId: string, collectionId?: string | null) {
  return apiFetch<{ ok: boolean }>("/api/saved/prompts", {
    method: "DELETE",
    token,
    body: {
      promptId,
      ...(collectionId ? { collectionId } : {}),
    },
  });
}

export async function getSavedCollections(token: string) {
  return apiFetch<{ collections: PromptCollection[] }>("/api/saved/collections", { token });
}

export async function getMyCommunityPosts(token: string, limit = 120) {
  return apiFetch<{ posts: Array<{ id: string; likes: number; created_at: string; generation_id: string }> }>(
    `/api/community/my-posts?limit=${limit}`,
    { token },
  );
}

export async function getProfile(token: string) {
  return apiFetch<{ profile: Profile }>("/api/profile/me", { token });
}

export async function getGenerationHistory(token: string, limit = 40) {
  return apiFetch<{ history: GenerationHistoryItem[] }>(`/api/generations/history?limit=${limit}`, { token });
}

export async function getMarketplacePrompts(
  token: string,
  options: {
    category?: string;
    price?: "all" | "free" | "under_50" | "under_100";
    rating?: number;
    sort?: "trending" | "newest" | "top_rated" | "best_selling";
    tab?: "all" | "free";
    limit?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (options.category) params.set("category", options.category);
  if (options.price) params.set("price", options.price);
  if (typeof options.rating === "number") params.set("rating", String(options.rating));
  if (options.sort) params.set("sort", options.sort);
  if (options.tab) params.set("tab", options.tab);
  if (typeof options.limit === "number") params.set("limit", String(options.limit));
  const query = params.toString();

  return apiFetch<{ prompts: MarketplacePrompt[] }>(`/api/marketplace/list${query ? `?${query}` : ""}`, { token });
}

export async function getMarketplacePromptDetail(token: string, promptId: string) {
  return apiFetch<{
    prompt: MarketplacePrompt;
    reviews: Array<{
      id: string;
      rating: number;
      review_text: string | null;
      created_at: string;
      user: { id: string; full_name: string | null; avatar_url: string | null } | null;
    }>;
    moreFromCreator: MarketplacePrompt[];
    hasPurchased: boolean;
  }>(`/api/marketplace/${promptId}`, { token });
}

export async function getMyPurchasedMarketplacePromptIds(token: string) {
  return apiFetch<{ prompts: MarketplacePrompt[]; promptIds: string[] }>("/api/marketplace/my-purchases", { token });
}

export async function purchaseMarketplacePrompt(
  token: string,
  marketplacePromptId: string,
  paymentMethodId?: string | null,
) {
  return apiFetch<{
    ok: boolean;
    alreadyPurchased?: boolean;
    purchased?: boolean;
    prompt_text?: string;
    amount_paid?: number;
    requiresPaymentMethod?: boolean;
    razorpayPaymentId?: string;
  }>("/api/marketplace/purchase", {
    method: "POST",
    token,
    body: {
      marketplace_prompt_id: marketplacePromptId,
      ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
    },
  });
}

export async function watchAdCredits(token: string, adType: "rewarded_web" | "rewarded_mobile" = "rewarded_mobile") {
  return apiFetch<{
    ok: boolean;
    credits: number;
    grantedCredits: number;
    dailyAdCredits: number;
  }>("/api/credits/watch-ad", {
    method: "POST",
    token,
    body: {
      ad_type: adType,
      completion_token: `mobile-reward-${Date.now()}`,
    },
  });
}

export async function claimShareCredit(token: string, generationId?: string | null) {
  return apiFetch<{
    ok: boolean;
    credits: number;
    grantedCredits: number;
    dailyShareCredits: number;
  }>("/api/credits/share", {
    method: "POST",
    token,
    body: {
      channel: "whatsapp",
      generation_id: generationId ?? null,
    },
  });
}
