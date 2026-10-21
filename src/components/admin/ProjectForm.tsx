"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  addGalleryImage,
  createProject,
  createProjectImageUpload,
  removeGalleryImage,
  reorderGalleryImages,
  updateProject,
  type ProjectInput,
} from "@/lib/admin/project-actions";
import ProjectCover from "@/components/ProjectCover";
import AdjustControl from "@/components/admin/AdjustControl";
import {
  isValidHttpUrl,
  uploadWithProgress,
  validateImageFile,
} from "@/components/admin/shared";
import {
  clampCoverAdjust,
  DEFAULT_COVER_ADJUST,
  type CoverAdjust,
} from "@/lib/cover-adjust";
import type { ProjectRow } from "./projects-types";

const FIELD_CLASS =
  "w-full rounded-lg border border-black/10 bg-white px-3.5 py-3 text-sm text-[#111111] outline-none transition-colors placeholder:text-black/30 focus:border-accent disabled:cursor-not-allowed disabled:opacity-60";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[#111111]/70";
const CARD_CLASS = "rounded-2xl border border-black/10 bg-white p-5 sm:p-6";
const BUTTON_CLASS =
  "rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40";

type GalleryItem = {
  key: string;
  id: string | null;
  url: string;
  name: string;
  uploading: boolean;
  progress: number;
  error: string | null;
};

type SaveState =
  | { status: "success"; message: string }
  | { status: "error"; message: string }
  | null;

export default function ProjectForm({
  project,
  onClose,
  onSaved,
}: {
  project: ProjectRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [projectId, setProjectId] = useState<string | null>(
    project?.id ?? null,
  );
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [techStack, setTechStack] = useState<string[]>(
    project?.techStack ?? [],
  );
  const [techInput, setTechInput] = useState("");
  const [demoLink, setDemoLink] = useState(project?.demoLink ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(
    project?.coverImageUrl ?? "",
  );
  const [coverAdjust, setCoverAdjust] = useState<CoverAdjust>(() =>
    clampCoverAdjust(project?.coverAdjust),
  );
  const [visible, setVisible] = useState(project?.visible ?? true);
  const [images, setImages] = useState<GalleryItem[]>(() =>
    (project?.images ?? []).map((image) => ({
      key: image.id,
      id: image.id,
      url: image.url,
      name: "",
      uploading: false,
      progress: 100,
      error: null,
    })),
  );
  const [initialImageIds] = useState<string[]>(() =>
    (project?.images ?? []).map((image) => image.id),
  );
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);

  const [coverUploading, setCoverUploading] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(null);

  const uploading =
    coverUploading || images.some((image) => image.uploading);

  function addTech() {
    const value = techInput.trim();
    if (!value) return;
    setTechStack((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setTechInput("");
  }

  function handleTechKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTech();
      return;
    }
    if (event.key === "Backspace" && !techInput && techStack.length > 0) {
      setTechStack((prev) => prev.slice(0, -1));
    }
  }

  function updateImage(key: string, patch: Partial<GalleryItem>) {
    setImages((prev) =>
      prev.map((image) => (image.key === key ? { ...image, ...patch } : image)),
    );
  }

  function updateCoverAdjust(next: CoverAdjust) {
    setCoverAdjust(clampCoverAdjust(next));
  }

  function resetCoverAdjust() {
    setCoverAdjust(DEFAULT_COVER_ADJUST);
  }

  async function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validation = validateImageFile(file);
    if (validation) {
      setCoverError(validation);
      return;
    }

    setCoverError(null);
    setCoverProgress(0);
    setCoverUploading(true);

    const ticket = await createProjectImageUpload({
      fileName: file.name,
      contentType: file.type,
      size: file.size,
      projectId,
    });

    if (!ticket.ok) {
      setCoverError(ticket.error);
      setCoverUploading(false);
      return;
    }

    const upload = await uploadWithProgress(
      ticket.signedUrl,
      file,
      setCoverProgress,
    );

    setCoverUploading(false);
    if (!upload.ok) {
      setCoverError(upload.error);
      return;
    }

    setCoverImageUrl(ticket.publicUrl);
    setCoverProgress(100);
    // A new file starts from the default framing.
    resetCoverAdjust();
  }

  async function uploadGalleryFile(file: File, key: string) {
    const ticket = await createProjectImageUpload({
      fileName: file.name,
      contentType: file.type,
      size: file.size,
      projectId,
    });

    if (!ticket.ok) {
      updateImage(key, { uploading: false, error: ticket.error });
      return;
    }

    const upload = await uploadWithProgress(ticket.signedUrl, file, (progress) =>
      updateImage(key, { progress }),
    );

    if (!upload.ok) {
      updateImage(key, { uploading: false, error: upload.error });
      return;
    }

    updateImage(key, {
      uploading: false,
      progress: 100,
      url: ticket.publicUrl,
    });
  }

  function handleGalleryChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (files.length === 0) return;

    files.forEach((file) => {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const validation = validateImageFile(file);

      setImages((prev) => [
        ...prev,
        {
          key,
          id: null,
          url: "",
          name: file.name,
          uploading: !validation,
          progress: 0,
          error: validation,
        },
      ]);

      if (!validation) void uploadGalleryFile(file, key);
    });
  }

  function moveImage(index: number, direction: -1 | 1) {
    setImages((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeImage(key: string) {
    setImages((prev) => prev.filter((image) => image.key !== key));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState(null);

    if (uploading) {
      setSaveState({
        status: "error",
        message: "Wait for the uploads to finish before saving.",
      });
      return;
    }

    if (images.some((image) => image.error)) {
      setSaveState({
        status: "error",
        message: "Remove the failed uploads before saving.",
      });
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveState({ status: "error", message: "Project name is required." });
      return;
    }

    const trimmedDemo = demoLink.trim();
    if (trimmedDemo && !isValidHttpUrl(trimmedDemo)) {
      setSaveState({
        status: "error",
        message: "Demo link must be a valid URL starting with http:// or https://.",
      });
      return;
    }

    const pendingTech = techInput.trim();
    const finalTechStack =
      pendingTech && !techStack.includes(pendingTech)
        ? [...techStack, pendingTech]
        : techStack;

    const input: ProjectInput = {
      name: trimmedName,
      description,
      techStack: finalTechStack,
      demoLink: trimmedDemo,
      coverImageUrl,
      coverAdjust,
      visible,
    };

    setPending(true);

    try {
      let id = projectId;
      const creating = !id;

      if (!id) {
        const created = await createProject(input);
        if (!created.ok) {
          setSaveState({ status: "error", message: created.error });
          return;
        }
        id = created.id;
        setProjectId(id);
      } else {
        const updated = await updateProject(id, input);
        if (!updated.ok) {
          setSaveState({ status: "error", message: updated.error });
          return;
        }
      }

      const currentImageIds = new Set(
        images
          .map((image) => image.id)
          .filter((imageId): imageId is string => Boolean(imageId)),
      );

      const toRemove = initialImageIds.filter(
        (imageId) =>
          !currentImageIds.has(imageId) && !removedImageIds.includes(imageId),
      );

      for (const imageId of toRemove) {
        const result = await removeGalleryImage(id, imageId);
        if (!result.ok) {
          setSaveState({ status: "error", message: result.error });
          router.refresh();
          return;
        }
        setRemovedImageIds((prev) => [...prev, imageId]);
      }

      const orderedIds: string[] = [];
      for (const image of images) {
        if (image.id) {
          orderedIds.push(image.id);
          continue;
        }
        if (!image.url) continue;

        const added = await addGalleryImage(id, image.url);
        if (!added.ok) {
          setSaveState({ status: "error", message: added.error });
          router.refresh();
          return;
        }

        const addedId = added.image.id;
        orderedIds.push(addedId);
        updateImage(image.key, { id: addedId });
      }

      if (orderedIds.length > 1) {
        const reordered = await reorderGalleryImages(id, orderedIds);
        if (!reordered.ok) {
          setSaveState({ status: "error", message: reordered.error });
          router.refresh();
          return;
        }
      }

      setSaveState({
        status: "success",
        message: creating ? "Project created." : "Project saved.",
      });
      router.refresh();
      window.setTimeout(onSaved, 700);
    } catch {
      setSaveState({
        status: "error",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  const busy = pending || uploading;

  return (
    <form onSubmit={handleSubmit} noValidate className={`${CARD_CLASS} space-y-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.02em]">
            {projectId ? "Edit project" : "New project"}
          </h2>
          <p className="mt-1 text-xs text-black/40">
            Images are uploaded as original files, without cropping or
            recompression.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className={BUTTON_CLASS}
        >
          Close
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="project-name" className={LABEL_CLASS}>
            Name
          </label>
          <input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={FIELD_CLASS}
            placeholder="Project name"
            disabled={pending}
            maxLength={200}
          />
        </div>

        <div>
          <label htmlFor="project-demo" className={LABEL_CLASS}>
            Demo link
          </label>
          <input
            id="project-demo"
            type="url"
            value={demoLink}
            onChange={(event) => setDemoLink(event.target.value)}
            className={FIELD_CLASS}
            placeholder="https://…"
            disabled={pending}
          />
        </div>
      </div>

      <div>
        <label htmlFor="project-description" className={LABEL_CLASS}>
          Description
        </label>
        <textarea
          id="project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={`${FIELD_CLASS} min-h-28 resize-y`}
          placeholder="A short description of the project"
          disabled={pending}
          maxLength={5000}
        />
      </div>

      <div>
        <label htmlFor="project-tech" className={LABEL_CLASS}>
          Tech stack
        </label>
        <div className="flex flex-wrap gap-2 rounded-lg border border-black/10 bg-white p-2.5 focus-within:border-accent">
          {techStack.map((tech) => (
            <span
              key={tech}
              className="inline-flex items-center gap-1.5 rounded-md bg-black/5 px-2.5 py-1 text-xs font-medium text-black/70"
            >
              {tech}
              <button
                type="button"
                onClick={() =>
                  setTechStack((prev) => prev.filter((item) => item !== tech))
                }
                disabled={pending}
                aria-label={`Remove ${tech}`}
                className="text-black/40 transition-colors hover:text-accent"
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="project-tech"
            value={techInput}
            onChange={(event) => setTechInput(event.target.value)}
            onKeyDown={handleTechKeyDown}
            onBlur={addTech}
            className="min-w-40 flex-1 border-0 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-black/30"
            placeholder={
              techStack.length === 0 ? "Type and press Enter" : "Add another…"
            }
            disabled={pending}
            maxLength={40}
          />
        </div>
        <p className="mt-1.5 text-xs text-black/40">
          Press Enter to add each item. Backspace removes the last one.
        </p>
      </div>

      <div>
        <span className={LABEL_CLASS}>Visibility</span>
        <label className="inline-flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={visible}
            onChange={(event) => setVisible(event.target.checked)}
            disabled={pending}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-6 w-11 rounded-full bg-black/15 transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 peer-focus-visible:ring-offset-2"
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                visible ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </span>
          <span className="text-sm text-black/70">
            {visible ? "Visible on the site" : "Hidden from the site"}
          </span>
        </label>
      </div>

      <div>
        <span className={LABEL_CLASS}>Cover image</span>
        <div className="space-y-2">
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleCoverChange}
            disabled={busy}
            className="block w-full text-sm text-black/60 file:mr-3 file:rounded-lg file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm file:font-medium text-black/70 hover:file:bg-black/10 disabled:opacity-50"
          />

          {coverUploading && (
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-black/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={coverProgress}
            >
              <div
                className="h-full bg-accent transition-[width] duration-150"
                style={{ width: `${coverProgress}%` }}
              />
            </div>
          )}

          {coverError && (
            <p role="alert" className="text-xs text-accent">
              {coverError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {coverImageUrl && (
              <button
                type="button"
                onClick={() => {
                  setCoverImageUrl("");
                  setCoverError(null);
                  setCoverProgress(0);
                  resetCoverAdjust();
                  if (coverInputRef.current) {
                    coverInputRef.current.value = "";
                  }
                }}
                disabled={busy}
                className={BUTTON_CLASS}
              >
                Remove cover
              </button>
            )}
            <span className="text-xs text-black/40">
              JPEG, PNG or WebP · max 10 MB
            </span>
          </div>
        </div>
      </div>

      <AdjustControl
        adjust={coverAdjust}
        onChange={updateCoverAdjust}
        disabled={busy}
        zoomInputId="project-cover-zoom"
        emptyLabel="No cover image"
        resetTo={DEFAULT_COVER_ADJUST}
        preview={
          coverImageUrl ? (
            <ProjectCover
              src={coverImageUrl}
              alt="Cover preview"
              adjust={coverAdjust}
              sizes="(max-width: 640px) 100vw, 352px"
              className="pointer-events-none"
            />
          ) : null
        }
      />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={LABEL_CLASS}>Gallery images</span>
          <span className="text-xs text-black/40">
            {images.length} image{images.length === 1 ? "" : "s"}
          </span>
        </div>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleGalleryChange}
          disabled={busy}
          className="mt-1 block w-full text-sm text-black/60 file:mr-3 file:rounded-lg file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm file:font-medium file:text-black/70 hover:file:bg-black/10 disabled:opacity-50"
        />

        {images.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image, index) => (
              <div
                key={image.key}
                className="overflow-hidden rounded-xl border border-black/10 bg-white"
              >
                <div className="relative aspect-[4/3] bg-black/5">
                  {image.url ? (
                    <img
                      src={image.url}
                      alt={`Gallery image ${index + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-black/35">
                      {image.uploading ? "Uploading…" : "Upload failed"}
                    </div>
                  )}

                  <span className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {index + 1}
                  </span>

                  {image.uploading && (
                    <div
                      className="absolute inset-x-0 bottom-0 h-1.5 bg-black/20"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={image.progress}
                    >
                      <div
                        className="h-full bg-accent transition-[width] duration-150"
                        style={{ width: `${image.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2 p-2">
                  <p className="truncate text-[11px] text-black/45">
                    {image.name || `Gallery image ${index + 1}`}
                  </p>

                  {image.error && (
                    <p role="alert" className="text-[11px] text-accent">
                      {image.error}
                    </p>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveImage(index, -1)}
                      disabled={busy || index === 0}
                      aria-label={`Move image ${index + 1} earlier`}
                      className={`${BUTTON_CLASS} px-2`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImage(index, 1)}
                      disabled={busy || index === images.length - 1}
                      aria-label={`Move image ${index + 1} later`}
                      className={`${BUTTON_CLASS} px-2`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(image.key)}
                      disabled={busy}
                      className={`${BUTTON_CLASS} ml-auto border-accent/40 text-accent hover:bg-accent/10`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-5">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : projectId ? "Save changes" : "Create project"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-lg border border-black/10 px-5 py-3 text-sm font-medium text-black/60 transition-colors hover:bg-black/5 disabled:opacity-50"
        >
          Cancel
        </button>

        {uploading && !pending && (
          <p className="text-sm text-black/45">Uploading images…</p>
        )}
        {saveState?.status === "success" && (
          <p className="text-sm text-green-700">{saveState.message}</p>
        )}
        {saveState?.status === "error" && (
          <p role="alert" className="text-sm text-accent">
            {saveState.message}
          </p>
        )}
      </div>
    </form>
  );
}
