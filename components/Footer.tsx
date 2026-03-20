import Link from "next/link";

const brandSignals = ["Creator Looks", "Community Proof", "One Upload"] as const;

export function Footer() {
  return (
    <footer className="px-4 pb-8 pt-3">
      <div className="brand-shell mx-auto flex max-w-7xl flex-col gap-5 rounded-[2rem] border border-border/70 px-5 py-6 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {brandSignals.map((item) => (
              <span
                key={item}
                className="brand-chip inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em]"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">PromptGallery</p>
            <p>Creator-built prompt looks for portraits, avatars, posters, and other polished photo transforms.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/gallery" className="rounded-full border border-border/65 bg-background/52 px-3 py-2 hover:text-foreground">
            Gallery
          </Link>
          <Link href="/community" className="rounded-full border border-border/65 bg-background/52 px-3 py-2 hover:text-foreground">
            Community
          </Link>
          <Link href="/marketplace" className="rounded-full border border-border/65 bg-background/52 px-3 py-2 hover:text-foreground">
            Marketplace
          </Link>
          <Link href="/api-access" className="rounded-full border border-border/65 bg-background/52 px-3 py-2 hover:text-foreground">
            API
          </Link>
          <Link href="/pricing" className="rounded-full border border-border/65 bg-background/52 px-3 py-2 hover:text-foreground">
            Pricing
          </Link>
        </div>
      </div>
    </footer>
  );
}
