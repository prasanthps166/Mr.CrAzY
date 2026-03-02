import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase";

function parseLimit(value: string | null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 60;
  return Math.max(1, Math.min(200, Math.floor(numeric)));
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

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

  const { data: posts, error } = await supabase
    .from("community_posts")
    .select("id, likes, created_at, generation_id")
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    posts: posts ?? [],
  });
}
