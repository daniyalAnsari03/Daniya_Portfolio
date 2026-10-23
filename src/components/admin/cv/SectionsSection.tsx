"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CARD_CLASS,
  FIELD_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/components/admin/shared";
import {
  createCvEntry,
  createCvSection,
  deleteCvEntry,
  deleteCvSection,
  renameCvSection,
  reorderCvEntries,
  reorderCvSections,
  updateCvEntry,
} from "@/lib/admin/cv-actions";
import SectionCard from "./SectionCard";
import type { CvEntryDraft } from "./EntryCard";
import type { CvSectionRow, CvStatus } from "./shared";

export default function SectionsSection({
  sections,
  setStatus,
}: {
  sections: CvSectionRow[];
  setStatus: (status: CvStatus) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newTitle, setNewTitle] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const busy = pending;

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setStatus(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setStatus({ status: "error", message: result.error });
        return;
      }
      router.refresh();
    });
  }

  function addSection() {
    run(async () => {
      const result = await createCvSection({ title: newTitle });
      if (result.ok) setNewTitle("");
      return result;
    });
  }

  function moveSection(section: CvSectionRow, direction: -1 | 1) {
    const index = sections.findIndex((item) => item.id === section.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sections.length) return;

    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];

    run(() => reorderCvSections(next.map((item) => item.id)));
  }

  function moveEntry(
    section: CvSectionRow,
    entryId: string,
    direction: -1 | 1,
  ) {
    const index = section.entries.findIndex((item) => item.id === entryId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= section.entries.length) return;

    const next = [...section.entries];
    [next[index], next[target]] = [next[target], next[index]];

    run(() =>
      reorderCvEntries(
        section.id,
        next.map((item) => item.id),
      ),
    );
  }

  return (
    <section className={CARD_CLASS}>
      <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
        Sections
      </h2>
      <p className="mt-2 text-sm text-black/50">
        The sections of the CV and their entries. Everything is written by
        hand — nothing is pulled from the projects, the about page or the
        settings.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label htmlFor="cv-new-section" className={LABEL_CLASS}>
            New section
          </label>
          <input
            id="cv-new-section"
            className={FIELD_CLASS}
            value={newTitle}
            maxLength={120}
            placeholder="Experience"
            onChange={(event) => setNewTitle(event.target.value)}
            disabled={busy}
          />
        </div>
        <button
          type="button"
          onClick={addSection}
          disabled={busy || newTitle.trim().length === 0}
          className={PRIMARY_BUTTON_CLASS}
        >
          {busy ? "Working…" : "Add section"}
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {sections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 bg-black/[0.02] px-6 py-10 text-center">
            <p className="text-sm font-medium text-black/70">No sections yet</p>
            <p className="mt-1 text-sm text-black/40">
              Add the first section above — the CV stays empty until you do.
            </p>
          </div>
        ) : (
          sections.map((section, index) => (
            <SectionCard
              key={section.id}
              section={section}
              index={index}
              count={sections.length}
              busy={busy}
              confirming={confirmingId === section.id}
              onRename={(id, title) =>
                run(async () => {
                  const result = await renameCvSection(id, title);
                  if (result.ok) setStatus({ status: "success", message: "Section saved." });
                  return result;
                })
              }
              onDelete={(id) => {
                if (confirmingId !== id) {
                  setConfirmingId(id);
                  return;
                }
                setConfirmingId(null);
                run(async () => {
                  const result = await deleteCvSection(id);
                  if (result.ok)
                    setStatus({ status: "success", message: "Section deleted." });
                  return result;
                });
              }}
              onMove={(direction) => moveSection(section, direction)}
              onAddEntry={(sectionId, entry: CvEntryDraft) =>
                run(async () => {
                  const result = await createCvEntry(sectionId, {
                    title: entry.title,
                    subtitle: entry.subtitle,
                    period: entry.period,
                    description: entry.description,
                  });
                  if (result.ok)
                    setStatus({ status: "success", message: "Entry added." });
                  return result;
                })
              }
              onUpdateEntry={(sectionId, entry: CvEntryDraft) =>
                run(async () => {
                  const result = await updateCvEntry(entry.id, {
                    title: entry.title,
                    subtitle: entry.subtitle,
                    period: entry.period,
                    description: entry.description,
                  });
                  if (result.ok)
                    setStatus({ status: "success", message: "Entry saved." });
                  return result;
                })
              }
              onDeleteEntry={(sectionId, entryId) =>
                run(async () => {
                  const result = await deleteCvEntry(entryId);
                  if (result.ok)
                    setStatus({ status: "success", message: "Entry deleted." });
                  return result;
                })
              }
              onMoveEntry={(sectionId, entryId, direction) =>
                moveEntry(section, entryId, direction)
              }
            />
          ))
        )}
      </div>
    </section>
  );
}
