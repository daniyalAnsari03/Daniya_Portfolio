import type { SkillCategory } from "@/lib/about";
import { content } from "@/lib/content";
import { Reveal } from "./Reveal";
import SkillsTabs from "./SkillsTabs";

/**
 * Light skills section. It starts on a straight flat edge right after the dark
 * services section (no rounded top corners). Hidden entirely when there are no
 * categories. Label, heading and tabs are centred; the heading reveals on
 * scroll, the tabs handle the sliding pill and the column stagger themselves.
 */
export default function Skills({
  categories,
}: {
  categories: SkillCategory[];
}) {
  if (categories.length === 0) return null;

  return (
    <section className="relative z-10 bg-background px-6 py-[calc(var(--vh-sm)*0.12)] sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-[1400px]">
        <Reveal distance={40} className="text-center">
          <p className="text-xs font-medium tracking-[0.18em] text-foreground/40 uppercase">
            {content.aboutPage.skills.label}
          </p>
          <h2 className="mx-auto mt-4 text-[clamp(30px,3vw,58px)] leading-[1.05] font-normal tracking-[-0.02em] text-foreground">
            {content.aboutPage.skills.heading}
          </h2>
        </Reveal>

        <SkillsTabs categories={categories} />
      </div>
    </section>
  );
}
