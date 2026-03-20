import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck, Sparkles, TrendingUp, WalletCards, WandSparkles } from "lucide-react";

import { AdBanner } from "@/components/AdBanner";
import { CommunityPreviewGrid } from "@/components/CommunityPreviewGrid";
import { PromptCard } from "@/components/PromptCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { Button } from "@/components/ui/button";
import { FEATURED_EXAMPLES, PRICING } from "@/lib/constants";
import { getCommunityFeed, getPrompts } from "@/lib/data";
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl, buildMetadata } from "@/lib/seo";

const RecommendedPromptsSection = nextDynamic(
  () => import("@/components/RecommendedPromptsSection").then((module) => module.RecommendedPromptsSection),
  { ssr: false },
);

export const metadata: Metadata = buildMetadata({
  title: "Creator-Built Prompt Gallery",
  description:
    "Browse creator-built prompt looks, inspect real community proof, and run the right style on your own photo in one upload.",
  path: "/",
  keywords: ["creator-built prompts", "prompt gallery", "photo look generator", "image transformation"],
});

export const dynamic = "force-static";

const premiumPillars = [
  {
    title: "Curated looks",
    description: "Start from creator-built styles instead of an empty prompt box.",
    icon: Sparkles,
  },
  {
    title: "Fast workflow",
    description: "Pick a style, upload once, and get a polished result fast.",
    icon: WandSparkles,
  },
  {
    title: "Clean finish",
    description: "Try it free. Upgrade when you want watermark-free exports.",
    icon: ShieldCheck,
  },
] as const;

const workflowSteps = [
  {
    label: "Choose a look",
    description: "Browse portrait, anime, festival, and cinematic styles.",
  },
  {
    label: "Upload one photo",
    description: "Use one clear image and keep the details that matter.",
  },
  {
    label: "Download or share",
    description: "Download it or post it to the community.",
  },
] as const;

function formatCompactNumber(value: number) {
  if (value <= 0) return "0";
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function parseFirstInteger(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function parsePriceValue(value: string) {
  const numeric = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

export default async function HomePage() {
  const [featuredPrompts, topPrompts, communityPreview] = await Promise.all([
    getPrompts({ featuredOnly: true, limit: 6, sort: "trending" }),
    getPrompts({ limit: 8, sort: "most_used" }),
    getCommunityFeed({ limit: 6 }),
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

  const proofPrompts = (topPrompts.length ? topPrompts : featuredPrompts).slice(0, 6);
  const heroPrompt = featuredPrompts[0] ?? proofPrompts[0] ?? null;
  const spotlightPrompts = (featuredPrompts.length > 1 ? featuredPrompts : proofPrompts).slice(1, 3);
  const signaturePrompts = proofPrompts.length ? proofPrompts : featuredPrompts.slice(0, 6);
  const featuredCategories = Array.from(new Set(signaturePrompts.map((prompt) => prompt.category))).slice(0, 3);
  const communityLead = [...communityPreview].sort((left, right) => right.likes - left.likes)[0] ?? null;
  const fallbackCollage = FEATURED_EXAMPLES.slice(0, 3);
  const totalSignatureUses = signaturePrompts.reduce((sum, prompt) => sum + prompt.use_count, 0);
  const totalCommunityLikes = communityPreview.reduce((sum, post) => sum + post.likes, 0);
  const freeDailyCredits = parseFirstInteger(
    PRICING.free.features.find((feature) => feature.toLowerCase().includes("daily free credits")) ?? "",
  );
  const bestCreditPack = [...PRICING.credits]
    .map((pack) => ({ ...pack, priceValue: parsePriceValue(pack.price) }))
    .sort((left, right) => left.priceValue / left.credits - right.priceValue / right.credits)[0];
  const proofStats = [
    {
      label: "Most-used looks",
      value: `${formatCompactNumber(totalSignatureUses)}+`,
      detail: "Combined runs across the featured prompt set.",
      icon: TrendingUp,
    },
    {
      label: "Top prompt proof",
      value: heroPrompt ? `${formatCompactNumber(heroPrompt.use_count)} uses` : "Curated",
      detail: heroPrompt ? `${heroPrompt.title} is one of the most reused prompts.` : "The homepage starts from proven styles.",
      icon: Sparkles,
    },
    {
      label: "Community signal",
      value: totalCommunityLikes > 0 ? `${formatCompactNumber(totalCommunityLikes)} likes` : "Live examples",
      detail:
        totalCommunityLikes > 0
          ? "Across the community picks on this page."
          : "Real outputs sit next to the polished examples.",
      icon: WandSparkles,
    },
    {
      label: "Upgrade logic",
      value: freeDailyCredits > 0 ? `${freeDailyCredits} free daily` : PRICING.pro.price,
      detail: `${PRICING.pro.price} Pro matters when clean exports or repeat use matter.`,
      icon: WalletCards,
    },
  ] as const;
  const decisionSignals = [
    {
      eyebrow: "Most-used prompt",
      title: heroPrompt?.title ?? "Start from a proven look",
      description: heroPrompt
        ? `${heroPrompt.use_count} uses is a strong signal that the preview converts.`
        : "The lead card comes from the strongest prompt proof available.",
      href: heroPrompt ? `/gallery/${heroPrompt.id}` : "/gallery",
      cta: "Inspect the prompt",
    },
    {
      eyebrow: communityLead ? "Community proof" : "Real examples",
      title: communityLead ? `${communityLead.prompt_title} on real photos` : "Real outputs, not mockups",
      description: communityLead
        ? `${communityLead.username}'s post already has ${communityLead.likes} likes.`
        : "Use real outputs to judge the style quickly.",
      href: "/community",
      cta: "Browse the community",
    },
    {
      eyebrow: "Try first, pay later",
      title: `${freeDailyCredits || 2} daily credits before ${PRICING.pro.price} Pro`,
      description: bestCreditPack
        ? `${bestCreditPack.label} covers occasional use. Pro removes ads, watermarks, and export friction.`
        : "Validate the workflow first, then pay for cleaner exports or repeat use.",
      href: "/pricing",
      cta: "Compare plans",
    },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 sm:gap-14 sm:py-14">
      <JsonLd id="home-jsonld" value={homeJsonLd} />

      <section className="animate-fade-up grid gap-10 xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] xl:items-center">
        <div className="space-y-8">
          <div className="space-y-5">
            <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/75 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Creator-Built Prompt Looks
            </p>

            <div className="space-y-4">
              <h1 className="max-w-3xl font-display text-5xl font-semibold leading-none tracking-[-0.04em] sm:text-6xl lg:text-7xl">
                Start from a proven look, not a blank prompt.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                Browse creator-built prompt looks, inspect real results, and run the one that fits your photo in one upload.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="shadow-lg shadow-primary/20" asChild>
              <Link href="/generate">
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/gallery">Explore Gallery</Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {proofStats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div key={stat.label} className="brand-panel rounded-[1.5rem] border border-border/60 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    <span>{stat.label}</span>
                  </div>
                  <p className="mt-3 text-xl font-semibold tracking-[-0.02em] text-foreground">{stat.value}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{stat.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-x-10 top-6 h-24 rounded-full bg-primary/15 blur-3xl" />
          <div className="brand-shell relative rounded-[2rem] border border-[#3f2a18]/15 bg-[#1f150e] p-3 text-amber-50 shadow-[0_32px_100px_-45px_rgba(69,38,14,0.8)]">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
              <div className="relative overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#2a1c11]">
                <div className="relative aspect-[4/5]">
                  <Image
                    src={heroPrompt?.example_image_url ?? fallbackCollage[0]}
                    alt={heroPrompt?.title ?? "Featured transformation"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1280px) 100vw, 42vw"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#120d08]/90 via-[#120d081f] to-transparent" />
                </div>
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground">
                    Editor&apos;s Pick
                  </span>
                  {heroPrompt ? (
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-100">
                      {heroPrompt.category}
                    </span>
                  ) : null}
                </div>
                <div className="absolute inset-x-4 bottom-4 rounded-[1.4rem] border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-200/75">Featured Style</p>
                  <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">
                    {heroPrompt?.title ?? "Cinematic portrait finish"}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-amber-50/78">
                    {heroPrompt?.description ??
                      "A polished transformation with stronger mood, cleaner lighting, and a more premium final frame."}
                  </p>
                  {heroPrompt ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-amber-100/80">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        {heroPrompt.use_count} generations
                      </span>
                      <Link
                        href={`/gallery/${heroPrompt.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10"
                      >
                        View prompt
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3">
                {spotlightPrompts.map((prompt) => (
                  <Link
                    key={prompt.id}
                    href={`/gallery/${prompt.id}`}
                    className="group overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 transition hover:border-white/20 hover:bg-white/[0.08]"
                  >
                    <div className="grid grid-cols-[108px_minmax(0,1fr)] items-stretch">
                      <div className="relative min-h-[150px]">
                        <Image
                          src={prompt.example_image_url}
                          alt={prompt.title}
                          fill
                          className="object-cover transition duration-500 group-hover:scale-105"
                          sizes="160px"
                        />
                      </div>
                      <div className="flex flex-col justify-between p-4">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-200/70">
                            {prompt.category}
                          </p>
                          <h3 className="mt-2 font-display text-2xl leading-tight">{prompt.title}</h3>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-amber-50/70">{prompt.description}</p>
                        </div>
                        <p className="mt-3 text-xs text-amber-100/75">{prompt.use_count} uses and growing</p>
                      </div>
                    </div>
                  </Link>
                ))}

                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-200/70">
                    Why It Feels Better
                  </p>
                  <div className="mt-4 space-y-4">
                    {premiumPillars.map((item) => {
                      const Icon = item.icon;

                      return (
                        <div key={item.title} className="flex gap-3">
                          <div className="mt-0.5 rounded-full border border-white/10 bg-white/8 p-2">
                            <Icon className="h-4 w-4 text-amber-100" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-amber-50">{item.title}</p>
                            <p className="mt-1 text-sm leading-6 text-amber-50/68">{item.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="animate-fade-up-delay grid gap-4 md:grid-cols-3">
        {workflowSteps.map((step, index) => (
            <div
              key={step.label}
              className="brand-panel rounded-[1.75rem] border border-border/60 p-5"
            >
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Step 0{index + 1}
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold leading-tight">{step.label}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Decision Signals</p>
          <h2 className="font-display text-4xl font-semibold leading-none tracking-[-0.03em]">
            Real proof beats generic hype.
          </h2>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            We show reused prompts, community results, and clear pricing so you can judge the product fast.
          </p>
          <div className="rounded-[1.5rem] border border-border/60 bg-card/70 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Best known for</p>
            <p className="mt-3 text-sm font-semibold text-foreground">
              {featuredCategories.length ? featuredCategories.join(" / ") : "Portraits / Anime / Festival"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {decisionSignals.map((signal) => (
            <Link
              key={signal.eyebrow}
              href={signal.href}
              className="group rounded-[1.75rem] border border-border/60 bg-card/75 p-5 shadow-[0_20px_55px_-40px_rgba(42,29,18,0.72)] transition hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_28px_70px_-42px_rgba(82,49,22,0.72)]"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{signal.eyebrow}</p>
              <h3 className="mt-3 font-display text-2xl font-semibold leading-tight">{signal.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{signal.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-foreground transition-transform group-hover:translate-x-0.5">
                {signal.cta}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Signature Styles</p>
            <h2 className="font-display text-4xl font-semibold leading-none tracking-[-0.03em]">
              The most reused looks on the platform right now.
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              These are the looks people keep coming back to because the preview and first result usually line up.
            </p>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/gallery">See full gallery</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {signaturePrompts.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      </section>

      <RecommendedPromptsSection
        title="Recommended For You"
        description="Sign in to surface prompts closer to what you already save and generate."
        limit={4}
        linkHref="/gallery"
        linkLabel="See more"
        className="space-y-4"
      />

      <section className="relative overflow-hidden rounded-[2.25rem] border border-[#3d2918]/20 bg-[#21160d] px-5 py-6 text-amber-50 sm:px-7 sm:py-8">
        <div className="absolute left-[-10%] top-[-18%] h-40 w-40 rounded-full bg-primary/18 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] h-44 w-44 rounded-full bg-[#f6b36e]/12 blur-3xl" />
        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] xl:items-start">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-200/70">Community</p>
              <h2 className="font-display text-4xl font-semibold leading-none tracking-[-0.03em]">
                See how the styles hold up on real photos.
              </h2>
              <p className="max-w-xl text-base leading-7 text-amber-50/72">
                The quickest trust check is seeing what real people made with the prompt.
              </p>
            </div>

            {communityLead ? (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-200/70">
                  Popular In The Feed
                </p>
                <div className="mt-4 flex gap-4">
                  <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-[1rem] border border-white/10">
                    <Image
                      src={communityLead.generated_image_url}
                      alt={communityLead.prompt_title}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl leading-tight">{communityLead.prompt_title}</h3>
                    <p className="mt-2 text-sm leading-6 text-amber-50/72">
                      Shared by {communityLead.username} and already at {communityLead.likes} likes.
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-amber-200/68">
                      {communityLead.prompt_category}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/community">Explore Community</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/15 bg-transparent text-amber-50 hover:bg-white/10 hover:text-amber-50"
                asChild
              >
                <Link href="/generate">Create Yours</Link>
              </Button>
            </div>
          </div>

          <div>
            <CommunityPreviewGrid posts={communityPreview.slice(0, 4)} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 rounded-[2.25rem] border border-border/60 bg-card/65 px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Pricing</p>
            <h2 className="font-display text-4xl font-semibold leading-none tracking-[-0.03em]">
              Start free. Upgrade only when the output is already working.
            </h2>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              Free is enough to test the workflow. Pro is there once you want cleaner, faster, watermark-free exports.
            </p>
          </div>

          <div className="space-y-3">
            {[
              "Free credits let you test the workflow first.",
              "Pro removes ads, watermarks, and export friction.",
              "Upgrade when quality and frequency matter.",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-[1.25rem] border border-border/55 bg-background/60 p-3">
                <div className="rounded-full bg-primary/12 p-2 text-primary">
                  <Check className="h-4 w-4" />
                </div>
                <p className="text-sm leading-6 text-foreground">{item}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.35rem] border border-border/55 bg-background/60 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Try first</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{freeDailyCredits || 2} daily free credits</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Enough to test before paying.</p>
            </div>
            <div className="rounded-[1.35rem] border border-border/55 bg-background/60 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Occasional use</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {bestCreditPack ? bestCreditPack.label : "Flexible credit packs"}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Buy credits only when you need them.</p>
            </div>
            <div className="rounded-[1.35rem] border border-border/55 bg-background/60 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Frequent use</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{PRICING.pro.price} for cleaner output</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Watermark-free, ad-free, higher-quality exports.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.85rem] border border-border/60 bg-background/85 p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Free</p>
            <h3 className="mt-3 font-display text-3xl font-semibold">{PRICING.free.price}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{PRICING.free.description}</p>
            <div className="mt-5 space-y-3">
              {PRICING.free.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <Button className="mt-6 w-full" variant="outline" asChild>
              <Link href="/generate">Try Free</Link>
            </Button>
          </div>

          <div className="rounded-[1.85rem] border border-primary/30 bg-primary/8 p-6 shadow-[0_24px_60px_-36px_rgba(199,102,43,0.6)]">
            <p className="inline-flex rounded-full border border-primary/20 bg-primary/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
              Best Value
            </p>
            <h3 className="mt-3 font-display text-3xl font-semibold">{PRICING.pro.price}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{PRICING.pro.description}</p>
            <div className="mt-5 space-y-3">
              {PRICING.pro.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <Button className="mt-6 w-full" asChild>
              <Link href="/pricing">See Full Pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2.25rem] border border-primary/25 bg-[linear-gradient(135deg,rgba(199,102,43,0.12),rgba(255,244,228,0.9)_48%,rgba(255,218,182,0.5))] px-5 py-8 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Ready To Test It</p>
            <h2 className="font-display text-4xl font-semibold leading-none tracking-[-0.03em]">
              Start with one portrait. Keep the workflow if the result hits.
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              Try one portrait. Keep going if the first result is worth it.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/generate">
                Generate Your First Look
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">Compare Plans</Link>
            </Button>
          </div>
        </div>
      </section>

      <AdBanner placement="home_bottom" className="w-full" />
    </div>
  );
}
