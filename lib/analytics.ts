import { createServiceRoleClient } from "@/lib/supabase";

type TrackEventInput = {
  userId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
};

export async function trackEvent({ userId = null, eventType, metadata = {} }: TrackEventInput) {
  const supabase = createServiceRoleClient();
  if (!supabase) return;

  try {
    await supabase.from("analytics_events").insert({
      user_id: userId,
      event_type: eventType,
      metadata,
    });
  } catch {
    // Analytics should not break product flows.
  }
}
