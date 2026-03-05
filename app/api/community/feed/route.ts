import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { getCommunityFeedPage } from "@/lib/community-feed-page";

function parseCategory(value: string | null) {
  const normalized = value?.trim();
  return normalized || "All";
}

function parseInteger(value: string | null, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const limit = parseInteger(params.get("limit"), 24, 1, 60);
  const offset = parseInteger(params.get("offset"), 0, 0, 50_000);
  const category = parseCategory(params.get("category"));
  const search = params.get("search") ?? "";
  const sortParam = params.get("sort");
  const sort =
    sortParam === "top_week" ? "top_week" : sortParam === "most_liked" ? "most_liked" : "recent";
  const scope = params.get("scope") === "following" ? "following" : "all";

  const authUser = await getAuthUserFromRequest(request);
  if (scope === "following" && !authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const result = await getCommunityFeedPage({
    limit,
    offset,
    category,
    scope,
    sort,
    search,
    viewerUserId: authUser?.id ?? null,
  });

  return NextResponse.json(result);
}
