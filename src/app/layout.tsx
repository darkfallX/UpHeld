import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare } from "geist/font/pixel";
import { GeistSans } from "geist/font/sans";
import "lenis/dist/lenis.css";
import "./globals.css";
import { Providers } from "@/components/layout/providers";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "UpHeld · Uptime, Upheld on Base",
  description:
    "USDC subscriptions on Base with an uptime guarantee. When a service misses its SLA, subscribers are refunded from the provider's reserve.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>
          <SiteHeader />
          <main className="min-h-[calc(100dvh-56px)]">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
