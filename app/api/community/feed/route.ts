import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase";

function parseInteger(value: string | null, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const limit = parseInteger(params.get("limit"), 20, 1, 60);
  const offset = parseInteger(params.get("offset"), 0, 0, 5000);
  const category = params.get("category") ?? "All";
  const sort = params.get("sort") === "top_week" ? "top_week" : "recent";
  const scope = params.get("scope") === "following" ? "following" : "all";

  let query = supabase.from("community_posts").select("*");

  if (scope === "following") {
    const { data: followRows, error: followError } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", authUser.id);

    if (followError) {
      return NextResponse.json({ message: followError.message }, { status: 500 });
    }

    const followingUserIds = Array.from(
      new Set((followRows ?? []).map((row) => row.following_id).filter(Boolean)),
    );
    if (!followingUserIds.length) {
      return NextResponse.json({
        posts: [],
        hasMore: false,
        nextOffset: offset,
      });
    }

    query = query.in("user_id", followingUserIds);
  }

  if (sort === "top_week") {
    const lowerBound = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    query = query
      .gte("created_at", lowerBound)
      .order("likes", { ascending: false })
      .order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: postRows, error: postError } = await query.range(offset, offset + limit - 1);
  if (postError) {
    return NextResponse.json({ message: postError.message }, { status: 500 });
  }

  if (!postRows?.length) {
    return NextResponse.json({
      posts: [],
      hasMore: false,
      nextOffset: offset,
    });
  }

  const generationIds = Array.from(new Set(postRows.map((post) => post.generation_id)));
  const userIds = Array.from(new Set(postRows.map((post) => post.user_id)));

  const [{ data: generationRows }, { data: userRows }] = await Promise.all([
    supabase.from("generations").select("id, generated_image_url, prompt_id").in("id", generationIds),
    supabase.from("users").select("id, full_name, avatar_url").in("id", userIds),
  ]);

  const promptIds = Array.from(new Set((generationRows ?? []).map((generation) => generation.prompt_id)));
  const { data: promptRows } = promptIds.length
    ? await supabase.from("prompts").select("id, title, category").in("id", promptIds)
    : { data: [] as Array<{ id: string; title: string; category: string }> };

  const generationMap = new Map((generationRows ?? []).map((generation) => [generation.id, generation]));
  const promptMap = new Map((promptRows ?? []).map((prompt) => [prompt.id, prompt]));
  const userMap = new Map((userRows ?? []).map((user) => [user.id, user]));

  let posts = postRows
    .map((post) => {
      const generation = generationMap.get(post.generation_id);
      const prompt = generation ? promptMap.get(generation.prompt_id) : null;
      const user = userMap.get(post.user_id);
      if (!generation || !prompt || !user) return null;

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
      };
    })
    .filter(Boolean);

  if (category !== "All") {
    posts = posts.filter((post) => post?.prompt_category === category);
  }

  return NextResponse.json({
    posts,
    hasMore: postRows.length === limit,
    nextOffset: offset + postRows.length,
  });
}
