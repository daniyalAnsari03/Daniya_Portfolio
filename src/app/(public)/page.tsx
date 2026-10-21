import Contact from "@/components/Contact";
import Cover from "@/components/Cover";
import Hero from "@/components/Hero";
import Works from "@/components/Works";
import { getHomepageCards, getHomepageContent } from "@/lib/homepage";

/**
 * The homepage. Everything it shows comes from the database (the admin
 * dashboard writes it) and falls back to the current hardcoded copy while the
 * database is empty — so the page looks exactly the same as before.
 */
export default async function Home() {
  const [content, cards] = await Promise.all([
    getHomepageContent(),
    getHomepageCards(),
  ]);

  return (
    <main className="relative">
      {/* Opaque content layers, stacked above the fixed contact screen. */}
      <div className="relative z-10">
        {/* The hero stays pinned while the cover slides up over it. */}
        <div className="relative">
          <Hero
            line1={content.hero.line1}
            line2={content.hero.line2}
            subtitle={content.hero.subtitle}
          />
          <Cover
            label={content.cover.label}
            heading1={content.cover.heading1}
            heading2={content.cover.heading2}
            reelLabel={content.cover.reelLabel}
            reelVideoUrl={content.cover.reelVideoUrl}
          />
        </div>

        <Works heading={content.works.heading} cards={cards} />
      </div>

      {/* Fixed contact screen + its 100vh reveal spacer (id="contact"). */}
      <Contact
        line1={content.contact.line1}
        line2={content.contact.line2}
        accentWord={content.contact.accentWord}
      />
    </main>
  );
}
