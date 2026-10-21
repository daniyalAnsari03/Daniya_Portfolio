"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createEducation,
  deleteEducation,
  reorderEducation,
  updateEducation,
} from "@/lib/admin/about-actions";
import {
  BUTTON_CLASS,
  CARD_CLASS,
  FIELD_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  type EducationRow,
} from "./shared";

type Editing = EducationRow | "new" | null;

export default function EducationSection({
  education,
}: {
  education: EducationRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [degree, setDegree] = useState("");
  const [school, setSchool] = useState("");
  const [year, setYear] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setError(null);
    setNotice(null);
    setConfirmingId(null);
    setDegree("");
    setSchool("");
    setYear("");
    setEditing("new");
  }

  function openEdit(item: EducationRow) {
    setError(null);
    setNotice(null);
    setConfirmingId(null);
    setDegree(item.degree);
    setSchool(item.school);
    setYear(item.year);
    setEditing(item);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!degree.trim()) {
      setError("Degree is required.");
      return;
    }
    if (!school.trim()) {
      setError("School is required.");
      return;
    }

    const current = editing;
    if (!current) return;

    startTransition(async () => {
      const isNew = current === "new";
      const input = { degree, school, year };
      const result = isNew
        ? await createEducation(input)
        : await updateEducation(current.id, input);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(null);
      setNotice(isNew ? "Education entry added." : "Education entry saved.");
      router.refresh();
    });
  }

  function move(item: EducationRow, direction: -1 | 1) {
    const index = education.findIndex((entry) => entry.id === item.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= education.length) return;

    const next = [...education];
    [next[index], next[target]] = [next[target], next[index]];

    setError(null);
    setNotice(null);
    setConfirmingId(null);
    startTransition(async () => {
      const result = await reorderEducation(next.map((entry) => entry.id));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(item: EducationRow) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await deleteEducation(item.id);
      if (!result.ok) {
        setError(result.error);
        setConfirmingId(null);
        return;
      }
      if (editing !== "new" && editing?.id === item.id) setEditing(null);
      setConfirmingId(null);
      setNotice("Education entry deleted.");
      router.refresh();
    });
  }

  return (
    <section className={CARD_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
            Education
          </h2>
          <p className="mt-2 text-sm text-black/50">
            {education.length === 0
              ? "Degrees and schools, ordered as shown."
              : `${education.length} entr${education.length === 1 ? "y" : "ies"} · order and edit.`}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add education
        </button>
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

      {editing && (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-5 space-y-4 rounded-xl border border-black/10 bg-black/[0.02] p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="education-degree" className={LABEL_CLASS}>
                Degree
              </label>
              <input
                id="education-degree"
                value={degree}
                onChange={(event) => setDegree(event.target.value)}
                className={FIELD_CLASS}
                placeholder="BSc Computer Science"
                disabled={pending}
                maxLength={200}
              />
            </div>
            <div>
              <label htmlFor="education-school" className={LABEL_CLASS}>
                School
              </label>
              <input
                id="education-school"
                value={school}
                onChange={(event) => setSchool(event.target.value)}
                className={FIELD_CLASS}
                placeholder="University name"
                disabled={pending}
                maxLength={200}
              />
            </div>
          </div>
          <div className="sm:max-w-xs">
            <label htmlFor="education-year" className={LABEL_CLASS}>
              Year
            </label>
            <input
              id="education-year"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className={FIELD_CLASS}
              placeholder="2020 - 2024"
              disabled={pending}
              maxLength={60}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
              {pending
                ? "Saving…"
                : editing === "new"
                  ? "Add education"
                  : "Save education"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              disabled={pending}
              className="rounded-lg border border-black/10 px-5 py-3 text-sm font-medium text-black/60 transition-colors hover:bg-black/5 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-5">
        {education.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 bg-white/60 px-6 py-10 text-center">
            <p className="text-sm font-medium text-black/70">
              No education entries yet
            </p>
            <p className="mt-1 text-sm text-black/40">
              Add your first entry to build this section.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {education.map((item, index) => {
              const isConfirming = confirmingId === item.id;
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-medium tracking-[-0.01em]">
                      {item.degree}
                    </h3>
                    <p className="mt-0.5 text-sm text-black/55">
                      {item.school}
                      {item.year ? ` · ${item.year}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => move(item, -1)}
                      disabled={pending || index === 0}
                      aria-label={`Move ${item.degree} up`}
                      className={`${BUTTON_CLASS} px-2.5`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(item, 1)}
                      disabled={pending || index === education.length - 1}
                      aria-label={`Move ${item.degree} down`}
                      className={`${BUTTON_CLASS} px-2.5`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      disabled={pending}
                      className={BUTTON_CLASS}
                    >
                      Edit
                    </button>

                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => remove(item)}
                          disabled={pending}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          disabled={pending}
                          className={BUTTON_CLASS}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(item.id)}
                        disabled={pending}
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
