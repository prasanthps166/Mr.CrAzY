import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase";

type UserAdminAction = "add_credits" | "toggle_pro" | "suspend";

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    user_id?: string;
    action?: UserAdminAction;
    amount?: number;
    is_pro?: boolean;
    is_suspended?: boolean;
  };

  if (!body.user_id || !body.action) {
    return NextResponse.json({ message: "user_id and action are required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("id, credits, is_pro, is_suspended")
    .eq("id", body.user_id)
    .maybeSingle();

  if (!userRow) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  if (body.action === "add_credits") {
    const amount = Number(body.amount ?? 0);
    if (Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ message: "amount must be greater than 0" }, { status: 400 });
    }

    const { error } = await supabase
      .from("users")
      .update({ credits: userRow.credits + Math.round(amount) })
      .eq("id", body.user_id);

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (body.action === "toggle_pro") {
    const nextPro = typeof body.is_pro === "boolean" ? body.is_pro : !userRow.is_pro;
    const { error } = await supabase
      .from("users")
      .update({ is_pro: nextPro })
      .eq("id", body.user_id);

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (body.action === "suspend") {
    const nextSuspended =
      typeof body.is_suspended === "boolean" ? body.is_suspended : !Boolean(userRow.is_suspended);

    const { error } = await supabase
      .from("users")
      .update({ is_suspended: nextSuspended })
      .eq("id", body.user_id);

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const { data: updatedUser } = await supabase
    .from("users")
    .select("id, credits, is_pro, is_suspended")
    .eq("id", body.user_id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    user: updatedUser,
  });
}
