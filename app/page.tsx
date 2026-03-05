import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";

import { AdBanner } from "@/components/AdBanner";
import { CommunityGrid } from "@/components/CommunityGrid";
import { PromptCard } from "@/components/PromptCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FEATURED_EXAMPLES, PRICING } from "@/lib/constants";
import { getCommunityFeed, getPrompts, getRecommendedPrompts } from "@/lib/data";
import { getViewerUserId } from "@/lib/server-user";
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "AI Photo Prompt Gallery",
  description:
    "Transform photos with AI styles in seconds. Browse curated prompts, generate instantly, and share your results.",
  path: "/",
  keywords: ["AI image generator", "photo to AI art", "prompt gallery", "image transformation"],
});

export default async function HomePage() {
  const viewerUserId = await getViewerUserId();

  const [featuredPrompts, communityPreview, recommendedPrompts] = await Promise.all([
    getPrompts({ featuredOnly: true, limit: 6, sort: "trending" }),
    getCommunityFeed({ limit: 8 }),
    getRecommendedPrompts({ userId: viewerUserId, limit: 6 }),
  ]);
  const homeJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      potentialAction: {
        "@type": "SearchAction",
        target: `${absoluteUrl("/gallery")}?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      description: SITE_DESCRIPTION,
      url: absoluteUrl("/"),
      offers: {
        "@type": "Offer",
        price: "0.00",
        priceCurrency: "INR",
      },
    },
  ];
  const gallery = featuredPrompts.length
    ? featuredPrompts.map((item) => item.example_image_url)
    : FEATURED_EXAMPLES;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 py-12 sm:py-16">
      <JsonLd id="home-jsonld" value={homeJsonLd} />
      <section className="animate-fade-up grid items-center gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            AI-powered prompt marketplace
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Transform Your Photos with AI Magic
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            100+ AI styles. Upload your photo. Share instantly on WhatsApp.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/generate">
                Try Free - No Signup Needed
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/gallery">Browse Prompts</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/70 bg-card/40 p-3">
          {gallery.slice(0, 6).map((imageUrl, index) => (
            <div
              key={`${imageUrl}-${index}`}
              className="overflow-hidden rounded-xl border border-border/50 bg-background/40"
            >
              <div className="grid grid-cols-2">
                <div className="relative aspect-[3/4]">
                  <Image
                    src={imageUrl}
                    alt="Before transformation"
                    fill
                    className="object-cover grayscale"
                    sizes="(max-width: 1024px) 50vw, 300px"
                    priority={index === 0}
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-[#2d1d10]/65 px-2 py-0.5 text-[10px] text-amber-50">
                    Before
                  </span>
                </div>
                <div className="relative aspect-[3/4]">
                  <Image
                    src={imageUrl}
                    alt="After transformation"
                    fill
                    className="object-cover saturate-150 contrast-110"
                    sizes="(max-width: 1024px) 50vw, 300px"
                    priority={index === 0}
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] text-primary-foreground">
                    After
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="animate-fade-up-delay space-y-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight">How It Works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {["Browse a style", "Upload your photo", "Download your result"].map((step, index) => (
            <Card key={step} className="border-border/60 bg-card/70">
              <CardHeader>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Step {index + 1}</p>
                <CardTitle className="font-display text-xl">{step}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {index === 0 && "Explore curated prompts by category and discover trending styles."}
                  {index === 1 &&
                    "Drag and drop a photo, then tune strength to keep details or fully stylize."}
                  {index === 2 &&
                    "Get your generated image in seconds and share it with the community."}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl font-semibold tracking-tight">Trending Styles</h2>
          <Button variant="ghost" asChild>
            <Link href="/gallery">View all</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredPrompts.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      </section>

      {recommendedPrompts.length ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Recommended For You</h2>
            <Button variant="ghost" asChild>
              <Link href="/gallery">See more</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Personalized from your saved prompts, generations, and creators you follow.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedPrompts.map((prompt) => (
              <PromptCard key={prompt.id} prompt={prompt} />
            ))}
          </div>
        </section>
      ) : null}
      <section className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-card/70 p-6">
          <h2 className="font-display text-2xl font-semibold">Community Showcase</h2>
          <p className="mt-2 text-sm text-muted-foreground">Latest public transformations from creators.</p>
          <div className="mt-4">
            <CommunityGrid posts={communityPreview} enableLikes={false} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/40 bg-primary/10 p-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Download Android App</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Faster uploads, ad rewards, and push notifications in the mobile app.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" disabled>
            Get Android APK
          </Button>
          <Button type="button" variant="secondary" disabled>
            Google Play (Coming Soon)
          </Button>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Pricing</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="font-display text-2xl">{PRICING.free.name}</CardTitle>
              <p className="text-3xl font-bold">{PRICING.free.price}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {PRICING.free.features.map((feature) => (
                <p key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  {feature}
                </p>
              ))}
            </CardContent>
          </Card>

          <Card className="border-primary/40 bg-primary/10">
            <CardHeader>
              <CardTitle className="font-display text-2xl">{PRICING.pro.name}</CardTitle>
              <p className="text-3xl font-bold">{PRICING.pro.price}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {PRICING.pro.features.map((feature) => (
                <p key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  {feature}
                </p>
              ))}
              <Button className="mt-4" asChild>
                <Link href="/pricing">See Full Pricing</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <AdBanner placement="home_bottom" className="w-full" />
    </div>
  );
}
