import type { MetadataRoute } from "next";

import { getPrompts } from "@/lib/data";
import { getMarketplacePrompts } from "@/lib/marketplace";
import { absoluteUrl } from "@/lib/seo";

const PUBLIC_STATIC_ROUTES = ["/", "/gallery", "/community", "/generate", "/marketplace", "/pricing", "/api-access"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [prompts, marketplacePrompts] = await Promise.all([
    getPrompts({ sort: "newest", limit: 500 }),
    getMarketplacePrompts({ sort: "newest", limit: 500 }),
  ]);

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_STATIC_ROUTES.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
  }));

  const promptEntries: MetadataRoute.Sitemap = prompts.map((prompt) => ({
    url: absoluteUrl(`/gallery/${prompt.id}`),
    lastModified: new Date(prompt.created_at),
  }));

  const marketplaceEntries: MetadataRoute.Sitemap = marketplacePrompts.map((prompt) => ({
    url: absoluteUrl(`/marketplace/${prompt.id}`),
    lastModified: new Date(prompt.created_at),
  }));

  return [...staticEntries, ...promptEntries, ...marketplaceEntries];
}
