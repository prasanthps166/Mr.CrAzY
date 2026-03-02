import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { getPrompts } from "@/lib/data";

type PromptSort = "trending" | "newest" | "most_used";

function parseSort(value: string | null): PromptSort {
  if (value === "newest") return "newest";
  if (value === "most_used") return "most_used";
  return "trending";
}

function parseLimit(value: string | null, fallback = 24) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(60, Math.floor(numeric)));
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const category = params.get("category") ?? "All";
  const search = params.get("search") ?? "";
  const sort = parseSort(params.get("sort"));
  const featuredOnly = params.get("featuredOnly") === "true";
  const limit = parseLimit(params.get("limit"), 24);

  const prompts = await getPrompts({
    category,
    search,
    sort,
    featuredOnly,
    limit,
  });

  return NextResponse.json({ prompts });
}
