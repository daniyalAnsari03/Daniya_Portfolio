"use client";

import { useState } from "react";
import { BUTTON_CLASS, FIELD_CLASS, LABEL_CLASS } from "@/components/admin/shared";
import EntryCard, { type CvEntryDraft } from "./EntryCard";
import type { CvSectionRow } from "./shared";

const LIMITS = { title: 120 };

const EMPTY_ENTRY: CvEntryDraft = {
  id: "",
  title: "",
  subtitle: "",
  period: "",
  description: "",
};

export default function SectionCard({
  section,
  index,
  count,
  busy,
  confirming = false,
  onRename,
  onDelete,
  onMove,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onMoveEntry,
}: {
  section: CvSectionRow;
  index: number;
  count: number;
  busy: boolean;
  /** The delete button asks for a confirmation first. */
  confirming?: boolean;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onMove: (direction: -1 | 1) => void;
  onAddEntry: (sectionId: string, entry: CvEntryDraft) => void;
  onUpdateEntry: (sectionId: string, entry: CvEntryDraft) => void;
  onDeleteEntry: (sectionId: string, entryId: string) => void;
  onMoveEntry: (sectionId: string, entryId: string, direction: -1 | 1) => void;
}) {
  const signature = JSON.stringify(section);
  const [seen, setSeen] = useState(signature);
  const [title, setTitle] = useState(section.title);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<CvEntryDraft>(EMPTY_ENTRY);

  if (seen !== signature) {
    setSeen(signature);
    setTitle(section.title);
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label htmlFor={`cv-section-title-${section.id}`} className={LABEL_CLASS}>
            Section
          </label>
          <input
            id={`cv-section-title-${section.id}`}
            className={FIELD_CLASS}
            value={title}
            maxLength={LIMITS.title}
            placeholder="Experience"
            onChange={(event) => setTitle(event.target.value)}
            disabled={busy}
          />
        </div>

        <button
          type="button"
          onClick={() => onRename(section.id, title)}
          disabled={busy}
          className={BUTTON_CLASS}
        >
          Save title
        </button>

        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={busy || index === 0}
          aria-label={`Move section ${index + 1} earlier`}
          className={`${BUTTON_CLASS} px-2`}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={busy || index === count - 1}
          aria-label={`Move section ${index + 1} later`}
          className={`${BUTTON_CLASS} px-2`}
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => onDelete(section.id)}
          disabled={busy}
          className={
            confirming
              ? "rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              : `${BUTTON_CLASS} border-accent/40 text-accent hover:bg-accent/10`
          }
        >
          {confirming ? "Confirm" : "Delete"}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {section.entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 bg-black/[0.02] px-4 py-6 text-center text-sm text-black/40">
            No entries in this section yet.
          </p>
        ) : (
          section.entries.map((entry, entryIndex) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              index={entryIndex}
              count={section.entries.length}
              busy={busy}
              onSave={(next) => onUpdateEntry(section.id, next)}
              onDelete={(entryId) => onDeleteEntry(section.id, entryId)}
              onMove={(direction) => onMoveEntry(section.id, entry.id, direction)}
            />
          ))
        )}
      </div>

      {adding ? (
        <div className="mt-4">
          <EntryCard
            entry={draft}
            index={0}
            count={1}
            busy={busy}
            deleteLabel="Cancel"
            onSave={(next) => {
              onAddEntry(section.id, next);
              setDraft(EMPTY_ENTRY);
            }}
            onDelete={() => {
              setAdding(false);
              setDraft(EMPTY_ENTRY);
            }}
            onMove={() => {}}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDraft(EMPTY_ENTRY);
              }}
              disabled={busy}
              className={BUTTON_CLASS}
            >
              Cancel
            </button>
            <span className="text-xs text-black/40">
              Fill the fields and press “Save entry”.
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setDraft({ ...EMPTY_ENTRY, id: `new-${section.id}` });
          }}
          disabled={busy}
          className={`${BUTTON_CLASS} mt-4`}
        >
          + Add entry
        </button>
      )}
    </div>
  );
}
