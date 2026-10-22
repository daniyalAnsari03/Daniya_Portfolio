import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import { content } from "@/lib/content";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${content.name} — ${content.headline.line1} ${content.headline.line2}`,
  description: `${content.name}, ${content.headline.line1} ${content.headline.line2} — ${content.subtitle}.`,
};

/**
 * Mobile viewport. `width: device-width` + `initialScale: 1` keeps the
 * default zoom (pinch-zoom is never disabled) and `viewportFit: "cover"` lets
 * the fixed chrome use the device's safe-area insets (see `env(safe-area-
 * inset-bottom)` on the nav pill and the hero socials).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${interTight.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
