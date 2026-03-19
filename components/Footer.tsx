import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/70 bg-background/65 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="font-medium text-foreground">PromptGallery</p>
          <p>Creator-built prompt looks for portraits, avatars, posters, and other polished photo transforms.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/gallery" className="hover:text-foreground">
            Gallery
          </Link>
          <Link href="/community" className="hover:text-foreground">
            Community
          </Link>
          <Link href="/marketplace" className="hover:text-foreground">
            Marketplace
          </Link>
          <Link href="/api-access" className="hover:text-foreground">
            API
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
        </div>
      </div>
    </footer>
  );
}
