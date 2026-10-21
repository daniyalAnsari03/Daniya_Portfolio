"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ProjectForm from "./ProjectForm";
import type { ProjectRow } from "./projects-types";
import {
  deleteProject,
  reorderProjects,
  setProjectVisibility,
} from "@/lib/admin/project-actions";

const BUTTON_CLASS =
  "rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40";

export default function ProjectsManager({
  initialProjects,
}: {
  initialProjects: ProjectRow[];
}) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement | null>(null);

  const [editing, setEditing] = useState<ProjectRow | "new" | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (editing) {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [editing]);

  function openCreate() {
    setError(null);
    setNotice(null);
    setConfirmingId(null);
    setEditing("new");
  }

  function openEdit(project: ProjectRow) {
    setError(null);
    setNotice(null);
    setConfirmingId(null);
    setEditing(project);
  }

  function toggleVisibility(project: ProjectRow) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await setProjectVisibility(project.id, !project.visible);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function move(project: ProjectRow, direction: -1 | 1) {
    const index = initialProjects.findIndex((item) => item.id === project.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= initialProjects.length) return;

    const next = [...initialProjects];
    [next[index], next[target]] = [next[target], next[index]];

    setError(null);
    setNotice(null);
    setConfirmingId(null);
    startTransition(async () => {
      const result = await reorderProjects(next.map((item) => item.id));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(project: ProjectRow) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await deleteProject(project.id);
      if (!result.ok) {
        setError(result.error);
        setConfirmingId(null);
        return;
      }
      if (editing !== "new" && editing?.id === project.id) {
        setEditing(null);
      }
      setConfirmingId(null);
      setNotice(`“${project.name}” deleted.`);
      router.refresh();
    });
  }

  const count = initialProjects.length;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.03em]">Projects</h1>
          <p className="mt-2 text-sm text-black/50">
            {count === 0
              ? "Portfolio projects, gallery images and visibility."
              : `${count} project${count === 1 ? "" : "s"} · order, visibility and gallery images.`}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Add project
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-6 rounded-xl border border-green-700/20 bg-green-700/5 px-4 py-3 text-sm text-green-700">
          {notice}
        </p>
      )}

      {editing && (
        <div ref={editorRef} className="mt-8 scroll-mt-20">
          <ProjectForm
            key={editing === "new" ? "new" : editing.id}
            project={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => setEditing(null)}
          />
        </div>
      )}

      <div className="mt-8">
        {count === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white/60 px-6 py-12 text-center">
            <p className="text-sm font-medium text-black/70">No projects yet</p>
            <p className="mt-1 text-sm text-black/40">
              Add your first project to start building the works section.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {initialProjects.map((project, index) => {
              const isConfirming = confirmingId === project.id;

              return (
                <li
                  key={project.id}
                  className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="h-40 w-full shrink-0 overflow-hidden rounded-xl bg-black/5 sm:h-20 sm:w-32">
                      {project.coverImageUrl ? (
                        <img
                          src={project.coverImageUrl}
                          alt={`${project.name} cover`}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-3 text-center text-[11px] text-black/30">
                          No cover
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-medium tracking-[-0.01em]">
                          {project.name}
                        </h2>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                            project.visible
                              ? "bg-green-700/10 text-green-700"
                              : "bg-accent/10 text-accent"
                          }`}
                        >
                          {project.visible ? "Visible" : "Hidden"}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-black/40">
                        {project.images.length} gallery image
                        {project.images.length === 1 ? "" : "s"}
                        {project.techStack.length > 0
                          ? ` · ${project.techStack.length} tech item${project.techStack.length === 1 ? "" : "s"}`
                          : ""}
                        {project.demoLink ? " · has demo link" : ""}
                      </p>

                      {project.description && (
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-black/55">
                          {project.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:w-44 sm:flex-col sm:items-stretch">
                      <div className="flex items-center gap-1 sm:justify-between">
                        <button
                          type="button"
                          onClick={() => move(project, -1)}
                          disabled={pending || index === 0}
                          aria-label={`Move ${project.name} up`}
                          className={`${BUTTON_CLASS} px-2.5`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(project, 1)}
                          disabled={
                            pending || index === initialProjects.length - 1
                          }
                          aria-label={`Move ${project.name} down`}
                          className={`${BUTTON_CLASS} px-2.5`}
                        >
                          ↓
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleVisibility(project)}
                        disabled={pending}
                        className={`${BUTTON_CLASS} ${
                          project.visible
                            ? "text-black/60"
                            : "border-accent/40 text-accent hover:bg-accent/10"
                        }`}
                      >
                        {project.visible ? "Hide" : "Show"}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEdit(project)}
                        disabled={pending}
                        className={BUTTON_CLASS}
                      >
                        Edit
                      </button>

                      {isConfirming ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => remove(project)}
                            disabled={pending}
                            className="flex-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            disabled={pending}
                            className={`${BUTTON_CLASS} flex-1`}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(project.id)}
                          disabled={pending}
                          className={`${BUTTON_CLASS} border-accent/40 text-accent hover:bg-accent/10`}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
