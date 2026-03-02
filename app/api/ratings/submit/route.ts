import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { trackEvent } from "@/lib/analytics";
import { createServiceRoleClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    marketplace_prompt_id?: string;
    rating?: number;
    review_text?: string;
  };

  if (!body.marketplace_prompt_id) {
    return NextResponse.json({ message: "marketplace_prompt_id is required" }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (Number.isNaN(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ message: "rating must be an integer between 1 and 5" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: purchase } = await supabase
    .from("prompt_purchases")
    .select("id")
    .eq("user_id", authUser.id)
    .eq("marketplace_prompt_id", body.marketplace_prompt_id)
    .maybeSingle();

  if (!purchase) {
    return NextResponse.json({ message: "You must purchase the prompt before leaving a review" }, { status: 403 });
  }

  const { error } = await supabase.from("prompt_ratings").upsert(
    {
      user_id: authUser.id,
      marketplace_prompt_id: body.marketplace_prompt_id,
      rating: Math.round(rating),
      review_text: body.review_text?.trim() || null,
    },
    {
      onConflict: "user_id,marketplace_prompt_id",
    },
  );

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const { data: updatedPrompt } = await supabase
    .from("marketplace_prompts")
    .select("rating_avg, rating_count")
    .eq("id", body.marketplace_prompt_id)
    .maybeSingle();

  await trackEvent({
    userId: authUser.id,
    eventType: "review_submitted",
    metadata: {
      marketplace_prompt_id: body.marketplace_prompt_id,
      rating: Math.round(rating),
    },
  });

  return NextResponse.json({
    ok: true,
    rating_avg: updatedPrompt?.rating_avg ?? 0,
    rating_count: updatedPrompt?.rating_count ?? 0,
  });
}
