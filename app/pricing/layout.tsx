import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Pricing Plans",
  description: "Compare PromptGallery plans, buy credit packs, and upgrade to Pro.",
  path: "/pricing",
  keywords: ["PromptGallery pricing", "AI credits", "Pro plan", "image generation plans"],
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
