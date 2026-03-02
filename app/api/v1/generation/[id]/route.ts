import { NextRequest, NextResponse } from "next/server";

import { validateAndTrackApiKey } from "@/lib/api-keys";
import { createServiceRoleClient } from "@/lib/supabase";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const apiKey = request.headers.get("x-api-key");
  const keyAuth = await validateAndTrackApiKey(apiKey);
  if (!keyAuth.ok) {
    return NextResponse.json({ message: keyAuth.message }, { status: keyAuth.status });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: generation } = await supabase
    .from("generations")
    .select("id, user_id, prompt_id, generated_image_url, generated_image_url_clean, created_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!generation || generation.user_id !== keyAuth.userId) {
    return NextResponse.json({ message: "Generation not found" }, { status: 404 });
  }

  const outputUrl =
    generation.generated_image_url_clean?.trim() ||
    generation.generated_image_url?.trim() ||
    null;
  const status = outputUrl ? "complete" : "processing";

  return NextResponse.json({
    generation_id: generation.id,
    status,
    output_url: outputUrl,
    prompt_id: generation.prompt_id,
    created_at: generation.created_at,
  });
}
