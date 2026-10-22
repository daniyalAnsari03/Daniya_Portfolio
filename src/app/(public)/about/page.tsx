import type { Metadata } from "next";
import Contact from "@/components/Contact";
import AboutHero from "@/components/about/AboutHero";
import AboutIntro from "@/components/about/AboutIntro";
import Education from "@/components/about/Education";
import Services from "@/components/about/Services";
import Skills from "@/components/about/Skills";
import {
  getAboutHeroCards,
  getAboutIntro,
  getEducation,
  getServices,
  getSkillCategories,
} from "@/lib/about";
import { content } from "@/lib/content";

export const metadata: Metadata = {
  title: content.aboutPage.meta.title,
  description: content.aboutPage.meta.description,
};

export default async function AboutPage() {
  const [heroCards, intro, services, categories, education] = await Promise.all(
    [
      getAboutHeroCards(),
      getAboutIntro(),
      getServices(),
      getSkillCategories(),
      getEducation(),
    ],
  );

  return (
    <main className="relative w-full overflow-x-clip">
      {/* Opaque content layer that slides up over the fixed contact screen. */}
      <div className="relative z-10 rounded-b-[16px] bg-background sm:rounded-b-[24px]">
        <AboutHero
          heading={intro.heroHeading}
          subtitle={intro.heroSubtitle}
          cards={heroCards}
        />
        <AboutIntro intro={intro} />
        <Services services={services} />
        <Skills categories={categories} />
        <Education items={education} />
      </div>

      {/* Same fixed contact screen + 100vh reveal spacer as the homepage. */}
      <Contact />
    </main>
  );
}
