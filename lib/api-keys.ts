import crypto from "node:crypto";

import { createServiceRoleClient } from "@/lib/supabase";

type ApiKeyRow = {
  id: string;
  user_id: string;
  is_active: boolean;
  total_calls: number;
  monthly_limit: number;
};

export function hashApiKey(rawKey: string) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export function redactApiKey(rawKey: string) {
  if (rawKey.length <= 4) return rawKey;
  return `${"*".repeat(Math.max(0, rawKey.length - 4))}${rawKey.slice(-4)}`;
}

export async function validateAndTrackApiKey(rawKey: string | null | undefined) {
  if (!rawKey || rawKey.trim().length < 12) {
    return { ok: false as const, status: 401, message: "Invalid API key" };
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { ok: false as const, status: 500, message: "Supabase service role key is missing" };
  }

  const keyHash = hashApiKey(rawKey.trim());
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, user_id, is_active, total_calls, monthly_limit")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !data) {
    return { ok: false as const, status: 401, message: "Invalid API key" };
  }

  const keyRow = data as ApiKeyRow;
  if (!keyRow.is_active) {
    return { ok: false as const, status: 401, message: "API key is inactive" };
  }

  if (Number(keyRow.total_calls ?? 0) >= Number(keyRow.monthly_limit ?? 0)) {
    return { ok: false as const, status: 429, message: "Monthly API limit exceeded" };
  }

  await supabase
    .from("api_keys")
    .update({
      total_calls: Number(keyRow.total_calls ?? 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", keyRow.id);

  return {
    ok: true as const,
    keyId: keyRow.id,
    userId: keyRow.user_id,
    totalCalls: Number(keyRow.total_calls ?? 0) + 1,
    monthlyLimit: Number(keyRow.monthly_limit ?? 0),
  };
}
