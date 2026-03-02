import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { getMarketplacePromptDetail } from "@/lib/marketplace";

type MarketplacePromptDetailRouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, { params }: MarketplacePromptDetailRouteContext) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const detail = await getMarketplacePromptDetail(params.id, authUser.id);
  if (!detail.prompt) {
    return NextResponse.json({ message: "Marketplace prompt not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
