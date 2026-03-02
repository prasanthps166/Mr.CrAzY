import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { sendAdminPromptSubmittedEmail } from "@/lib/email";
import { createServiceRoleClient } from "@/lib/supabase";

async function uploadImage(
  path: string,
  file: File,
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "image/jpeg";

  const { error } = await supabase.storage.from("marketplace-examples").upload(path, buffer, {
    contentType,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("marketplace-examples").getPublicUrl(path);
  return data.publicUrl;
}

function parseTags(input: string | null) {
  if (!input) return [] as string[];
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function parseBoolean(input: string | null) {
  return input === "true" || input === "1";
}

function toLegacyPrice(valueInr: number) {
  // Legacy schema may still enforce `price <= 19.99`; true INR value lives in `price_inr`.
  return Number(Math.min(valueInr, 19.99).toFixed(2));
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const [{ data: userRow }, { data: creatorProfile }] = await Promise.all([
    supabase.from("users").select("id, is_suspended").eq("id", authUser.id).maybeSingle(),
    supabase.from("creator_profiles").select("*").eq("user_id", authUser.id).maybeSingle(),
  ]);

  if (!userRow || userRow.is_suspended) {
    return NextResponse.json({ message: "Account is suspended" }, { status: 403 });
  }

  if (!creatorProfile) {
    return NextResponse.json({ message: "Creator profile required" }, { status: 403 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const promptText = String(formData.get("prompt_text") ?? "").trim();
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const isFree = parseBoolean(String(formData.get("is_free") ?? "false"));
  const rawPrice = Number(formData.get("price") ?? 0);

  if (!title || !description || !category || !promptText) {
    return NextResponse.json(
      { message: "title, description, category, and prompt_text are required" },
      { status: 400 },
    );
  }

  const coverImage = formData.get("cover_image");
  if (!(coverImage instanceof File)) {
    return NextResponse.json({ message: "cover_image is required" }, { status: 400 });
  }

  const extraFiles = formData
    .getAll("example_images")
    .filter((file): file is File => file instanceof File)
    .slice(0, 4);

  if (extraFiles.length > 4) {
    return NextResponse.json({ message: "Maximum 4 additional example images are allowed" }, { status: 400 });
  }

  const price = isFree ? 0 : Number(rawPrice.toFixed(2));
  if (!isFree && (Number.isNaN(price) || price < 19 || price > 499)) {
    return NextResponse.json({ message: "Paid prompts must be priced between Rs19 and Rs499" }, { status: 400 });
  }

  const legacyPrice = isFree ? 0 : toLegacyPrice(price);

  try {
    const coverExt = coverImage.name.split(".").pop()?.toLowerCase() || "jpg";
    const coverPath = `${authUser.id}/${Date.now()}-${randomUUID()}-cover.${coverExt}`;
    const coverImageUrl = await uploadImage(coverPath, coverImage, supabase);

    const exampleImageUrls: string[] = [];
    for (const file of extraFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${authUser.id}/${Date.now()}-${randomUUID()}-example.${ext}`;
      const imageUrl = await uploadImage(path, file, supabase);
      exampleImageUrls.push(imageUrl);
    }

    const { data: insertedPrompt, error } = await supabase
      .from("marketplace_prompts")
      .insert({
        creator_id: creatorProfile.id,
        title,
        description,
        prompt_text: promptText,
        category,
        cover_image_url: coverImageUrl,
        example_images: exampleImageUrls,
        price: legacyPrice,
        price_inr: price,
        is_free: isFree,
        tags,
        status: "pending_review",
      })
      .select("id")
      .single();

    if (error || !insertedPrompt) {
      return NextResponse.json({ message: error?.message || "Failed to submit prompt" }, { status: 500 });
    }

    await trackEvent({
      userId: authUser.id,
      eventType: "prompt_submit",
      metadata: {
        marketplace_prompt_id: insertedPrompt.id,
        category,
        is_free: isFree,
        price_inr: price,
      },
    });

    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    if (adminEmail) {
      await sendAdminPromptSubmittedEmail(adminEmail, {
        creatorName: creatorProfile.display_name,
        promptTitle: title,
        category,
      });
    }

    return NextResponse.json({
      ok: true,
      id: insertedPrompt.id,
      status: "pending_review",
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to submit prompt" },
      { status: 500 },
    );
  }
}
