"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import {
  BUTTON_CLASS,
  CARD_CLASS,
  FIELD_CLASS,
  IMAGE_ACCEPT,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  uploadWithProgress,
  validateImageFile,
} from "@/components/admin/shared";
import AdjustControl from "@/components/admin/AdjustControl";
import MediaFrame from "@/components/MediaFrame";
import {
  addHomepageCard,
  createHomepageCardUpload,
  deleteHomepageCard,
  reorderHomepageCards,
  updateHomepageCard,
} from "@/lib/admin/homepage-actions";
import { DEFAULT_CARD_ADJUST, type CoverAdjust } from "@/lib/cover-adjust";
import {
  homepageCardShape,
  HOMEPAGE_TEXT_LIMITS,
} from "@/lib/homepage-defaults";
import type {
  HomepageCardRow,
  HomepageContentData,
  HomepageStatus,
} from "./shared";
import { useHomepageSave } from "./useHomepageSave";

export type HomepageSectionProps = {
  data: HomepageContentData;
  update: (key: keyof HomepageContentData, value: string) => void;
  setStatus: (status: HomepageStatus) => void;
};

export default function WorksSection({
  data,
  update,
  setStatus,
  cards,
}: HomepageSectionProps & { cards: HomepageCardRow[] }) {
  const router = useRouter();
  const { save, busy } = useHomepageSave(data, setStatus);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [adjusts, setAdjusts] = useState<Record<string, CoverAdjust>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const disabled = busy || uploading || pending;

  async function handleAdd(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);

    const validation = validateImageFile(file);
    if (validation) {
      setError(validation);
      return;
    }

    setProgress(0);
    setUploading(true);

    const ticket = await createHomepageCardUpload({
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

    const added = await addHomepageCard({
      imageUrl: ticket.publicUrl,
      coverAdjust: DEFAULT_CARD_ADJUST,
    });

    if (!added.ok) {
      setError(added.error);
      return;
    }

    setStatus({ status: "success", message: "Card added." });
    router.refresh();
  }

  function move(card: HomepageCardRow, direction: -1 | 1) {
    const index = cards.findIndex((item) => item.id === card.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= cards.length) return;

    const next = [...cards];
    [next[index], next[target]] = [next[target], next[index]];

    setError(null);
    startTransition(async () => {
      const result = await reorderHomepageCards(next.map((item) => item.id));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function saveCard(card: HomepageCardRow) {
    const adjust = adjusts[card.id] ?? card.coverAdjust;
    const visible = visibility[card.id] ?? card.visible;

    setError(null);
    startTransition(async () => {
      const result = await updateHomepageCard(card.id, {
        coverAdjust: adjust,
        visible,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus({ status: "success", message: "Card saved." });
      router.refresh();
    });
  }

  function toggleVisible(card: HomepageCardRow) {
    const visible = !(visibility[card.id] ?? card.visible);
    setVisibility((prev) => ({ ...prev, [card.id]: visible }));

    setError(null);
    startTransition(async () => {
      const result = await updateHomepageCard(card.id, {
        coverAdjust: adjusts[card.id] ?? card.coverAdjust,
        visible,
      });
      if (!result.ok) {
        setError(result.error);
        setVisibility((prev) => ({ ...prev, [card.id]: card.visible }));
        return;
      }
      router.refresh();
    });
  }

  function remove(card: HomepageCardRow) {
    setError(null);
    startTransition(async () => {
      const result = await deleteHomepageCard(card.id);
      if (!result.ok) {
        setError(result.error);
        setConfirmingId(null);
        return;
      }
      setConfirmingId(null);
      setStatus({ status: "success", message: "Card deleted." });
      router.refresh();
    });
  }

  return (
    <section className={CARD_CLASS}>
      <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
        Works cards
      </h2>
      <p className="mt-2 text-sm text-black/50">
        The heading of the row and the cards that scroll past. The cards are
        independent of the projects.
      </p>

      <div className="mt-5">
        <label htmlFor="homepage-works-heading" className={LABEL_CLASS}>
          Heading
        </label>
        <input
          id="homepage-works-heading"
          className={FIELD_CLASS}
          value={data.worksHeading}
          maxLength={HOMEPAGE_TEXT_LIMITS.headline}
          onChange={(event) => update("worksHeading", event.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="mt-6 rounded-xl border border-black/10 bg-black/[0.02] p-4">
        <span className={LABEL_CLASS}>Add a card</span>
        <input
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={handleAdd}
          disabled={disabled}
          className="min-w-0 w-full text-sm text-black/60 file:mr-3 file:rounded-lg file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm file:font-medium file:text-black/70 hover:file:bg-black/10 disabled:opacity-50"
        />
        <p className="mt-2 text-xs text-black/40">
          JPEG, PNG or WebP · max 10 MB
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

      <div className="mt-6 space-y-4">
        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 bg-white/60 px-6 py-10 text-center">
            <p className="text-sm font-medium text-black/70">No cards yet</p>
            <p className="mt-1 text-sm text-black/40">
              The homepage keeps its stock cards until the first card is added.
            </p>
          </div>
        ) : (
          cards.map((card, index) => {
            const shape = homepageCardShape(index);
            const adjust = adjusts[card.id] ?? card.coverAdjust;
            const visible = visibility[card.id] ?? card.visible;
            const isConfirming = confirmingId === card.id;

            return (
              <div
                key={card.id}
                className="rounded-xl border border-black/10 bg-white p-3"
              >
                <AdjustControl
                  title={`Card ${index + 1} — image fit`}
                  adjust={adjust}
                  onChange={(next) =>
                    setAdjusts((prev) => ({ ...prev, [card.id]: next }))
                  }
                  resetTo={DEFAULT_CARD_ADJUST}
                  disabled={disabled}
                  zoomInputId={`homepage-card-zoom-${card.id}`}
                  emptyLabel="No image"
                  boxClassName="w-full max-w-[15rem] rounded-2xl bg-charcoal/5 ring-1 ring-black/5"
                  boxStyle={{ aspectRatio: String(shape.aspect) }}
                  preview={
                    <MediaFrame
                      src={card.imageUrl}
                      alt={`Homepage card ${index + 1}`}
                      kind="image"
                      adjust={adjust}
                      sizes="240px"
                      className="pointer-events-none"
                    />
                  }
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => move(card, -1)}
                    disabled={disabled || index === 0}
                    aria-label={`Move card ${index + 1} earlier`}
                    className={`${BUTTON_CLASS} px-2`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(card, 1)}
                    disabled={disabled || index === cards.length - 1}
                    aria-label={`Move card ${index + 1} later`}
                    className={`${BUTTON_CLASS} px-2`}
                  >
                    ↓
                  </button>

                  <label className="ml-1 flex cursor-pointer items-center gap-2 text-xs text-black/60">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => toggleVisible(card)}
                      disabled={disabled}
                      className="h-4 w-4 accent-accent"
                    />
                    Visible
                  </label>

                  <button
                    type="button"
                    onClick={() => saveCard(card)}
                    disabled={disabled}
                    className={`${BUTTON_CLASS} ml-auto`}
                  >
                    Save card
                  </button>

                  {isConfirming ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => remove(card)}
                        disabled={disabled}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        disabled={disabled}
                        className={BUTTON_CLASS}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(card.id)}
                      disabled={disabled}
                      className={`${BUTTON_CLASS} border-accent/40 text-accent hover:bg-accent/10`}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="mt-4 text-xs text-black/40">
        Cards alternate portrait / landscape automatically.
      </p>

      <div className="mt-6">
        <button
          type="button"
          onClick={save}
          disabled={disabled}
          className={PRIMARY_BUTTON_CLASS}
        >
          {busy ? "Saving…" : "Save heading"}
        </button>
      </div>
    </section>
  );
}
