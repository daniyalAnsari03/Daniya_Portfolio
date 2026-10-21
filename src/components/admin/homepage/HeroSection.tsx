"use client";

import {
  CARD_CLASS,
  FIELD_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/components/admin/shared";
import { HOMEPAGE_TEXT_LIMITS } from "@/lib/homepage-defaults";
import type { HomepageContentData, HomepageStatus } from "./shared";
import { useHomepageSave } from "./useHomepageSave";

export type HomepageSectionProps = {
  data: HomepageContentData;
  update: (key: keyof HomepageContentData, value: string) => void;
  setStatus: (status: HomepageStatus) => void;
};

export default function HeroSection({
  data,
  update,
  setStatus,
}: HomepageSectionProps) {
  const { save, busy } = useHomepageSave(data, setStatus);

  return (
    <section className={CARD_CLASS}>
      <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
        Hero
      </h2>
      <p className="mt-2 text-sm text-black/50">
        The headline of the hero. Line 1 sits behind the photo, line 2 in front
        of it. The photo itself is not editable.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="homepage-hero-line1" className={LABEL_CLASS}>
            Headline line 1
          </label>
          <input
            id="homepage-hero-line1"
            className={FIELD_CLASS}
            value={data.heroLine1}
            maxLength={HOMEPAGE_TEXT_LIMITS.headline}
            onChange={(event) => update("heroLine1", event.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label htmlFor="homepage-hero-line2" className={LABEL_CLASS}>
            Headline line 2
          </label>
          <input
            id="homepage-hero-line2"
            className={FIELD_CLASS}
            value={data.heroLine2}
            maxLength={HOMEPAGE_TEXT_LIMITS.headline}
            onChange={(event) => update("heroLine2", event.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label htmlFor="homepage-hero-subtitle" className={LABEL_CLASS}>
            Subtitle
          </label>
          <input
            id="homepage-hero-subtitle"
            className={FIELD_CLASS}
            value={data.heroSubtitle}
            maxLength={HOMEPAGE_TEXT_LIMITS.subtitle}
            onChange={(event) => update("heroSubtitle", event.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className={PRIMARY_BUTTON_CLASS}
        >
          {busy ? "Saving…" : "Save hero"}
        </button>
      </div>
    </section>
  );
}
