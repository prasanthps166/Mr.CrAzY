import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase";

type CommunityCommentRouteContext = {
  params: {
    id: string;
  };
};

export async function DELETE(request: NextRequest, { params }: CommunityCommentRouteContext) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("community_comments")
    .delete()
    .eq("id", params.id)
    .eq("user_id", authUser.id)
    .select("id, post_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ message: "Comment not found" }, { status: 404 });
  }

  await trackEvent({
    userId: authUser.id,
    eventType: "community_comment_delete",
    metadata: {
      post_id: data.post_id,
      comment_id: data.id,
    },
  });

  return NextResponse.json({ ok: true });
}
