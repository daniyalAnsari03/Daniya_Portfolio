import { Suspense } from "react";
import type { Metadata } from "next";
import CvManager from "@/components/admin/cv/CvManager";
import type {
  CvProfileData,
  CvSectionRow,
} from "@/components/admin/cv/shared";
import { getAdminCv } from "@/lib/cv";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const metadata: Metadata = {
  title: "CV",
};

async function CvContent() {
  // The guard runs BEFORE the read: the CV holds personal data (email,
  // phone), so it must never be read for a request that is not an
  // authorised admin — not even into a rendered shell.
  await requireAdmin();

  const { profile, sections } = await getAdminCv();

  const profileData: CvProfileData = {
    fullName: profile.fullName,
    headline: profile.headline,
    summary: profile.summary,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    website: profile.website,
    github: profile.github,
    linkedin: profile.linkedin,
    isPublished: profile.isPublished,
  };

  const sectionRows: CvSectionRow[] = sections.map((section) => ({
    id: section.id,
    title: section.title,
    entries: section.entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      subtitle: entry.subtitle,
      period: entry.period,
      description: entry.description,
    })),
  }));

  return <CvManager profile={profileData} sections={sectionRows} />;
}

function CvSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl" aria-hidden="true">
      <div className="h-8 w-24 animate-pulse rounded-lg bg-black/10" />
      <div className="mt-3 h-4 w-80 animate-pulse rounded bg-black/5" />
      <div className="mt-6 flex gap-2">
        {[0, 1].map((item) => (
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

export default function AdminCvPage() {
  return (
    <Suspense fallback={<CvSkeleton />}>
      <CvContent />
    </Suspense>
  );
}
