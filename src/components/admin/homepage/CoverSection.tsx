"use client";

import { useState, type ChangeEvent } from "react";
import {
  BUTTON_CLASS,
  CARD_CLASS,
  FIELD_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  VIDEO_ACCEPT,
  uploadWithProgress,
  validateVideoFile,
} from "@/components/admin/shared";
import { createHomepageReelUpload, removeHomepageReel } from "@/lib/admin/homepage-actions";
import { HOMEPAGE_TEXT_LIMITS } from "@/lib/homepage-defaults";
import type { HomepageContentData, HomepageStatus } from "./shared";
import { useHomepageSave } from "./useHomepageSave";

export type HomepageSectionProps = {
  data: HomepageContentData;
  update: (key: keyof HomepageContentData, value: string) => void;
  setStatus: (status: HomepageStatus) => void;
};

export default function CoverSection({
  data,
  update,
  setStatus,
}: HomepageSectionProps) {
  const { save, busy } = useHomepageSave(data, setStatus);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleReel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);

    const validation = validateVideoFile(file);
    if (validation) {
      setError(validation);
      return;
    }

    setProgress(0);
    setUploading(true);

    const ticket = await createHomepageReelUpload({
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    });

    if (!ticket.ok) {
      setError(ticket.error);
      setUploading(false);
      return;
    }

    const upload = await uploadWithProgress(
      ticket.signedUrl,
      file,
      setProgress,
    );

    setUploading(false);
    if (!upload.ok) {
      setError(upload.error);
      return;
    }

    update("reelVideoUrl", ticket.publicUrl);
    setStatus({
      status: "success",
      message: "Reel video uploaded — save the cover to publish it.",
    });
  }

  async function handleRemoveReel() {
    setError(null);
    const result = await removeHomepageReel();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    update("reelVideoUrl", "");
    setStatus({ status: "success", message: "Reel video removed." });
  }

  const disabled = busy || uploading;

  return (
    <section className={CARD_CLASS}>
      <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
        Cover
      </h2>
      <p className="mt-2 text-sm text-black/50">
        The dark section that slides over the hero. The reel pill shows an
        animated gradient — or the video you upload here.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="homepage-cover-label" className={LABEL_CLASS}>
            Label
          </label>
          <input
            id="homepage-cover-label"
            className={FIELD_CLASS}
            value={data.coverLabel}
            maxLength={HOMEPAGE_TEXT_LIMITS.label}
            onChange={(event) => update("coverLabel", event.target.value)}
            disabled={disabled}
          />
        </div>

        <div>
          <label htmlFor="homepage-cover-heading1" className={LABEL_CLASS}>
            Heading line 1
          </label>
          <input
            id="homepage-cover-heading1"
            className={FIELD_CLASS}
            value={data.coverHeading1}
            maxLength={HOMEPAGE_TEXT_LIMITS.headline}
            onChange={(event) => update("coverHeading1", event.target.value)}
            disabled={disabled}
          />
        </div>

        <div>
          <label htmlFor="homepage-cover-heading2" className={LABEL_CLASS}>
            Heading line 2
          </label>
          <input
            id="homepage-cover-heading2"
            className={FIELD_CLASS}
            value={data.coverHeading2}
            maxLength={HOMEPAGE_TEXT_LIMITS.headline}
            onChange={(event) => update("coverHeading2", event.target.value)}
            disabled={disabled}
          />
        </div>

        <div>
          <label htmlFor="homepage-reel-label" className={LABEL_CLASS}>
            Reel pill text
          </label>
          <input
            id="homepage-reel-label"
            className={FIELD_CLASS}
            value={data.reelLabel}
            maxLength={HOMEPAGE_TEXT_LIMITS.pill}
            onChange={(event) => update("reelLabel", event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 bg-black/[0.02] p-4">
        <span className={LABEL_CLASS}>Reel video</span>

        {data.reelVideoUrl ? (
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <video
              src={data.reelVideoUrl}
              muted
              loop
              playsInline
              preload="metadata"
              className="h-20 w-36 rounded-lg bg-black/5 object-cover"
            />
            <button
              type="button"
              onClick={handleRemoveReel}
              disabled={disabled}
              className={`${BUTTON_CLASS} border-accent/40 text-accent hover:bg-accent/10`}
            >
              Remove video
            </button>
          </div>
        ) : (
          <p className="mt-1 text-xs text-black/40">
            No video — the pill shows the animated gradient.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept={VIDEO_ACCEPT}
            onChange={handleReel}
            disabled={disabled}
            className="min-w-0 flex-1 text-sm text-black/60 file:mr-3 file:rounded-lg file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm file:font-medium file:text-black/70 hover:file:bg-black/10 disabled:opacity-50"
          />
        </div>

        <p className="mt-2 text-xs text-black/40">
          MP4 or WebM · max 50 MB
        </p>

        {uploading && (
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/10"
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

        {error && (
          <p role="alert" className="mt-3 text-sm text-accent">
            {error}
          </p>
        )}
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={save}
          disabled={disabled}
          className={PRIMARY_BUTTON_CLASS}
        >
          {busy ? "Saving…" : "Save cover"}
        </button>
      </div>
    </section>
  );
}
