import dynamic from "next/dynamic";
import Link from "next/link";
import { Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import { primaryNavItems, secondaryNavItems } from "@/components/navbar/config";

const NavbarClientShell = dynamic(
  () => import("@/components/navbar/NavbarClientShell").then((module) => module.NavbarClientShell),
  {
    ssr: false,
    loading: () => (
      <>
        <div className="hidden items-center gap-2 md:flex">
          <div className="h-8 w-20 rounded-full border border-border/60 bg-background/70" />
          <div className="h-10 w-10 rounded-full border border-border/60 bg-background/70" />
          <Button asChild>
            <Link href="/generate">Generate</Link>
          </Button>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <div className="h-10 w-10 rounded-full border border-border/60 bg-background/70" />
          <div className="h-10 w-10 rounded-full border border-border/60 bg-background/70" />
        </div>
      </>
    ),
  },
);

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="brand-shell mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-4 rounded-[1.75rem] border border-border/70 px-4 py-3 backdrop-blur-xl sm:px-5">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
            <div className="rounded-[1rem] border border-primary/25 bg-primary/12 p-2.5 shadow-[0_18px_35px_-24px_hsl(var(--primary)/0.95)]">
              <Camera className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span>PromptGallery</span>
              <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground lg:block">
                Creator-Built Prompt Looks
              </span>
            </div>
          </Link>

          <nav aria-label="Primary navigation" className="hidden items-center gap-3 md:flex">
            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/55 px-2 py-1 shadow-[0_12px_28px_-24px_hsl(var(--foreground)/0.55)]">
              {primaryNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-background/78 hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/45 px-2 py-1">
              {secondaryNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-background/72 hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <NavbarClientShell />
      </div>
    </header>
  );
}
