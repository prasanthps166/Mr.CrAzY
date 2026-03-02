import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { createServiceRoleClient, getUserFromAccessToken } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const authUser = await getUserFromAccessToken(token);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { generationId } = (await request.json().catch(() => ({}))) as {
    generationId?: string;
  };
  if (!generationId) {
    return NextResponse.json({ message: "generationId is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: generation } = await supabase
    .from("generations")
    .select("id, user_id")
    .eq("id", generationId)
    .single();

  if (!generation || generation.user_id !== authUser.id) {
    return NextResponse.json({ message: "Generation not found" }, { status: 404 });
  }

  await supabase.from("generations").update({ is_public: true }).eq("id", generationId);
  const { error } = await supabase
    .from("community_posts")
    .upsert(
      {
        generation_id: generationId,
        user_id: authUser.id,
      },
      { onConflict: "generation_id" },
    )
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await trackEvent({
    userId: authUser.id,
    eventType: "community_post",
    metadata: {
      generation_id: generationId,
    },
  });

  return NextResponse.json({ ok: true });
}
