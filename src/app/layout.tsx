import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import { getPublicSettings } from "@/lib/settings";
import {
  SITE_DESCRIPTION,
  SITE_JOB_TITLE,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    absolute: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

/**
 * A sameAs URL must point at a specific profile. A bare domain
 * (`https://github.com/` with no path) says nothing about the person.
 */
function hasProfilePath(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.pathname.replace(/\/+$/, "")) return true;
    return Boolean(parsed.search || parsed.hash);
  } catch {
    return false;
  }
}

/** Person JSON-LD, built at request time from the public settings socials. */
async function PersonJsonLd() {
  const settings = await getPublicSettings();

  const sameAs = settings.socials
    // GitHub / LinkedIn only; skip empty or invalid links entirely.
    .filter(
      (social) =>
        /^(github|linkedin)$/i.test(social.name) && /^https?:\/\//i.test(social.url),
    )
    .map((social) => social.url)
    // A bare domain with no profile path is not a useful sameAs value.
    .filter(hasProfilePath);

  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: SITE_NAME,
    jobTitle: SITE_JOB_TITLE,
    url: SITE_URL,
    address: {
      "@type": "PostalAddress",
      addressCountry: "PK",
    },
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };

  return (
    <script
      type="application/ld+json"
      // Safe JSON embedding: escape "<" so "</script>" can never appear.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replaceAll("<", "\\u003c") }}
    />
  );
}

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
        <SmoothScroll>
          <PersonJsonLd />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
