import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { validateAndTrackApiKey } from "@/lib/api-keys";
import { createImg2ImgPrediction, isReplicateConfigured, pollPrediction } from "@/lib/replicate";
import { createServiceRoleClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const keyAuth = await validateAndTrackApiKey(apiKey);
  if (!keyAuth.ok) {
    return NextResponse.json({ message: keyAuth.message }, { status: keyAuth.status });
  }

  if (!isReplicateConfigured()) {
    return NextResponse.json({ message: "Replicate API is not configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    prompt_id?: string;
    image_url?: string;
    strength?: number;
  };

  const promptId = body.prompt_id?.trim();
  const imageUrl = body.image_url?.trim();
  const strength = Number(body.strength ?? 0.7);

  if (!promptId || !imageUrl) {
    return NextResponse.json({ message: "prompt_id and image_url are required" }, { status: 400 });
  }
  if (Number.isNaN(strength) || strength < 0.4 || strength > 0.9) {
    return NextResponse.json({ message: "strength must be between 0.4 and 0.9" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: curatedPrompt } = await supabase
    .from("prompts")
    .select("id, prompt_text")
    .eq("id", promptId)
    .maybeSingle();

  const { data: marketplacePrompt } = curatedPrompt
    ? { data: null }
    : await supabase
        .from("marketplace_prompts")
        .select("id, prompt_text, status")
        .eq("id", promptId)
        .eq("status", "approved")
        .maybeSingle();

  const promptText = curatedPrompt?.prompt_text ?? marketplacePrompt?.prompt_text ?? null;
  if (!promptText) {
    return NextResponse.json({ message: "Prompt not found" }, { status: 404 });
  }

  await trackEvent({
    userId: keyAuth.userId,
    eventType: "generation_start",
    metadata: {
      source: "api_v1",
      prompt_id: promptId,
      strength,
    },
  });

  try {
    const prediction = await createImg2ImgPrediction({
      prompt: promptText,
      imageUrl,
      strength,
    });

    const outputUrl = await pollPrediction(prediction.id);
    const { data: generationRow, error } = await supabase
      .from("generations")
      .insert({
        user_id: keyAuth.userId,
        prompt_id: promptId,
        original_image_url: imageUrl,
        generated_image_url: outputUrl,
        generated_image_url_clean: outputUrl,
        generated_image_url_watermarked: outputUrl,
        is_public: false,
        watermarked: false,
      })
      .select("id")
      .single();

    if (error || !generationRow) {
      return NextResponse.json({ message: error?.message || "Failed to save generation" }, { status: 500 });
    }

    await trackEvent({
      userId: keyAuth.userId,
      eventType: "generation_complete",
      metadata: {
        source: "api_v1",
        generation_id: generationRow.id,
        prompt_id: promptId,
      },
    });

    return NextResponse.json({
      generation_id: generationRow.id,
      status: "processing",
      webhook_url: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
