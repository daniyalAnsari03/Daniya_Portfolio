import Image from "next/image";
import type { AboutIntro as AboutIntroData } from "@/lib/about";
import { content } from "@/lib/content";
import { isRemoteImageSrc } from "@/lib/image-source";
import { about } from "@/lib/motion";
import { Reveal, WordReveal } from "./Reveal";

type Detail = {
  label: string;
  value: string;
  href?: string;
};

/**
 * Intro: statement heading (top-left), rounded photo (left, below the
 * heading), paragraph (right, below the heading) and the contact details in a
 * label / thin line / rows style under the paragraph. Rows without a value are
 * dropped and empty blocks are not rendered.
 */
export default function AboutIntro({ intro }: { intro: AboutIntroData }) {
  const details: Detail[] = [
    {
      label: content.aboutPage.intro.locationLabel,
      value: intro.location,
    },
    {
      label: content.aboutPage.intro.emailLabel,
      value: intro.email,
      href: `mailto:${intro.email}`,
    },
    {
      label: content.aboutPage.intro.phoneLabel,
      value: intro.phone,
      href: `tel:${intro.phone.replace(/\s+/g, "")}`,
    },
  ].filter((detail) => detail.value.trim().length > 0);

  const hasContent =
    intro.statementHeading ||
    intro.paragraph ||
    intro.photoUrl ||
    details.length > 0;

  if (!hasContent) return null;

  return (
    <section className="px-[2.6vw] pt-[clamp(110px,9vw,160px)] pb-[14vh]">
      <div className="grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-12 lg:gap-y-[90px]">
        {intro.statementHeading && (
          <h2 className="max-w-full text-[clamp(28px,3vw,58px)] leading-[1.05] font-normal tracking-[-0.02em] text-foreground lg:col-span-12 lg:col-start-1 lg:row-start-1 lg:max-w-[62vw]">
            <WordReveal text={intro.statementHeading} />
          </h2>
        )}

        {intro.photoUrl && (
          <Reveal
            className="w-full overflow-hidden rounded-[10px] sm:w-[clamp(260px,23vw,440px)] lg:col-span-6 lg:col-start-1 lg:row-start-2"
            direction="left"
            distance={56}
            delay={about.stagger}
          >
            <Image
              src={intro.photoUrl}
              alt={content.name}
              width={1200}
              height={1500}
              quality={95}
              sizes="(min-width: 1913px) 440px, (min-width: 1044px) 23vw, (min-width: 640px) 260px, 100vw"
              unoptimized={isRemoteImageSrc(intro.photoUrl)}
              decoding="async"
              className="h-auto w-full"
            />
          </Reveal>
        )}

        {(intro.paragraph || details.length > 0) && (
          <div className="flex flex-col gap-8 lg:col-span-5 lg:col-start-8 lg:row-start-2">
            {intro.paragraph && (
              <Reveal direction="right" distance={56}>
                <p className="max-w-[46ch] text-[clamp(15px,1.1vw,19px)] leading-[1.5] text-foreground/70 lg:max-w-[24vw]">
                  {intro.paragraph}
                </p>
              </Reveal>
            )}

            {details.length > 0 && (
              <dl>
                {details.map((detail, index) => (
                  <Reveal
                    key={detail.label}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-foreground/15 py-4"
                    distance={20}
                    delay={about.stagger * (index + 2)}
                  >
                    <dt className="text-sm tracking-tight text-foreground/45">
                      {detail.label}
                    </dt>
                    <dd className="min-w-0 max-w-full text-[15px] font-medium tracking-tight text-foreground [overflow-wrap:anywhere] md:text-base">
                      {detail.href ? (
                        <a
                          href={detail.href}
                          className="transition-opacity duration-300 hover:opacity-60"
                        >
                          {detail.value}
                        </a>
                      ) : (
                        detail.value
                      )}
                    </dd>
                  </Reveal>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
