import { NextRequest, NextResponse } from "next/server";

import { ensureUserProfile } from "@/lib/data";
import { sendWelcomeEmail } from "@/lib/email";
import { createRouteSupabaseClient, createServiceRoleClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const referralCode = requestUrl.searchParams.get("ref");
  const redirectUrl = new URL(next, requestUrl.origin);
  const response = NextResponse.redirect(redirectUrl);

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createRouteSupabaseClient(request, response);
  if (!supabase) return NextResponse.redirect(new URL("/login", request.url));

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await ensureUserProfile(user);

    const serviceRole = createServiceRoleClient();
    if (serviceRole) {
      if (referralCode?.trim()) {
        await serviceRole.rpc("link_referral_code", {
          p_user_id: user.id,
          p_referral_code: referralCode.trim(),
        });
      }

      const { data: userRow } = await serviceRole
        .from("users")
        .select("email, full_name, welcome_email_sent_at")
        .eq("id", user.id)
        .maybeSingle();

      if (userRow?.email && !userRow.welcome_email_sent_at) {
        await sendWelcomeEmail(userRow.email, userRow.full_name);
        await serviceRole
          .from("users")
          .update({ welcome_email_sent_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    }
  }

  return response;
}
