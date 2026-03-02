import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";
import { SITE_DESCRIPTION, SITE_NAME, getBaseUrl } from "@/lib/seo";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${display.variable} font-sans`}>
        <Providers>
          <div className="relative flex min-h-screen flex-col bg-spotlight bg-grain">
            <a
              href="#main-content"
              className="sr-only fixed left-4 top-3 z-50 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow focus:not-sr-only"
            >
              Skip to main content
            </a>
            <Navbar />
            <main id="main-content" className="flex-1 pb-16 md:pb-0">
              {children}
            </main>
            <BottomNav />
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
