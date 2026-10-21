import { Suspense } from "react";
import type { Metadata } from "next";
import HomepageManager from "@/components/admin/homepage/HomepageManager";
import type {
  HomepageCardRow,
  HomepageContentData,
} from "@/components/admin/homepage/shared";
import { getAdminHomepage } from "@/lib/homepage";

export const metadata: Metadata = {
  title: "Homepage",
};

async function HomepageContent() {
  const { content, cards } = await getAdminHomepage();

  const contentData: HomepageContentData = {
    heroLine1: content.hero.line1,
    heroLine2: content.hero.line2,
    heroSubtitle: content.hero.subtitle,
    coverLabel: content.cover.label,
    coverHeading1: content.cover.heading1,
    coverHeading2: content.cover.heading2,
    reelLabel: content.cover.reelLabel,
    reelVideoUrl: content.cover.reelVideoUrl,
    worksHeading: content.works.heading,
    contactLine1: content.contact.line1,
    contactLine2: content.contact.line2,
    contactAccentWord: content.contact.accentWord,
  };

  const cardRows: HomepageCardRow[] = cards.map((card) => ({
    id: card.id,
    imageUrl: card.src,
    coverAdjust: card.adjust,
    visible: card.visible,
  }));

  return <HomepageManager content={contentData} cards={cardRows} />;
}

function HomepageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl" aria-hidden="true">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-black/10" />
      <div className="mt-3 h-4 w-80 animate-pulse rounded bg-black/5" />
      <div className="mt-6 flex gap-2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-9 w-24 animate-pulse rounded-lg bg-black/10"
          />
        ))}
      </div>
      <div className="mt-6 h-96 animate-pulse rounded-2xl border border-black/10 bg-white" />
    </div>
  );
}

export default function AdminHomepagePage() {
  return (
    <Suspense fallback={<HomepageSkeleton />}>
      <HomepageContent />
    </Suspense>
  );
}
