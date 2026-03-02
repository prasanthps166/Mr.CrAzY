"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase";

type WhatsAppShareButtonProps = {
  shareText: string;
  shareUrl?: string | null;
  generationId?: string | null;
  className?: string;
  trackCredits?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
};

export function WhatsAppShareButton({
  shareText,
  shareUrl,
  generationId = null,
  className,
  trackCredits = true,
  variant = "outline",
}: WhatsAppShareButtonProps) {
  const [sharing, setSharing] = useState(false);
  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  async function onShare() {
    setSharing(true);
    try {
      const message = `${shareText}${shareUrl ? ` ${shareUrl}` : ""}`;
      const target = `https://wa.me/?text=${encodeURIComponent(message)}`;

      if (trackCredits && supabase) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          await fetch("/api/credits/share", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              channel: "whatsapp",
              generation_id: generationId,
            }),
          }).catch(() => null);
          window.dispatchEvent(new Event("credits-updated"));
        }
      }

      window.open(target, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Unable to open WhatsApp share");
    } finally {
      setSharing(false);
    }
  }

  return (
    <Button
      onClick={onShare}
      disabled={sharing}
      variant={variant}
      className={`bg-[#25D366] text-white hover:bg-[#20b458] hover:text-white ${className ?? ""}`}
    >
      <MessageCircle className="mr-2 h-4 w-4" />
      Share to WhatsApp
    </Button>
  );
}
