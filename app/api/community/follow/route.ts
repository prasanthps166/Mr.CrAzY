import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", authUser.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    followingUserIds: (data ?? []).map((row) => row.following_id),
  });
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { targetUserId?: string };
  const targetUserId = body.targetUserId?.trim();
  if (!targetUserId) {
    return NextResponse.json({ message: "targetUserId is required" }, { status: 400 });
  }
  if (targetUserId === authUser.id) {
    return NextResponse.json({ message: "You cannot follow yourself" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: targetUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!targetUser) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("user_follows")
    .upsert(
      {
        follower_id: authUser.id,
        following_id: targetUserId,
      },
      { onConflict: "follower_id,following_id" },
    );

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await trackEvent({
    userId: authUser.id,
    eventType: "community_follow",
    metadata: {
      target_user_id: targetUserId,
    },
  });

  return NextResponse.json({ ok: true, following: true, targetUserId });
}

export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { targetUserId?: string };
  const targetUserId = body.targetUserId?.trim();
  if (!targetUserId) {
    return NextResponse.json({ message: "targetUserId is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", authUser.id)
    .eq("following_id", targetUserId);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await trackEvent({
    userId: authUser.id,
    eventType: "community_unfollow",
    metadata: {
      target_user_id: targetUserId,
    },
  });

  return NextResponse.json({ ok: true, following: false, targetUserId });
}
