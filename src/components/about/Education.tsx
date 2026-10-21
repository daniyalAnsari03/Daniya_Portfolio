import type { EducationItem } from "@/lib/about";
import { content } from "@/lib/content";
import { about } from "@/lib/motion";
import { LineDraw, Reveal } from "./Reveal";

/* Thin top rule: transparent at both ends, darkest in the middle. */
const LINE_GRADIENT =
  "linear-gradient(to right, rgba(51,51,51,0) 0%, rgba(51,51,51,0.55) 50%, rgba(51,51,51,0) 100%)";

/**
 * Education section below skills, on the same light background: centred label
 * and heading, then Services-style columns (thin line on top, the degree as
 * the large title and "school · year" underneath in muted gray). Hidden
 * entirely when there is no data. The columns appear one by one, each thin
 * line drawing before its text fades up.
 */
export default function Education({ items }: { items: EducationItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="relative z-10 px-6 pb-[16vh] sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-[1400px]">
        <Reveal distance={40} className="text-center">
          <p className="text-xs font-medium tracking-[0.18em] text-foreground/40 uppercase">
            {content.aboutPage.education.label}
          </p>
          <h2 className="mx-auto mt-4 max-w-[900px] text-balance text-[clamp(30px,3vw,58px)] leading-[1.05] font-normal tracking-[-0.02em] text-foreground">
            {content.aboutPage.education.heading}
          </h2>
        </Reveal>

        <div className="mt-[8vh] grid grid-cols-1 gap-x-6 gap-y-[clamp(32px,3vw,56px)] sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3 lg:gap-x-[75px]">
          {items.map((item, index) => (
            <Reveal key={item.id} distance={40} delay={about.stagger * index}>
              <LineDraw style={{ backgroundImage: LINE_GRADIENT }} />
              <div className="pt-5">
                <h3 className="text-balance text-[clamp(20px,1.7vw,32px)] leading-tight font-normal tracking-[-0.02em] text-foreground">
                  {item.degree}
                </h3>
                <p className="mt-2.5 text-[clamp(14px,1vw,18px)] leading-relaxed text-foreground/50">
                  {item.school}
                  {item.year ? ` · ${item.year}` : ""}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
