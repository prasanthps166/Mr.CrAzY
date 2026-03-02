import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/auth-helpers";
import { sendCreatorReviewEmail } from "@/lib/email";
import { createServiceRoleClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    prompt_id?: string;
    action?: "approve" | "reject";
    reason?: string;
  };

  if (!body.prompt_id || !body.action) {
    return NextResponse.json({ message: "prompt_id and action are required" }, { status: 400 });
  }

  if (body.action === "reject" && !body.reason?.trim()) {
    return NextResponse.json({ message: "Rejection reason is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: promptRow } = await supabase
    .from("marketplace_prompts")
    .select("id, title, creator_id")
    .eq("id", body.prompt_id)
    .maybeSingle();

  if (!promptRow) {
    return NextResponse.json({ message: "Prompt not found" }, { status: 404 });
  }

  const nextStatus = body.action === "approve" ? "approved" : "rejected";

  const { error } = await supabase
    .from("marketplace_prompts")
    .update({
      status: nextStatus,
      rejection_reason: body.action === "reject" ? body.reason?.trim() || null : null,
    })
    .eq("id", body.prompt_id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("display_name, user_id")
    .eq("id", promptRow.creator_id)
    .maybeSingle();

  if (creatorProfile?.user_id) {
    const { data: creatorUser } = await supabase
      .from("users")
      .select("email")
      .eq("id", creatorProfile.user_id)
      .maybeSingle();

    if (creatorUser?.email) {
      await sendCreatorReviewEmail(creatorUser.email, {
        creatorName: creatorProfile.display_name,
        promptTitle: promptRow.title,
        status: nextStatus,
        reason: body.reason,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    status: nextStatus,
  });
}
