import { NextRequest } from "next/server";

import { getUserFromAccessToken } from "@/lib/supabase";

export function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export async function getAuthUserFromRequest(request: NextRequest) {
  const token = getBearerToken(request);
  return getUserFromAccessToken(token);
}

export async function isAdminRequest(request: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return false;

  const user = await getAuthUserFromRequest(request);
  if (!user?.email) return false;

  return user.email.toLowerCase() === adminEmail;
}
