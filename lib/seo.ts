import type { Metadata } from "next";

const DEFAULT_APP_URL = "http://localhost:3000";

export const SITE_NAME = "PromptGallery";
export const SITE_DESCRIPTION =
  "Creator-built prompt looks for portraits, avatars, and posters with gallery proof, community results, and one-upload generation.";

type BuildMetadataInput = {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  keywords?: string[];
  images?: Array<{
    url: string;
    alt?: string;
  }>;
};

export function getBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return DEFAULT_APP_URL;

  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

export function absoluteUrl(path: string) {
  return new URL(path, getBaseUrl()).toString();
}

export function buildMetadata({
  title,
  description,
  path,
  noIndex = false,
  keywords,
  images,
}: BuildMetadataInput): Metadata {
  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: path,
      images,
    },
    twitter: {
      card: images?.length ? "summary_large_image" : "summary",
      title,
      description,
      images: images?.map((item) => item.url),
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
        },
  };
}
