import { NextRequest, NextResponse } from "next/server";

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

  const { data: purchases, error } = await supabase
    .from("prompt_purchases")
    .select("marketplace_prompt_id")
    .eq("user_id", authUser.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const promptIds = Array.from(new Set((purchases ?? []).map((purchase) => purchase.marketplace_prompt_id)));
  if (!promptIds.length) {
    return NextResponse.json({ prompts: [], promptIds: [] });
  }

  const { data: prompts } = await supabase
    .from("marketplace_prompts")
    .select("*")
    .in("id", promptIds)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    prompts: prompts ?? [],
    promptIds,
  });
}
