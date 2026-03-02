import { NextRequest, NextResponse } from "next/server";

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

  const { data: profile, error } = await supabase
    .from("users")
    .select("id, email, full_name, avatar_url, credits, is_pro, is_suspended, referral_code")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ message: "User profile not found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}
