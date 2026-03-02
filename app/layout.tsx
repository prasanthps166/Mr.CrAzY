import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";

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
  title: "PromptGallery",
  description: "AI-powered image transformation app with curated prompts and community.",
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
            <Navbar />
            <main className="flex-1 pb-16 md:pb-0">{children}</main>
            <BottomNav />
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
