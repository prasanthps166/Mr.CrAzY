import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { ensureUserProfile } from "@/lib/data";
import {
  ensureDefaultPromptCollection,
  listUserPromptCollections,
} from "@/lib/prompt-collections";
import { createServiceRoleClient } from "@/lib/supabase";

function parseLimit(value: string | null, fallback = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(200, Math.floor(numeric)));
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await ensureUserProfile(authUser);

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const promptId = params.get("promptId");
  const collectionId = params.get("collectionId");
  const limit = parseLimit(params.get("limit"));

  try {
    await ensureDefaultPromptCollection(supabase, authUser.id);
    const collections = await listUserPromptCollections(supabase, authUser.id);
    const collectionIds = collections.map((collection) => collection.id);

    if (promptId) {
      if (!collectionIds.length) {
        return NextResponse.json({
          promptId,
          isSaved: false,
          savedCollectionIds: [],
        });
      }

      const { data, error } = await supabase
        .from("prompt_collection_items")
        .select("collection_id")
        .eq("prompt_id", promptId)
        .in("collection_id", collectionIds);

      if (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
      }

      const savedCollectionIds = (data ?? []).map((row) => row.collection_id);
      return NextResponse.json({
        promptId,
        isSaved: savedCollectionIds.length > 0,
        savedCollectionIds,
      });
    }

    let targetCollectionIds = collectionIds;
    if (collectionId) {
      if (!collectionIds.includes(collectionId)) {
        return NextResponse.json({ message: "Collection not found" }, { status: 404 });
      }
      targetCollectionIds = [collectionId];
    }

    if (!targetCollectionIds.length) {
      return NextResponse.json({ items: [] });
    }

    const { data: itemRows, error: itemError } = await supabase
      .from("prompt_collection_items")
      .select("collection_id, prompt_id, created_at")
      .in("collection_id", targetCollectionIds)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (itemError) {
      return NextResponse.json({ message: itemError.message }, { status: 500 });
    }

    const promptIds = Array.from(new Set((itemRows ?? []).map((row) => row.prompt_id)));
    const { data: promptRows, error: promptError } = promptIds.length
      ? await supabase
          .from("prompts")
          .select("id, title, description, category, example_image_url, tags, use_count, created_at")
          .in("id", promptIds)
      : { data: [] as Array<Record<string, unknown>>, error: null };

    if (promptError) {
      return NextResponse.json({ message: promptError.message }, { status: 500 });
    }

    const promptMap = new Map((promptRows ?? []).map((prompt) => [prompt.id as string, prompt]));
    const collectionMap = new Map(collections.map((collection) => [collection.id, collection]));

    return NextResponse.json({
      items: (itemRows ?? [])
        .map((row) => {
          const prompt = promptMap.get(row.prompt_id);
          const collection = collectionMap.get(row.collection_id);
          if (!prompt || !collection) return null;
          return {
            collection_id: row.collection_id,
            prompt_id: row.prompt_id,
            created_at: row.created_at,
            collection: {
              id: collection.id,
              name: collection.name,
              is_default: collection.is_default,
            },
            prompt,
          };
        })
        .filter(Boolean),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load saved prompts" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await ensureUserProfile(authUser);

  const body = (await request.json().catch(() => ({}))) as {
    promptId?: string;
    collectionId?: string;
  };
  if (!body.promptId) {
    return NextResponse.json({ message: "promptId is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: prompt } = await supabase
    .from("prompts")
    .select("id")
    .eq("id", body.promptId)
    .maybeSingle();
  if (!prompt) {
    return NextResponse.json({ message: "Prompt not found" }, { status: 404 });
  }

  let targetCollectionId = body.collectionId ?? null;
  if (targetCollectionId) {
    const { data: ownedCollection } = await supabase
      .from("prompt_collections")
      .select("id")
      .eq("id", targetCollectionId)
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (!ownedCollection) {
      return NextResponse.json({ message: "Collection not found" }, { status: 404 });
    }
  } else {
    targetCollectionId = await ensureDefaultPromptCollection(supabase, authUser.id);
  }

  const { error } = await supabase
    .from("prompt_collection_items")
    .upsert(
      {
        collection_id: targetCollectionId,
        prompt_id: body.promptId,
      },
      { onConflict: "collection_id,prompt_id" },
    );

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, collectionId: targetCollectionId });
}

export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    promptId?: string;
    collectionId?: string;
  };
  if (!body.promptId) {
    return NextResponse.json({ message: "promptId is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  let collectionIds: string[] = [];
  if (body.collectionId) {
    const { data: ownedCollection } = await supabase
      .from("prompt_collections")
      .select("id")
      .eq("id", body.collectionId)
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (!ownedCollection) {
      return NextResponse.json({ message: "Collection not found" }, { status: 404 });
    }
    collectionIds = [ownedCollection.id];
  } else {
    const collections = await listUserPromptCollections(supabase, authUser.id);
    collectionIds = collections.map((collection) => collection.id);
  }

  if (!collectionIds.length) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("prompt_collection_items")
    .delete()
    .eq("prompt_id", body.promptId)
    .in("collection_id", collectionIds);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
