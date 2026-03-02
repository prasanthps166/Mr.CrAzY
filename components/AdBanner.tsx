"use client";

import { useEffect } from "react";
import Script from "next/script";

type AdBannerProps = {
  slot?: string;
  placement?: string;
  className?: string;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdBanner({
  slot = "0000000000",
  placement = "banner",
  className,
}: AdBannerProps) {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();
  const isConfigured = Boolean(clientId);

  useEffect(() => {
    if (!isConfigured) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Do not interrupt UX when ad scripts are blocked.
    }
  }, [isConfigured]);

  if (!isConfigured) {
    return (
      <div
        className={`rounded-xl border border-dashed border-border/60 bg-card/50 px-4 py-3 text-center text-xs text-muted-foreground ${className ?? ""}`}
      >
        Ad placement: {placement}
      </div>
    );
  }

  return (
    <div className={className}>
      <Script
        id={`adsense-${placement}`}
        async
        strategy="afterInteractive"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
        crossOrigin="anonymous"
      />
      <ins
        className="adsbygoogle block min-h-[90px] w-full overflow-hidden rounded-xl border border-border/60"
        style={{ display: "block" }}
        data-ad-client={clientId}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
