import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { getCommunityFeedPage } from "@/lib/community-feed-page";
import { createRouteTimer, getRequestId } from "@/lib/logging";

function parseCategory(value: string | null) {
  const normalized = value?.trim();
  return normalized || "All";
}

function parseInteger(value: string | null, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

function jsonWithRequestId(requestId: string, body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const params = request.nextUrl.searchParams;
  const limit = parseInteger(params.get("limit"), 24, 1, 60);
  const offset = parseInteger(params.get("offset"), 0, 0, 50_000);
  const category = parseCategory(params.get("category"));
  const search = params.get("search") ?? "";
  const sortParam = params.get("sort");
  const sort =
    sortParam === "top_week" ? "top_week" : sortParam === "most_liked" ? "most_liked" : "recent";
  const scope = params.get("scope") === "following" ? "following" : "all";
  const timer = createRouteTimer("community_feed", {
    request_id: requestId,
    category,
    limit,
    offset,
    scope,
    sort,
    search_present: search.trim().length > 0,
  });

  try {
    const authUser = await getAuthUserFromRequest(request);
    if (scope === "following" && !authUser) {
      timer.finish({
        status_code: 401,
        viewer_user_id: null,
        post_count: 0,
      });
      return jsonWithRequestId(requestId, { message: "Unauthorized" }, { status: 401 });
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

    timer.finish({
      status_code: 200,
      viewer_user_id: authUser?.id ?? null,
      post_count: result.posts.length,
      has_more: result.hasMore,
      next_offset: result.nextOffset,
    });

    return jsonWithRequestId(requestId, result);
  } catch (error) {
    timer.fail(error);
    return jsonWithRequestId(requestId, { message: "Failed to load community feed" }, { status: 500 });
  }
}
