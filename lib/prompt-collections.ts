import { createServiceRoleClient } from "@/lib/supabase";

type ServiceRoleClient = NonNullable<ReturnType<typeof createServiceRoleClient>>;

export type PromptCollectionSummary = {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
};

export function normalizeCollectionName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function listUserPromptCollections(supabase: ServiceRoleClient, userId: string) {
  const { data, error } = await supabase
    .from("prompt_collections")
    .select("id, user_id, name, is_default, created_at")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PromptCollectionSummary[];
}

export async function ensureDefaultPromptCollection(supabase: ServiceRoleClient, userId: string) {
  const existing = await listUserPromptCollections(supabase, userId);
  const currentDefault = existing.find((collection) => collection.is_default);
  if (currentDefault) return currentDefault.id;

  const favorites = existing.find(
    (collection) => collection.name.trim().toLowerCase() === "favorites",
  );
  if (favorites) {
    const { error } = await supabase
      .from("prompt_collections")
      .update({ is_default: true })
      .eq("id", favorites.id)
      .eq("user_id", userId);
    if (!error) return favorites.id;
  }

  const insertResult = await supabase
    .from("prompt_collections")
    .insert({
      user_id: userId,
      name: "Favorites",
      is_default: true,
    })
    .select("id")
    .single();

  if (insertResult.data?.id) {
    return insertResult.data.id as string;
  }

  // Another request may have created the row concurrently.
  const retry = await listUserPromptCollections(supabase, userId);
  const retryDefault = retry.find((collection) => collection.is_default) ?? retry[0];
  if (retryDefault) return retryDefault.id;

  throw new Error(insertResult.error?.message || "Failed to initialize default prompt collection");
}

export async function getUserCollectionCounts(
  supabase: ServiceRoleClient,
  collectionIds: string[],
) {
  if (!collectionIds.length) return new Map<string, number>();

  const { data, error } = await supabase
    .from("prompt_collection_items")
    .select("collection_id")
    .in("collection_id", collectionIds);

  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const current = counts.get(row.collection_id) ?? 0;
    counts.set(row.collection_id, current + 1);
  }
  return counts;
}
