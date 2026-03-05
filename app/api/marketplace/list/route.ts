import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import {
  MarketplacePriceFilter,
  MarketplaceSort,
  getMarketplacePrompts,
} from "@/lib/marketplace";

function parsePrice(value: string | null): MarketplacePriceFilter {
  if (value === "free" || value === "under_50" || value === "under_100") return value;
  return "all";
}

function parseSort(value: string | null): MarketplaceSort {
  if (value === "newest" || value === "top_rated" || value === "best_selling") return value;
  return "trending";
}

function parseTab(value: string | null): "all" | "free" {
  return value === "free" ? "free" : "all";
}

function parseLimit(value: string | null): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 48;
  return Math.max(1, Math.min(100, Math.floor(numeric)));
}

function parseCategory(value: string | null) {
  const normalized = value?.trim();
  return normalized || "All";
}

function parseSearch(value: string | null) {
  return value?.trim() ?? "";
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const category = parseCategory(params.get("category"));
  const price = parsePrice(params.get("price"));
  const rating = Number(params.get("rating") ?? "0");
  const minRating = Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : 0;
  const sort = parseSort(params.get("sort"));
  const tab = parseTab(params.get("tab"));
  const limit = parseLimit(params.get("limit"));
  const search = parseSearch(params.get("search"));

  const prompts = await getMarketplacePrompts({
    category,
    price,
    minRating,
    sort,
    tab,
    limit,
    search,
  });

  return NextResponse.json({ prompts });
}