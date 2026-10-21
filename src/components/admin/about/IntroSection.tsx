"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveAboutIntro } from "@/lib/admin/about-actions";
import {
  BUTTON_CLASS,
  CARD_CLASS,
  FIELD_CLASS,
  IMAGE_ACCEPT,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  uploadAboutFile,
  type AboutIntroData,
} from "./shared";

const PHOTO_SCOPE = "intro";

export default function IntroSection({ intro }: { intro: AboutIntroData }) {
  const router = useRouter();
  const [heroHeading, setHeroHeading] = useState(intro.heroHeading);
  const [heroSubtitle, setHeroSubtitle] = useState(intro.heroSubtitle);
  const [statementHeading, setStatementHeading] = useState(
    intro.statementHeading,
  );
  const [paragraph, setParagraph] = useState(intro.paragraph);
  const [photoUrl, setPhotoUrl] = useState(intro.photoUrl);
  const [location, setLocation] = useState(intro.location);
  const [email, setEmail] = useState(intro.email);
  const [phone, setPhone] = useState(intro.phone);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<
    { ok: true } | { ok: false; error: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadError(null);
    setResult(null);
    setProgress(0);
    setUploading(true);

    const upload = await uploadAboutFile(file, "image", PHOTO_SCOPE, setProgress);
    setUploading(false);
    if (!upload.ok) {
      setUploadError(upload.error);
      return;
    }

    setPhotoUrl(upload.url);
    setProgress(100);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    if (uploading) {
      setResult({
        ok: false,
        error: "Wait for the photo upload to finish before saving.",
      });
      return;
    }

    startTransition(async () => {
      const response = await saveAboutIntro({
        heroHeading,
        heroSubtitle,
        statementHeading,
        paragraph,
        photoUrl,
        location,
        email,
        phone,
      });
      setResult(response);
      if (response.ok) router.refresh();
    });
  }

  const busy = pending || uploading;

  return (
    <section className={CARD_CLASS}>
      <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
        Intro
      </h2>
      <p className="mt-2 text-sm text-black/50">
        Hero copy plus the statement, photo and contact details. Stored as a
        single row.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
        <div>
          <label htmlFor="about-hero-heading" className={LABEL_CLASS}>
            Hero heading
          </label>
          <textarea
            id="about-hero-heading"
            value={heroHeading}
            onChange={(event) => setHeroHeading(event.target.value)}
            className={`${FIELD_CLASS} min-h-20 resize-y`}
            placeholder={"Two lines of hero text\none per line"}
            disabled={busy}
            maxLength={200}
          />
          <p className="mt-1.5 text-xs text-black/40">
            Press Enter to add a line break for the 2-line heading.
          </p>
        </div>

        <div>
          <label htmlFor="about-hero-subtitle" className={LABEL_CLASS}>
            Hero subtitle
          </label>
          <input
            id="about-hero-subtitle"
            value={heroSubtitle}
            onChange={(event) => setHeroSubtitle(event.target.value)}
            className={FIELD_CLASS}
            placeholder="A short subtitle"
            disabled={busy}
            maxLength={200}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="about-statement-heading" className={LABEL_CLASS}>
              Statement heading
            </label>
            <input
              id="about-statement-heading"
              value={statementHeading}
              onChange={(event) => setStatementHeading(event.target.value)}
              className={FIELD_CLASS}
              placeholder="Who you are"
              disabled={busy}
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="about-location" className={LABEL_CLASS}>
              Location
            </label>
            <input
              id="about-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className={FIELD_CLASS}
              placeholder="City, Country"
              disabled={busy}
              maxLength={200}
            />
          </div>
        </div>

        <div>
          <label htmlFor="about-paragraph" className={LABEL_CLASS}>
            Paragraph
          </label>
          <textarea
            id="about-paragraph"
            value={paragraph}
            onChange={(event) => setParagraph(event.target.value)}
            className={`${FIELD_CLASS} min-h-32 resize-y`}
            placeholder="A paragraph about you"
            disabled={busy}
            maxLength={5000}
          />
        </div>

        <div>
          <span className={LABEL_CLASS}>Photo</span>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="h-32 w-full overflow-hidden rounded-xl border border-black/10 bg-black/5 sm:w-32">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Intro photo preview"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-3 text-center text-xs text-black/35">
                  No photo
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <input
                type="file"
                accept={IMAGE_ACCEPT}
                onChange={handlePhoto}
                disabled={busy}
                className="block w-full text-sm text-black/60 file:mr-3 file:rounded-lg file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm file:font-medium file:text-black/70 hover:file:bg-black/10 disabled:opacity-50"
              />

              {uploading && (
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-black/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div
                    className="h-full bg-accent transition-[width] duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {uploadError && (
                <p role="alert" className="text-xs text-accent">
                  {uploadError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoUrl("");
                      setUploadError(null);
                      setProgress(0);
                    }}
                    disabled={busy}
                    className={BUTTON_CLASS}
                  >
                    Remove photo
                  </button>
                )}
                <span className="text-xs text-black/40">
                  JPEG, PNG or WebP · max 10 MB
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="about-email" className={LABEL_CLASS}>
              Email
            </label>
            <input
              id="about-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={FIELD_CLASS}
              placeholder="you@example.com"
              disabled={busy}
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="about-phone" className={LABEL_CLASS}>
              Phone
            </label>
            <input
              id="about-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={FIELD_CLASS}
              placeholder="+1 234 567 890"
              disabled={busy}
              maxLength={200}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-black/10 pt-5">
          <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>
            {pending ? "Saving…" : "Save intro"}
          </button>

          {uploading && !pending && (
            <p className="text-sm text-black/45">Uploading photo…</p>
          )}
          {result?.ok && (
            <p className="text-sm text-green-700">Intro saved.</p>
          )}
          {result && !result.ok && (
            <p role="alert" className="text-sm text-accent">
              {result.error}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
