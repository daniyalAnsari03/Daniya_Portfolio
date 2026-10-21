import type { Service } from "@/lib/about";
import { content } from "@/lib/content";
import { about } from "@/lib/motion";
import { LineDraw, Reveal, SectionRise } from "./Reveal";

/**
 * Dark services section. Numbered columns (01, 02, …) with a thin line, title
 * and description — three per row on desktop, two on tablet, one on mobile.
 * On desktop the section is at least one screen tall and its content is
 * vertically centred; it only ever grows when there are more services.
 * Hidden entirely when there is no data. The section slides up into place, then
 * the columns appear one by one, each thin line drawing before its text fades up.
 */
export default function Services({ services }: { services: Service[] }) {
  if (services.length === 0) return null;

  return (
    <SectionRise
      id="about-services"
      dataChromeDark
      className="relative z-0 flex flex-col justify-center bg-charcoal px-6 pt-[clamp(80px,8vw,130px)] pb-16 text-white sm:px-8 sm:pb-24 lg:min-h-[100svh] lg:px-12 lg:pb-[clamp(80px,8vw,130px)]"
    >
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="text-center">
          <p className="text-xs font-medium tracking-[0.18em] text-white/40 uppercase">
            {content.aboutPage.services.label}
          </p>
          <h2 className="mx-auto mt-4 max-w-[900px] text-balance text-[clamp(30px,3vw,58px)] leading-[1.05] font-normal tracking-[-0.02em]">
            {content.aboutPage.services.heading}
          </h2>
        </div>

        <div className="mt-[10vh] grid grid-cols-1 gap-x-6 gap-y-[clamp(40px,4vw,80px)] sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3 lg:gap-x-[75px] lg:gap-y-[clamp(40px,3.5vw,72px)]">
          {services.map((service, index) => (
            <Reveal
              key={service.id}
              distance={48}
              delay={about.stagger * index}
            >
              <span className="text-[18px] font-light tabular-nums text-white/45">
                {String(index + 1).padStart(2, "0")}
              </span>
              <LineDraw inherit className="mt-3 bg-white/35" />
              <div className="pt-5">
                <h3 className="text-balance text-[clamp(22px,1.9vw,36px)] leading-tight font-light tracking-[-0.02em]">
                  {service.title}
                </h3>
                {service.description && (
                  <p className="mt-[clamp(20px,2vw,40px)] max-w-[46ch] text-[clamp(14px,1vw,18px)] leading-relaxed text-white/70 lg:max-w-[20vw]">
                    {service.description}
                  </p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </SectionRise>
  );
}
