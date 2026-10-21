"use client";

import { useState } from "react";
import HeroSection from "./HeroSection";
import IntroSection from "./IntroSection";
import ServicesSection from "./ServicesSection";
import SkillsSection from "./SkillsSection";
import EducationSection from "./EducationSection";
import type {
  AboutHeroCardRow,
  AboutIntroData,
  EducationRow,
  ServiceRow,
  SkillCategoryRow,
} from "./shared";

type TabId = "hero" | "intro" | "services" | "skills" | "education";

const TABS: { id: TabId; label: string }[] = [
  { id: "hero", label: "Hero" },
  { id: "intro", label: "Intro" },
  { id: "services", label: "Services" },
  { id: "skills", label: "Skills" },
  { id: "education", label: "Education" },
];

export default function AboutManager({
  heroCards,
  intro,
  services,
  categories,
  education,
}: {
  heroCards: AboutHeroCardRow[];
  intro: AboutIntroData;
  services: ServiceRow[];
  categories: SkillCategoryRow[];
  education: EducationRow[];
}) {
  const [active, setActive] = useState<TabId>("hero");

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-medium tracking-[-0.03em]">About</h1>
      <p className="mt-2 text-sm text-black/50">
        Everything shown on the About page: hero, intro, services, skills and
        education.
      </p>

      <div
        role="tablist"
        aria-label="About sections"
        className="mt-6 -mx-1 flex gap-1 overflow-x-auto pb-1"
      >
        {TABS.map((tab) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`about-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`about-panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "bg-charcoal text-white"
                  : "text-black/55 hover:bg-black/5"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 space-y-6">
        <div
          role="tabpanel"
          id="about-panel-hero"
          aria-labelledby="about-tab-hero"
          hidden={active !== "hero"}
        >
          <HeroSection cards={heroCards} />
        </div>

        <div
          role="tabpanel"
          id="about-panel-intro"
          aria-labelledby="about-tab-intro"
          hidden={active !== "intro"}
        >
          <IntroSection intro={intro} />
        </div>

        <div
          role="tabpanel"
          id="about-panel-services"
          aria-labelledby="about-tab-services"
          hidden={active !== "services"}
        >
          <ServicesSection services={services} />
        </div>

        <div
          role="tabpanel"
          id="about-panel-skills"
          aria-labelledby="about-tab-skills"
          hidden={active !== "skills"}
        >
          <SkillsSection categories={categories} />
        </div>

        <div
          role="tabpanel"
          id="about-panel-education"
          aria-labelledby="about-tab-education"
          hidden={active !== "education"}
        >
          <EducationSection education={education} />
        </div>
      </div>
    </div>
  );
}
