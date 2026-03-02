import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { hashApiKey, redactApiKey } from "@/lib/api-keys";
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

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, is_active, total_calls, monthly_limit, created_at, last_used_at")
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    keys: (data ?? []).map((row) => ({
      ...row,
      key_preview: row.id ? redactApiKey(row.id.replace(/-/g, "")) : "****",
    })),
  });
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    monthly_limit?: number;
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ message: "name is required" }, { status: 400 });
  }

  const rawKey = `pg_live_${randomUUID().replace(/-/g, "")}${Date.now().toString(36)}`;
  const keyHash = hashApiKey(rawKey);
  const monthlyLimit = Math.max(100, Math.round(Number(body.monthly_limit ?? 500)));

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: authUser.id,
      key_hash: keyHash,
      name,
      monthly_limit: monthlyLimit,
      is_active: true,
    })
    .select("id, name, is_active, total_calls, monthly_limit, created_at, last_used_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ message: error?.message || "Failed to create API key" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    key: rawKey,
    record: {
      ...data,
      key_preview: redactApiKey(rawKey),
    },
  });
}

export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    key_id?: string;
  };
  if (!body.key_id) {
    return NextResponse.json({ message: "key_id is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", body.key_id)
    .eq("user_id", authUser.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
