import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase";

type PromptPayload = {
  id?: string;
  title?: string;
  description?: string;
  prompt_text?: string;
  category?: string;
  example_image_url?: string;
  tags?: string[];
  is_featured?: boolean;
  use_count?: number;
};

function normalizePromptPayload(payload: PromptPayload) {
  return {
    title: payload.title?.trim() || "",
    description: payload.description?.trim() || "",
    prompt_text: payload.prompt_text?.trim() || "",
    category: payload.category?.trim() || "",
    example_image_url: payload.example_image_url?.trim() || "",
    tags: Array.isArray(payload.tags)
      ? payload.tags.map((tag) => tag.trim()).filter(Boolean)
      : [],
    is_featured: Boolean(payload.is_featured),
    use_count: Math.max(0, Number(payload.use_count ?? 0)),
  };
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data, error } = await supabase.from("prompts").select("*").order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ prompts: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as PromptPayload;
  const payload = normalizePromptPayload(body);

  if (!payload.title || !payload.description || !payload.prompt_text || !payload.category || !payload.example_image_url) {
    return NextResponse.json(
      { message: "title, description, prompt_text, category, and example_image_url are required" },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data, error } = await supabase.from("prompts").insert(payload).select("*").single();
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, prompt: data });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as PromptPayload;
  if (!body.id) {
    return NextResponse.json({ message: "id is required" }, { status: 400 });
  }

  const payload = normalizePromptPayload(body);

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("prompts")
    .update(payload)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, prompt: data });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const promptId = request.nextUrl.searchParams.get("id");
  if (!promptId) {
    return NextResponse.json({ message: "id query param is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { error } = await supabase.from("prompts").delete().eq("id", promptId);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
