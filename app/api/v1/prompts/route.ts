import { NextRequest, NextResponse } from "next/server";

import { validateAndTrackApiKey } from "@/lib/api-keys";
import { createServiceRoleClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const keyAuth = await validateAndTrackApiKey(apiKey);
  if (!keyAuth.ok) {
    return NextResponse.json({ message: keyAuth.message }, { status: keyAuth.status });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const [{ data: curated }, { data: marketplace }] = await Promise.all([
    supabase.from("prompts").select("id, title, category").order("use_count", { ascending: false }),
    supabase
      .from("marketplace_prompts")
      .select("id, title, category, status")
      .eq("status", "approved")
      .order("purchase_count", { ascending: false }),
  ]);

  const prompts = [
    ...(curated ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      source: "curated" as const,
    })),
    ...(marketplace ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      source: "marketplace" as const,
    })),
  ];

  return NextResponse.json({ prompts });
}
