"use client";

import { useState } from "react";
import { BUTTON_CLASS, FIELD_CLASS, LABEL_CLASS } from "@/components/admin/shared";

export type CvEntryDraft = {
  id: string;
  title: string;
  subtitle: string;
  period: string;
  description: string;
};

const LIMITS = {
  title: 160,
  subtitle: 160,
  period: 80,
  description: 4000,
};

export default function EntryCard({
  entry,
  index,
  count,
  busy,
  onSave,
  onDelete,
  onMove,
  deleteLabel = "Delete",
}: {
  entry: CvEntryDraft;
  index: number;
  count: number;
  busy: boolean;
  onSave: (entry: CvEntryDraft) => void;
  onDelete: (id: string) => void;
  onMove: (direction: -1 | 1) => void;
  /** Label of the last button — "Cancel" for a not-yet-saved entry. */
  deleteLabel?: string;
}) {
  const signature = JSON.stringify(entry);
  const [seen, setSeen] = useState(signature);
  const [draft, setDraft] = useState<CvEntryDraft>(entry);

  // The server data is the source of truth: when it changes, the draft is
  // replaced by it (so a save is reflected and a refresh never keeps stale
  // text). Adjusted during render — the documented prop-change pattern.
  if (seen !== signature) {
    setSeen(signature);
    setDraft(entry);
  }

  function update(key: keyof CvEntryDraft, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4">
      <div>
        <label htmlFor={`cv-entry-title-${entry.id}`} className={LABEL_CLASS}>
          Title
        </label>
        <input
          id={`cv-entry-title-${entry.id}`}
          className={FIELD_CLASS}
          value={draft.title}
          maxLength={LIMITS.title}
          placeholder="Role, degree, project…"
          onChange={(event) => update("title", event.target.value)}
          disabled={busy}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`cv-entry-subtitle-${entry.id}`}
            className={LABEL_CLASS}
          >
            Subtitle
          </label>
          <input
            id={`cv-entry-subtitle-${entry.id}`}
            className={FIELD_CLASS}
            value={draft.subtitle}
            maxLength={LIMITS.subtitle}
            placeholder="Company, school…"
            onChange={(event) => update("subtitle", event.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label
            htmlFor={`cv-entry-period-${entry.id}`}
            className={LABEL_CLASS}
          >
            Period
          </label>
          <input
            id={`cv-entry-period-${entry.id}`}
            className={FIELD_CLASS}
            value={draft.period}
            maxLength={LIMITS.period}
            placeholder="2024 - Present"
            onChange={(event) => update("period", event.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="mt-3">
        <label
          htmlFor={`cv-entry-description-${entry.id}`}
          className={LABEL_CLASS}
        >
          Description
        </label>
        <textarea
          id={`cv-entry-description-${entry.id}`}
          className={`${FIELD_CLASS} min-h-[90px] resize-y`}
          value={draft.description}
          maxLength={LIMITS.description}
          placeholder="One line = one bullet"
          onChange={(event) => update("description", event.target.value)}
          disabled={busy}
        />
        <p className="mt-1.5 text-xs text-black/40">One line = one bullet</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={busy || index === 0}
          aria-label={`Move entry ${index + 1} earlier`}
          className={`${BUTTON_CLASS} px-2`}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={busy || index === count - 1}
          aria-label={`Move entry ${index + 1} later`}
          className={`${BUTTON_CLASS} px-2`}
        >
          ↓
        </button>

        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={busy}
          className={`${BUTTON_CLASS} ml-auto`}
        >
          Save entry
        </button>

        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          disabled={busy}
          className={`${BUTTON_CLASS} border-accent/40 text-accent hover:bg-accent/10`}
        >
          {deleteLabel}
        </button>
      </div>
    </div>
  );
}
