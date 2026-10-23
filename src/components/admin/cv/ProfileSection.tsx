"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  CARD_CLASS,
  FIELD_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/components/admin/shared";
import { saveCvProfile } from "@/lib/admin/cv-actions";
import type { CvProfileData, CvStatus } from "./shared";

const LIMITS = {
  fullName: 120,
  headline: 160,
  summary: 4000,
  email: 160,
  phone: 60,
  location: 120,
  url: 300,
};

export default function ProfileSection({
  profile,
  setStatus,
}: {
  profile: CvProfileData;
  setStatus: (status: CvStatus) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<CvProfileData>(profile);

  function update(key: keyof CvProfileData, value: string | boolean) {
    setStatus(null);
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    setStatus(null);
    startTransition(async () => {
      const result = await saveCvProfile(data);
      if (!result.ok) {
        setStatus({ status: "error", message: result.error });
        return;
      }
      setStatus({ status: "success", message: "Profile saved." });
      router.refresh();
    });
  }

  const disabled = pending;

  return (
    <section className={CARD_CLASS}>
      <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
        Profile
      </h2>
      <p className="mt-2 text-sm text-black/50">
        The header of the CV and the contact line. Everything here is
        standalone — it is never linked to the projects, the about page or the
        settings.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cv-full-name" className={LABEL_CLASS}>
            Full name
          </label>
          <input
            id="cv-full-name"
            className={FIELD_CLASS}
            value={data.fullName}
            maxLength={LIMITS.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            disabled={disabled}
          />
        </div>

        <div>
          <label htmlFor="cv-headline" className={LABEL_CLASS}>
            Headline
          </label>
          <input
            id="cv-headline"
            className={FIELD_CLASS}
            value={data.headline}
            maxLength={LIMITS.headline}
            onChange={(event) => update("headline", event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="cv-summary" className={LABEL_CLASS}>
          Summary
        </label>
        <textarea
          id="cv-summary"
          className={`${FIELD_CLASS} min-h-[120px] resize-y`}
          value={data.summary}
          maxLength={LIMITS.summary}
          onChange={(event) => update("summary", event.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cv-email" className={LABEL_CLASS}>
            Email
          </label>
          <input
            id="cv-email"
            type="email"
            className={FIELD_CLASS}
            value={data.email}
            maxLength={LIMITS.email}
            onChange={(event) => update("email", event.target.value)}
            disabled={disabled}
          />
        </div>

        <div>
          <label htmlFor="cv-phone" className={LABEL_CLASS}>
            Phone
          </label>
          <input
            id="cv-phone"
            className={FIELD_CLASS}
            value={data.phone}
            maxLength={LIMITS.phone}
            onChange={(event) => update("phone", event.target.value)}
            disabled={disabled}
          />
        </div>

        <div>
          <label htmlFor="cv-location" className={LABEL_CLASS}>
            Location
          </label>
          <input
            id="cv-location"
            className={FIELD_CLASS}
            value={data.location}
            maxLength={LIMITS.location}
            onChange={(event) => update("location", event.target.value)}
            disabled={disabled}
          />
        </div>

        <div>
          <label htmlFor="cv-website" className={LABEL_CLASS}>
            Website
          </label>
          <input
            id="cv-website"
            className={FIELD_CLASS}
            value={data.website}
            maxLength={LIMITS.url}
            placeholder="https://"
            onChange={(event) => update("website", event.target.value)}
            disabled={disabled}
          />
        </div>

        <div>
          <label htmlFor="cv-github" className={LABEL_CLASS}>
            GitHub
          </label>
          <input
            id="cv-github"
            className={FIELD_CLASS}
            value={data.github}
            maxLength={LIMITS.url}
            placeholder="https://"
            onChange={(event) => update("github", event.target.value)}
            disabled={disabled}
          />
        </div>

        <div>
          <label htmlFor="cv-linkedin" className={LABEL_CLASS}>
            LinkedIn
          </label>
          <input
            id="cv-linkedin"
            className={FIELD_CLASS}
            value={data.linkedin}
            maxLength={LIMITS.url}
            placeholder="https://"
            onChange={(event) => update("linkedin", event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm text-black/70">
        <input
          type="checkbox"
          checked={data.isPublished}
          onChange={(event) => update("isPublished", event.target.checked)}
          disabled={disabled}
          className="h-4 w-4 accent-accent"
        />
        Published — show the Resume tab on the site
      </label>

      <div className="mt-6">
        <button
          type="button"
          onClick={save}
          disabled={disabled}
          className={PRIMARY_BUTTON_CLASS}
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </section>
  );
}
