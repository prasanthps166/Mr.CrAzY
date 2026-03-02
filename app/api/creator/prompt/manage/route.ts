import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase";

async function getCreatorId(userId: string) {
  const supabase = createServiceRoleClient();
  if (!supabase) return null;
  const { data } = await supabase.from("creator_profiles").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

function toLegacyPrice(valueInr: number) {
  // Legacy schema may still enforce `price <= 19.99`; true INR value lives in `price_inr`.
  return Number(Math.min(valueInr, 19.99).toFixed(2));
}

export async function PUT(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const creatorId = await getCreatorId(authUser.id);
  if (!creatorId) {
    return NextResponse.json({ message: "Creator profile required" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    title?: string;
    description?: string;
    category?: string;
    prompt_text?: string;
    tags?: string[];
    is_free?: boolean;
    price?: number;
  };

  if (!body.id) {
    return NextResponse.json({ message: "id is required" }, { status: 400 });
  }

  const priceInr = typeof body.price === "number" ? Number(body.price.toFixed(2)) : undefined;
  if (typeof priceInr === "number" && (Number.isNaN(priceInr) || priceInr < 19 || priceInr > 499)) {
    return NextResponse.json({ message: "Paid prompts must be priced between Rs19 and Rs499" }, { status: 400 });
  }

  const isFree = typeof body.is_free === "boolean" ? body.is_free : undefined;

  const updatePayload = {
    title: body.title?.trim(),
    description: body.description?.trim(),
    category: body.category?.trim(),
    prompt_text: body.prompt_text?.trim(),
    tags: Array.isArray(body.tags) ? body.tags.map((tag) => tag.trim()).filter(Boolean) : undefined,
    is_free: isFree,
    price:
      isFree === true
        ? 0
        : typeof priceInr === "number"
          ? toLegacyPrice(priceInr)
          : undefined,
    price_inr:
      isFree === true
        ? 0
        : typeof priceInr === "number"
          ? priceInr
          : undefined,
  };

  const cleanedPayload = Object.fromEntries(Object.entries(updatePayload).filter(([, value]) => value !== undefined));

  if (!Object.keys(cleanedPayload).length) {
    return NextResponse.json({ message: "No fields to update" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("marketplace_prompts")
    .update(cleanedPayload)
    .eq("id", body.id)
    .eq("creator_id", creatorId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ message: "Prompt not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, prompt: updated });
}

export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const promptId = request.nextUrl.searchParams.get("id");
  if (!promptId) {
    return NextResponse.json({ message: "id query param is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const creatorId = await getCreatorId(authUser.id);
  if (!creatorId) {
    return NextResponse.json({ message: "Creator profile required" }, { status: 403 });
  }

  const { error } = await supabase
    .from("marketplace_prompts")
    .delete()
    .eq("id", promptId)
    .eq("creator_id", creatorId);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
