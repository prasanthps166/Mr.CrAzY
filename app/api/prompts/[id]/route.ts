import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { getPromptById } from "@/lib/data";

type PromptDetailRouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, { params }: PromptDetailRouteContext) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const prompt = await getPromptById(params.id);
  if (!prompt) {
    return NextResponse.json({ message: "Prompt not found" }, { status: 404 });
  }

  return NextResponse.json({ prompt });
}
