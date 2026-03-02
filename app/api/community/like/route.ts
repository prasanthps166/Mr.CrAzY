import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  const { postId } = (await request.json().catch(() => ({}))) as { postId?: string };
  if (!postId) {
    return NextResponse.json({ message: "postId is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: post } = await supabase
    .from("community_posts")
    .select("id, likes")
    .eq("id", postId)
    .single();
  if (!post) {
    return NextResponse.json({ message: "Post not found" }, { status: 404 });
  }

  const nextLikes = Number(post.likes ?? 0) + 1;
  const { data, error } = await supabase
    .from("community_posts")
    .update({ likes: nextLikes })
    .eq("id", postId)
    .select("likes")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await trackEvent({
    userId: authUser?.id ?? null,
    eventType: "community_like",
    metadata: {
      post_id: postId,
      likes: data.likes,
    },
  });

  return NextResponse.json({ likes: data.likes });
}
