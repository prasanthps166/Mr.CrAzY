import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/auth-helpers";
import { sendWeeklyCreatorDigestEmail } from "@/lib/email";
import { createServiceRoleClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: creators } = await supabase
    .from("creator_profiles")
    .select("id, user_id, display_name")
    .order("created_at", { ascending: false });

  const creatorIds = (creators ?? []).map((creator) => creator.id);
  if (!creatorIds.length) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const { data: promptRows } = await supabase
    .from("marketplace_prompts")
    .select("id, creator_id, title")
    .in("creator_id", creatorIds);

  const promptIds = (promptRows ?? []).map((prompt) => prompt.id);
  const { data: purchaseRows } = promptIds.length
    ? await supabase
        .from("prompt_purchases")
        .select("marketplace_prompt_id")
        .in("marketplace_prompt_id", promptIds)
        .gte("created_at", since)
    : { data: [] as Array<{ marketplace_prompt_id: string }> };

  const { data: users } = await supabase
    .from("users")
    .select("id, email")
    .in(
      "id",
      Array.from(new Set((creators ?? []).map((creator) => creator.user_id))),
    );

  const userMap = new Map((users ?? []).map((user) => [user.id, user]));
  const promptMap = new Map((promptRows ?? []).map((prompt) => [prompt.id, prompt]));

  const salesByPrompt = new Map<string, number>();
  for (const purchase of purchaseRows ?? []) {
    salesByPrompt.set(
      purchase.marketplace_prompt_id,
      (salesByPrompt.get(purchase.marketplace_prompt_id) ?? 0) + 1,
    );
  }

  let sent = 0;
  for (const creator of creators ?? []) {
    const user = userMap.get(creator.user_id);
    if (!user?.email) continue;

    const highlights = (promptRows ?? [])
      .filter((prompt) => prompt.creator_id === creator.id)
      .map((prompt) => ({
        title: prompt.title,
        sales: salesByPrompt.get(prompt.id) ?? 0,
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    await sendWeeklyCreatorDigestEmail(user.email, {
      creatorName: creator.display_name,
      highlights,
    });
    sent += 1;
  }

  return NextResponse.json({ ok: true, sent });
}
