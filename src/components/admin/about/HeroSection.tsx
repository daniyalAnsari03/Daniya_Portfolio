"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addAboutHeroCard,
  deleteAboutHeroCard,
  reorderAboutHeroCards,
  updateAboutHeroCardAdjust,
} from "@/lib/admin/about-actions";
import AdjustControl from "@/components/admin/AdjustControl";
import MediaFrame from "@/components/MediaFrame";
import {
  BUTTON_CLASS,
  CARD_CLASS,
  IMAGE_ACCEPT,
  LABEL_CLASS,
  VIDEO_ACCEPT,
  uploadAboutFile,
  type AboutHeroCardRow,
  type MediaKind,
} from "./shared";
import { aboutHeroCardAspect } from "@/components/about/card-sizes";
import { DEFAULT_CARD_ADJUST, type CoverAdjust } from "@/lib/cover-adjust";

export default function HeroSection({
  cards,
}: {
  cards: AboutHeroCardRow[];
}) {
  const router = useRouter();
  const [mediaType, setMediaType] = useState<MediaKind>("image");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [adjusts, setAdjusts] = useState<Record<string, CoverAdjust>>({});
  const [pending, startTransition] = useTransition();

  async function handleAdd(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setNotice(null);
    setProgress(0);
    setUploading(true);

    const upload = await uploadAboutFile(file, mediaType, "hero", setProgress);
    if (!upload.ok) {
      setError(upload.error);
      setUploading(false);
      return;
    }

    const added = await addAboutHeroCard(mediaType, upload.url);
    setUploading(false);
    if (!added.ok) {
      setError(added.error);
      return;
    }

    setNotice(`Hero ${mediaType} added.`);
    router.refresh();
  }

  function move(card: AboutHeroCardRow, direction: -1 | 1) {
    const index = cards.findIndex((item) => item.id === card.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= cards.length) return;

    const next = [...cards];
    [next[index], next[target]] = [next[target], next[index]];

    setError(null);
    setNotice(null);
    setConfirmingId(null);
    startTransition(async () => {
      const result = await reorderAboutHeroCards(next.map((item) => item.id));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(card: AboutHeroCardRow) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await deleteAboutHeroCard(card.id);
      if (!result.ok) {
        setError(result.error);
        setConfirmingId(null);
        return;
      }
      setConfirmingId(null);
      setNotice("Hero card deleted.");
      router.refresh();
    });
  }

  function saveAdjust(card: AboutHeroCardRow, adjust: CoverAdjust) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateAboutHeroCardAdjust(card.id, adjust);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice("Hero card framing saved.");
      router.refresh();
    });
  }

  const busy = pending || uploading;

  return (
    <section className={CARD_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
            Hero
          </h2>
          <p className="mt-2 text-sm text-black/50">
            Hero heading and subtitle are edited in the Intro tab. Add the
            image or video cards that sit in the hero.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-black/10 bg-black/[0.02] p-4">
        <span className={LABEL_CLASS}>Add a hero card</span>
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex rounded-lg border border-black/10 bg-white p-1">
            {(["image", "video"] as MediaKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setMediaType(kind)}
                disabled={busy}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  mediaType === kind
                    ? "bg-charcoal text-white"
                    : "text-black/50 hover:bg-black/5"
                }`}
              >
                {kind}
              </button>
            ))}
          </div>

          <input
            type="file"
            accept={mediaType === "video" ? VIDEO_ACCEPT : IMAGE_ACCEPT}
            onChange={handleAdd}
            disabled={busy}
            className="min-w-0 flex-1 text-sm text-black/60 file:mr-3 file:rounded-lg file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm file:font-medium file:text-black/70 hover:file:bg-black/10 disabled:opacity-50"
          />
        </div>

        <p className="mt-2 text-xs text-black/40">
          {mediaType === "video"
            ? "MP4 or WebM · max 50 MB"
            : "JPEG, PNG or WebP · max 10 MB"}
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
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-4 rounded-xl border border-green-700/20 bg-green-700/5 px-4 py-3 text-sm text-green-700">
          {notice}
        </p>
      )}

      <div className="mt-6">
        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 bg-white/60 px-6 py-10 text-center">
            <p className="text-sm font-medium text-black/70">No hero cards yet</p>
            <p className="mt-1 text-sm text-black/40">
              Add an image or a video card to build the hero.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {cards.map((card, index) => {
              const isConfirming = confirmingId === card.id;
              const adjust = adjusts[card.id] ?? card.coverAdjust;
              const aspect = aboutHeroCardAspect(index);
              return (
                <li
                  key={card.id}
                  className="overflow-hidden rounded-xl border border-black/10 bg-white"
                >
                  <div className="p-3">
                    <AdjustControl
                      title={`Hero card ${index + 1} — image fit`}
                      adjust={adjust}
                      onChange={(next) =>
                        setAdjusts((prev) => ({
                          ...prev,
                          [card.id]: next,
                        }))
                      }
                      resetTo={DEFAULT_CARD_ADJUST}
                      disabled={busy}
                      zoomInputId={`hero-card-zoom-${card.id}`}
                      emptyLabel="No media"
                      boxClassName="w-full max-w-[15rem] rounded-[20px] bg-charcoal/5 ring-1 ring-black/5"
                      boxStyle={{ aspectRatio: String(aspect) }}
                      preview={
                        <MediaFrame
                          src={card.fileUrl}
                          kind={card.mediaType}
                          adjust={adjust}
                          sizes="240px"
                          className="pointer-events-none"
                        />
                      }
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 p-2.5">
                    <button
                      type="button"
                      onClick={() => move(card, -1)}
                      disabled={busy || index === 0}
                      aria-label={`Move hero card ${index + 1} earlier`}
                      className={`${BUTTON_CLASS} px-2`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(card, 1)}
                      disabled={busy || index === cards.length - 1}
                      aria-label={`Move hero card ${index + 1} later`}
                      className={`${BUTTON_CLASS} px-2`}
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      onClick={() => saveAdjust(card, adjust)}
                      disabled={busy}
                      className={`${BUTTON_CLASS} ml-auto`}
                    >
                      Save framing
                    </button>

                    {isConfirming ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => remove(card)}
                          disabled={busy}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          disabled={busy}
                          className={BUTTON_CLASS}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(card.id)}
                        disabled={busy}
                        className={`${BUTTON_CLASS} border-accent/40 text-accent hover:bg-accent/10`}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
