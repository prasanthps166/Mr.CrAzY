import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { getGenerationHistory } from "@/lib/data";

function parseLimit(value: string | null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 40;
  return Math.max(1, Math.min(120, Math.floor(numeric)));
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const history = await getGenerationHistory(authUser.id, limit);

  return NextResponse.json({ history });
}
