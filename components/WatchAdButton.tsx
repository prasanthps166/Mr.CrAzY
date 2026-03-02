"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase";

type WatchAdButtonProps = {
  label?: string;
  adType?: "rewarded_web" | "rewarded_mobile";
  onCredited?: (credits: number, grantedCredits: number) => void;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
};

export function WatchAdButton({
  label = "Watch Ad for 2 Credits",
  adType = "rewarded_web",
  onCredited,
  className,
  variant = "secondary",
  disabled = false,
}: WatchAdButtonProps) {
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  async function onWatch() {
    if (!supabase) {
      toast.error("Supabase auth is not configured");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      toast.error("Please login first");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/credits/watch-ad", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ad_type: adType,
          completion_token: `rewarded-${adType}-${Date.now()}`,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        credits?: number;
        grantedCredits?: number;
      };
      if (!response.ok) {
        throw new Error(payload.message || "Unable to grant ad credits");
      }

      const granted = Number(payload.grantedCredits ?? 2);
      const total = Number(payload.credits ?? 0);
      onCredited?.(total, granted);
      window.dispatchEvent(new Event("credits-updated"));
      toast.success(`+${granted} credits added`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to grant ad credits");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={onWatch} disabled={disabled || loading} variant={variant} className={className}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}
