import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { getPromptCommunityResults } from "@/lib/data";

type PromptCommunityRouteContext = {
  params: {
    id: string;
  };
};

function parseLimit(value: string | null, fallback = 12) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(30, Math.floor(numeric)));
}

export async function GET(request: NextRequest, { params }: PromptCommunityRouteContext) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"), 12);
  const results = await getPromptCommunityResults(params.id, limit);

  return NextResponse.json({ results });
}
