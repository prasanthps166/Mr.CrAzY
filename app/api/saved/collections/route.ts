import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { ensureUserProfile } from "@/lib/data";
import {
  ensureDefaultPromptCollection,
  getUserCollectionCounts,
  listUserPromptCollections,
  normalizeCollectionName,
} from "@/lib/prompt-collections";
import { createServiceRoleClient } from "@/lib/supabase";

function toCollectionResponse(
  collections: Awaited<ReturnType<typeof listUserPromptCollections>>,
  counts: Map<string, number>,
) {
  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    is_default: collection.is_default,
    created_at: collection.created_at,
    prompt_count: counts.get(collection.id) ?? 0,
  }));
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

  try {
    await ensureDefaultPromptCollection(supabase, authUser.id);
    const collections = await listUserPromptCollections(supabase, authUser.id);
    const counts = await getUserCollectionCounts(
      supabase,
      collections.map((collection) => collection.id),
    );

    return NextResponse.json({
      collections: toCollectionResponse(collections, counts),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load collections" },
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

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = normalizeCollectionName(body.name ?? "");

  if (!name) {
    return NextResponse.json({ message: "name is required" }, { status: 400 });
  }
  if (name.length > 60) {
    return NextResponse.json({ message: "Collection name must be 60 characters or fewer" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("prompt_collections")
    .insert({
      user_id: authUser.id,
      name,
      is_default: false,
    })
    .select("id, name, is_default, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ message: "A collection with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    collection: {
      id: data.id,
      name: data.name,
      is_default: data.is_default,
      created_at: data.created_at,
      prompt_count: 0,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await ensureUserProfile(authUser);

  const body = (await request.json().catch(() => ({}))) as {
    collectionId?: string;
    name?: string;
  };

  const collectionId = body.collectionId?.trim();
  const name = normalizeCollectionName(body.name ?? "");

  if (!collectionId) {
    return NextResponse.json({ message: "collectionId is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ message: "name is required" }, { status: 400 });
  }
  if (name.length > 60) {
    return NextResponse.json({ message: "Collection name must be 60 characters or fewer" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("prompt_collections")
    .select("id")
    .eq("id", collectionId)
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ message: existingError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ message: "Collection not found" }, { status: 404 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("prompt_collections")
    .update({ name })
    .eq("id", collectionId)
    .eq("user_id", authUser.id)
    .select("id, name, is_default, created_at")
    .single();

  if (updateError) {
    if (updateError.code === "23505") {
      return NextResponse.json({ message: "A collection with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }

  const counts = await getUserCollectionCounts(supabase, [collectionId]);

  return NextResponse.json({
    collection: {
      id: updated.id,
      name: updated.name,
      is_default: updated.is_default,
      created_at: updated.created_at,
      prompt_count: counts.get(collectionId) ?? 0,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { collectionId?: string };
  if (!body.collectionId) {
    return NextResponse.json({ message: "collectionId is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: collection, error: collectionError } = await supabase
    .from("prompt_collections")
    .select("id, is_default")
    .eq("id", body.collectionId)
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (collectionError) {
    return NextResponse.json({ message: collectionError.message }, { status: 500 });
  }
  if (!collection) {
    return NextResponse.json({ message: "Collection not found" }, { status: 404 });
  }
  if (collection.is_default) {
    return NextResponse.json({ message: "Default collection cannot be deleted" }, { status: 400 });
  }

  const { error } = await supabase
    .from("prompt_collections")
    .delete()
    .eq("id", body.collectionId)
    .eq("user_id", authUser.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
