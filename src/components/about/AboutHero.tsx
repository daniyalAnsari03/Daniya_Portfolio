import type { AboutHeroCard } from "@/lib/about";
import { about } from "@/lib/motion";
import { LoadMaskLine, LoadRise } from "./Reveal";
import MediaMarquee from "./MediaMarquee";

/** Load order: line 1 → line 2 → subtitle → cards row → marquee starts. */
const CARDS_DELAY = about.stagger * 4;
const MARQUEE_DELAY = CARDS_DELAY + about.pageDuration * 0.5;

/**
 * About hero: the big 2-line heading (line breaks are respected), the accent
 * subtitle and the auto-sliding media row. Any missing piece is simply omitted.
 * Plays the page load sequence once on mount (see docs/fix.txt).
 */
export default function AboutHero({
  heading,
  subtitle,
  cards,
}: {
  heading: string;
  subtitle: string;
  cards: AboutHeroCard[];
}) {
  const lines = heading
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  /* An explicit break is honoured as-is; otherwise the heading is measured to
     ~38vw so `text-wrap: balance` lands it on exactly 2 centred lines. */
  const headingMeasure = lines.length > 1 ? "" : "mx-auto max-w-[92vw] lg:max-w-[38vw]";

  return (
    <section id="about" className="min-h-[100svh] pb-[6vh]">
      {/* Heading block starts at 20vh; its fixed minimum height makes the
          cards row begin at 62vh, so its top peeks into the first screen. */}
      <div className="flex min-h-[62vh] justify-center px-6 pt-[20vh] sm:px-8 lg:px-12">
        <div className="w-full max-w-[1000px] text-center">
          {lines.length > 0 && (
            <h1
              className={`hyphens-none break-normal text-[clamp(36px,4.4vw,88px)] leading-[1.1] font-normal tracking-[-0.02em] text-balance text-foreground ${headingMeasure}`}
            >
              {lines.map((line, index) => (
                <LoadMaskLine key={index} delay={about.stagger * (index + 1)}>
                  {line}
                </LoadMaskLine>
              ))}
            </h1>
          )}

          {subtitle && (
            <LoadRise delay={about.stagger * (lines.length + 1)}>
              <p className="mx-auto mt-4 max-w-[34ch] text-balance text-[clamp(18px,2vw,38px)] leading-[1.2] font-normal text-accent sm:mt-5">
                {subtitle}
              </p>
            </LoadRise>
          )}
        </div>
      </div>

      {cards.length > 0 && (
        <LoadRise delay={CARDS_DELAY} distance={56}>
          <MediaMarquee cards={cards} startDelay={MARQUEE_DELAY} />
        </LoadRise>
      )}
    </section>
  );
}
