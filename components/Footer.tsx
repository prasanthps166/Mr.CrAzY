import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/70 bg-background/65 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>PromptGallery - AI-powered photo transformations.</p>
        <div className="flex items-center gap-4">
          <Link href="/gallery" className="hover:text-foreground">
            Gallery
          </Link>
          <Link href="/community" className="hover:text-foreground">
            Community
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
        </div>
      </div>
    </footer>
  );
}
