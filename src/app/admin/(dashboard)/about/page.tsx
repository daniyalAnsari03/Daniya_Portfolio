import { Suspense } from "react";
import type { Metadata } from "next";
import AboutManager from "@/components/admin/about/AboutManager";
import type {
  AboutHeroCardRow,
  AboutIntroData,
  EducationRow,
  ServiceRow,
  SkillCategoryRow,
} from "@/components/admin/about/shared";
import {
  getAdminAboutHeroCards,
  getAdminAboutIntro,
  getAdminEducation,
  getAdminServices,
  getAdminSkillCategories,
} from "@/lib/about";

export const metadata: Metadata = {
  title: "About",
};

async function AboutContent() {
  const [heroCards, intro, services, categories, education] = await Promise.all([
    getAdminAboutHeroCards(),
    getAdminAboutIntro(),
    getAdminServices(),
    getAdminSkillCategories(),
    getAdminEducation(),
  ]);

  const heroCardRows: AboutHeroCardRow[] = heroCards.map((card) => ({
    id: card.id,
    mediaType: card.mediaType,
    fileUrl: card.fileUrl,
    coverAdjust: card.coverAdjust,
  }));

  const introData: AboutIntroData = {
    heroHeading: intro.heroHeading,
    heroSubtitle: intro.heroSubtitle,
    statementHeading: intro.statementHeading,
    paragraph: intro.paragraph,
    photoUrl: intro.photoUrl,
    location: intro.location,
    email: intro.email,
    phone: intro.phone,
  };

  const serviceRows: ServiceRow[] = services.map((service) => ({
    id: service.id,
    title: service.title,
    description: service.description,
  }));

  const categoryRows: SkillCategoryRow[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    skills: category.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      iconUrl: skill.iconUrl,
    })),
  }));

  const educationRows: EducationRow[] = education.map((item) => ({
    id: item.id,
    degree: item.degree,
    school: item.school,
    year: item.year,
  }));

  return (
    <AboutManager
      heroCards={heroCardRows}
      intro={introData}
      services={serviceRows}
      categories={categoryRows}
      education={educationRows}
    />
  );
}

function AboutSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl" aria-hidden="true">
      <div className="h-8 w-32 animate-pulse rounded-lg bg-black/10" />
      <div className="mt-3 h-4 w-80 animate-pulse rounded bg-black/5" />
      <div className="mt-6 flex gap-2">
        {[0, 1, 2, 3, 4].map((item) => (
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

export default function AdminAboutPage() {
  return (
    <Suspense fallback={<AboutSkeleton />}>
      <AboutContent />
    </Suspense>
  );
}
