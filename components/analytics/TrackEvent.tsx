"use client";

import { useEffect, useMemo } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase";

type TrackEventProps = {
  eventType: string;
  metadata?: Record<string, unknown>;
};

export function TrackEvent({ eventType, metadata = {} }: TrackEventProps) {
  const serializedMetadata = JSON.stringify(metadata);
  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const parsedMetadata = JSON.parse(serializedMetadata) as Record<string, unknown>;

    async function sendEvent() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      await fetch("/api/analytics/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          event_type: eventType,
          metadata: parsedMetadata,
        }),
      });
    }

    void sendEvent();
  }, [eventType, serializedMetadata, supabase]);

  return null;
}
