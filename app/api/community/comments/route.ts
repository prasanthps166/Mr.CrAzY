import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { ensureUserProfile } from "@/lib/data";
import { createServiceRoleClient } from "@/lib/supabase";

function parseLimit(value: string | null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 40;
  return Math.max(1, Math.min(120, Math.floor(numeric)));
}

export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get("postId");
  if (!postId) {
    return NextResponse.json({ message: "postId is required" }, { status: 400 });
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const authUser = await getAuthUserFromRequest(request);

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: commentRows, error: commentError } = await supabase
    .from("community_comments")
    .select("id, post_id, user_id, comment_text, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (commentError) {
    return NextResponse.json({ message: commentError.message }, { status: 500 });
  }

  const userIds = Array.from(new Set((commentRows ?? []).map((comment) => comment.user_id)));
  const { data: users, error: userError } = userIds.length
    ? await supabase.from("users").select("id, full_name, avatar_url").in("id", userIds)
    : { data: [] as Array<{ id: string; full_name: string | null; avatar_url: string | null }>, error: null };

  if (userError) {
    return NextResponse.json({ message: userError.message }, { status: 500 });
  }

  const userMap = new Map((users ?? []).map((user) => [user.id, user]));

  return NextResponse.json({
    comments: (commentRows ?? []).map((comment) => {
      const user = userMap.get(comment.user_id);
      return {
        id: comment.id,
        post_id: comment.post_id,
        user_id: comment.user_id,
        comment_text: comment.comment_text,
        created_at: comment.created_at,
        username: user?.full_name ?? "Anonymous",
        user_avatar_url: user?.avatar_url ?? null,
        is_owner: Boolean(authUser?.id && authUser.id === comment.user_id),
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await ensureUserProfile(authUser);

  const body = (await request.json().catch(() => ({}))) as {
    postId?: string;
    commentText?: string;
  };

  const postId = body.postId?.trim();
  const commentText = body.commentText?.trim();
  if (!postId) {
    return NextResponse.json({ message: "postId is required" }, { status: 400 });
  }
  if (!commentText) {
    return NextResponse.json({ message: "commentText is required" }, { status: 400 });
  }
  if (commentText.length > 500) {
    return NextResponse.json({ message: "Comment must be 500 characters or fewer" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: post } = await supabase
    .from("community_posts")
    .select("id")
    .eq("id", postId)
    .maybeSingle();

  if (!post) {
    return NextResponse.json({ message: "Post not found" }, { status: 404 });
  }

  const { data: inserted, error } = await supabase
    .from("community_comments")
    .insert({
      post_id: postId,
      user_id: authUser.id,
      comment_text: commentText,
    })
    .select("id, post_id, user_id, comment_text, created_at")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ message: error?.message || "Failed to add comment" }, { status: 500 });
  }

  const { data: user } = await supabase
    .from("users")
    .select("full_name, avatar_url")
    .eq("id", authUser.id)
    .maybeSingle();

  await trackEvent({
    userId: authUser.id,
    eventType: "community_comment",
    metadata: {
      post_id: postId,
      comment_id: inserted.id,
    },
  });

  return NextResponse.json({
    comment: {
      ...inserted,
      username: user?.full_name ?? "Anonymous",
      user_avatar_url: user?.avatar_url ?? null,
      is_owner: true,
    },
  });
}
