import type { Service } from "@/lib/about";
import { content } from "@/lib/content";
import { ServicesColumn, ServicesSection } from "./ServicesReveal";

/**
 * Dark services section. Numbered columns (01, 02, …) with a thin line, title
 * and description — three per row on desktop, two on tablet, one on mobile.
 * On desktop the section is at least one screen tall and its content is
 * vertically centred; it only ever grows when there are more services.
 * Hidden entirely when there is no data. On desktop the section slides up into
 * place, then the columns appear one by one, each thin line drawing left to
 * right (scaleX). On mobile / touch each column fades in as one block as it
 * enters the viewport (see `ServicesReveal.tsx`).
 */
export default function Services({ services }: { services: Service[] }) {
  if (services.length === 0) return null;

  return (
    <ServicesSection
      id="about-services"
      dataChromeDark
      className="relative z-0 flex flex-col justify-center bg-charcoal px-6 pt-[clamp(80px,8vw,130px)] pb-16 text-white sm:px-8 sm:pb-24 lg:min-h-[var(--vh-sm)] lg:px-12 lg:pb-[clamp(80px,8vw,130px)]"
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

        <div className="mt-[calc(var(--vh-sm)*0.1)] grid grid-cols-1 gap-x-6 gap-y-[clamp(40px,4vw,80px)] sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3 lg:gap-x-[75px] lg:gap-y-[clamp(40px,3.5vw,72px)]">
          {services.map((service, index) => (
            <ServicesColumn
              key={service.id}
              index={index}
              title={service.title}
              description={service.description}
            />
          ))}
        </div>
      </div>
    </ServicesSection>
  );
}
