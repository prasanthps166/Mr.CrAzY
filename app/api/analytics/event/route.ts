import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { trackEvent } from "@/lib/analytics";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    event_type?: string;
    metadata?: Record<string, unknown>;
  };

  if (!body.event_type?.trim()) {
    return NextResponse.json({ message: "event_type is required" }, { status: 400 });
  }

  await trackEvent({
    userId: authUser.id,
    eventType: body.event_type.trim(),
    metadata: body.metadata ?? {},
  });

  return NextResponse.json({ ok: true });
}
