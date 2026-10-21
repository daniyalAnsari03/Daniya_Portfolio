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

export default function ContactSection({
  data,
  update,
  setStatus,
}: HomepageSectionProps) {
  const { save, busy } = useHomepageSave(data, setStatus);

  return (
    <section className={CARD_CLASS}>
      <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
        Contact
      </h2>
      <p className="mt-2 text-sm text-black/50">
        The heading of the contact screen. The email, the socials and the
        avatar stay in Settings and in the code.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="homepage-contact-line1" className={LABEL_CLASS}>
            Heading line 1
          </label>
          <input
            id="homepage-contact-line1"
            className={FIELD_CLASS}
            value={data.contactLine1}
            maxLength={HOMEPAGE_TEXT_LIMITS.contact}
            onChange={(event) => update("contactLine1", event.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label htmlFor="homepage-contact-line2" className={LABEL_CLASS}>
            Heading line 2
          </label>
          <input
            id="homepage-contact-line2"
            className={FIELD_CLASS}
            value={data.contactLine2}
            maxLength={HOMEPAGE_TEXT_LIMITS.contact}
            onChange={(event) => update("contactLine2", event.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label htmlFor="homepage-contact-accent" className={LABEL_CLASS}>
            Accent word
          </label>
          <input
            id="homepage-contact-accent"
            className={FIELD_CLASS}
            value={data.contactAccentWord}
            maxLength={HOMEPAGE_TEXT_LIMITS.contact}
            onChange={(event) =>
              update("contactAccentWord", event.target.value)
            }
            disabled={busy}
          />
          <p className="mt-1.5 text-xs text-black/40">
            The word shown in the accent colour. It has to appear in one of the
            two heading lines.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className={PRIMARY_BUTTON_CLASS}
        >
          {busy ? "Saving…" : "Save contact"}
        </button>
      </div>
    </section>
  );
}
