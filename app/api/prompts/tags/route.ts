import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { getPrompts } from "@/lib/data";
import { buildPromptTagCloud } from "@/lib/prompt-tags";

type PromptSort = "trending" | "newest" | "most_used";

function parseSort(value: string | null): PromptSort {
  if (value === "newest") return "newest";
  if (value === "most_used") return "most_used";
  return "trending";
}

function parseCategory(value: string | null) {
  const normalized = value?.trim();
  return normalized || "All";
}

function parseLimit(value: string | null, fallback = 12) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(30, Math.floor(numeric)));
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const category = parseCategory(params.get("category"));
  const search = params.get("search") ?? "";
  const sort = parseSort(params.get("sort"));
  const tag = params.get("tag") ?? "";
  const limit = parseLimit(params.get("limit"), 12);

  const prompts = await getPrompts({
    category,
    search,
    sort,
    tag,
    limit: 180,
  });

  const tags = buildPromptTagCloud(prompts, limit);
  return NextResponse.json({ tags, sampleSize: prompts.length });
}