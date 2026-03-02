import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { consumeCredit, ensureDailyCredits } from "@/lib/credits";
import { ensureUserProfile, getPromptById, getUserProfileById } from "@/lib/data";
import { sendGenerationReadyEmail } from "@/lib/email";
import { getRequestId, logError, logInfo, logWarn } from "@/lib/logging";
import { createImg2ImgPrediction, isReplicateConfigured, pollPrediction } from "@/lib/replicate";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient, getUserFromAccessToken } from "@/lib/supabase";
import { addWatermark } from "@/lib/watermark";

export const runtime = "nodejs";

function jsonWithRequestId(requestId: string, body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("x-request-id", requestId);
  return response;
}

async function uploadToStorage(
  bucket: "originals" | "generated",
  path: string,
  buffer: Buffer,
  contentType: string,
) {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Supabase service role key is missing");

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicData.publicUrl;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();

  if (!isReplicateConfigured()) {
    logWarn("generate.replicate_not_configured", {
      request_id: requestId,
    });
    return jsonWithRequestId(
      requestId,
      {
        message: "Replicate API is not configured",
      },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const authUser = await getUserFromAccessToken(token);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limiterKey = authUser?.id ?? `guest:${ip}`;
  const limit = await checkRateLimit(limiterKey, 10, 60_000);
  if (!limit.allowed) {
    logWarn("generate.rate_limited", {
      request_id: requestId,
      user_id: authUser?.id ?? null,
      backend: limit.backend,
      reset_at: limit.resetAt,
    });
    return jsonWithRequestId(
      requestId,
      {
        message: "Rate limit exceeded. Max 10 generations per minute.",
      },
      { status: 429 },
    );
  }

  logInfo("generate.request_started", {
    request_id: requestId,
    user_id: authUser?.id ?? null,
    backend: limit.backend,
  });

  const formData = await request.formData();
  const promptId = String(formData.get("promptId") ?? "");
  const strength = Number(formData.get("strength") ?? 0.7);
  const file = formData.get("file");

  if (!promptId) {
    return jsonWithRequestId(requestId, { message: "Prompt ID is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return jsonWithRequestId(requestId, { message: "Image file is required" }, { status: 400 });
  }
  if (Number.isNaN(strength) || strength < 0.4 || strength > 0.9) {
    return jsonWithRequestId(requestId, { message: "Strength must be between 0.4 and 0.9" }, { status: 400 });
  }

  const prompt = await getPromptById(promptId);
  if (!prompt) {
    return jsonWithRequestId(requestId, { message: "Prompt not found" }, { status: 404 });
  }

  await trackEvent({
    userId: authUser?.id ?? null,
    eventType: "generation_start",
    metadata: {
      prompt_id: promptId,
      strength,
    },
  });

  const guestUsed = request.cookies.get("guest_generation_used")?.value === "1";
  if (!authUser && guestUsed) {
    return jsonWithRequestId(
      requestId,
      {
        message: "Guest trial already used. Please sign up to continue.",
        requiresSignup: true,
      },
      { status: 401 },
    );
  }

  let isPro = false;
  let remainingCredits: number | null = null;
  let userForCreditDeduction: Awaited<ReturnType<typeof getUserProfileById>> = null;
  if (authUser) {
    await ensureUserProfile(authUser);
    const profile = await getUserProfileById(authUser.id);
    if (!profile) {
      return jsonWithRequestId(requestId, { message: "Unable to load user profile" }, { status: 500 });
    }
    if ((profile as { is_suspended?: boolean }).is_suspended) {
      return jsonWithRequestId(requestId, { message: "Account is suspended" }, { status: 403 });
    }

    const refreshed = await ensureDailyCredits(profile);
    if (!refreshed.is_pro && refreshed.credits <= 0) {
      return jsonWithRequestId(requestId, { message: "No credits left for today" }, { status: 402 });
    }

    userForCreditDeduction = refreshed;
    isPro = refreshed.is_pro;
    remainingCredits = refreshed.is_pro ? null : refreshed.credits;
  }

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const contentType = file.type || "image/jpeg";
    const basePrefix = authUser?.id ?? `guest-${ip.replace(/[^a-zA-Z0-9]/g, "")}`;
    const originalPath = `${basePrefix}/${Date.now()}-${randomUUID()}-original.${extension}`;

    const originalImageUrl = await uploadToStorage("originals", originalPath, inputBuffer, contentType);

    const prediction = await createImg2ImgPrediction({
      prompt: prompt.prompt_text,
      imageUrl: originalImageUrl,
      strength,
    });

    const outputUrl = await pollPrediction(prediction.id);
    const outputResponse = await fetch(outputUrl);
    if (!outputResponse.ok) {
      throw new Error("Failed to download generated image from Replicate");
    }
    const outputBuffer = Buffer.from(await outputResponse.arrayBuffer());

    const cleanPath = `${basePrefix}/${Date.now()}-${randomUUID()}-generated-clean.jpg`;
    const watermarkedPath = `${basePrefix}/${Date.now()}-${randomUUID()}-generated-watermarked.jpg`;

    const cleanImageUrl = await uploadToStorage("generated", cleanPath, outputBuffer, "image/jpeg");
    const watermarkedBuffer = await addWatermark(outputBuffer);
    const watermarkedImageUrl = await uploadToStorage(
      "generated",
      watermarkedPath,
      watermarkedBuffer,
      "image/jpeg",
    );
    const generatedImageUrl = authUser && isPro ? cleanImageUrl : watermarkedImageUrl;

    const supabase = createServiceRoleClient();
    if (!supabase) throw new Error("Supabase service role key is missing");

    const { data: generationData } = await supabase
      .from("generations")
      .insert({
        user_id: authUser?.id ?? null,
        prompt_id: prompt.id,
        original_image_url: originalImageUrl,
        generated_image_url: generatedImageUrl,
        generated_image_url_clean: cleanImageUrl,
        generated_image_url_watermarked: watermarkedImageUrl,
        is_public: false,
        watermarked: !(authUser && isPro),
      })
      .select("id")
      .single();
    const generationId = generationData?.id ?? null;

    await supabase.from("prompts").update({ use_count: prompt.use_count + 1 }).eq("id", prompt.id);
    if (authUser && userForCreditDeduction) {
      const consumption = await consumeCredit(userForCreditDeduction);
      if (consumption.ok) {
        isPro = consumption.user.is_pro;
        remainingCredits = consumption.user.is_pro ? null : consumption.user.credits;
      }
    }

    await trackEvent({
      userId: authUser?.id ?? null,
      eventType: "generation_complete",
      metadata: {
        prompt_id: prompt.id,
        generation_id: generationId,
        is_pro: isPro,
      },
    });

    const response = NextResponse.json({
      generatedImageUrl,
      cleanImageUrl,
      watermarkedImageUrl,
      generationId,
      remainingCredits,
      isPro,
    });
    response.headers.set("x-request-id", requestId);

    if (authUser?.email && Date.now() - startedAt > 30_000) {
      void sendGenerationReadyEmail(authUser.email, prompt.title, generatedImageUrl);
    }

    if (!authUser) {
      response.cookies.set({
        name: "guest_generation_used",
        value: "1",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    logInfo("generate.request_completed", {
      request_id: requestId,
      user_id: authUser?.id ?? null,
      generation_id: generationId,
      duration_ms: Date.now() - startedAt,
      backend: limit.backend,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    logError("generate.request_failed", error, {
      request_id: requestId,
      user_id: authUser?.id ?? null,
      duration_ms: Date.now() - startedAt,
      backend: limit.backend,
    });
    if (message.includes("status 402 Payment Required")) {
      return jsonWithRequestId(
        requestId,
        {
          message:
            "Replicate account has insufficient credits. Add billing credit in Replicate and try again.",
        },
        { status: 402 },
      );
    }

    return jsonWithRequestId(
      requestId,
      {
        message,
      },
      { status: 500 },
    );
  }
}
