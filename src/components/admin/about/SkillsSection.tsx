"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  createSkill,
  createSkillCategory,
  deleteSkill,
  deleteSkillCategory,
  renameSkillCategory,
  reorderSkillCategories,
  reorderSkills,
  updateSkill,
} from "@/lib/admin/about-actions";
import {
  BUTTON_CLASS,
  CARD_CLASS,
  FIELD_CLASS,
  IMAGE_ACCEPT,
  uploadAboutFile,
  type SkillCategoryRow,
  type SkillRowData,
} from "./shared";

type Result = { ok: true } | { ok: false; error: string } | null;

export default function SkillsSection({
  categories,
}: {
  categories: SkillCategoryRow[];
}) {
  const router = useRouter();
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const name = newCategory.trim();
    if (!name) {
      setError("Category name is required.");
      return;
    }

    startTransition(async () => {
      const result = await createSkillCategory(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewCategory("");
      setNotice("Category added.");
      router.refresh();
    });
  }

  function move(category: SkillCategoryRow, direction: -1 | 1) {
    const index = categories.findIndex((item) => item.id === category.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;

    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];

    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await reorderSkillCategories(next.map((item) => item.id));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className={CARD_CLASS}>
      <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
        Skills
      </h2>
      <p className="mt-2 text-sm text-black/50">
        Categories group your skills. Deleting a category removes its skills.
      </p>

      <form
        onSubmit={addCategory}
        noValidate
        className="mt-5 flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={newCategory}
          onChange={(event) => setNewCategory(event.target.value)}
          className={FIELD_CLASS}
          placeholder="New category name"
          aria-label="New category name"
          disabled={pending}
          maxLength={200}
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add category
        </button>
      </form>

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

      <div className="mt-6 space-y-4">
        {categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 bg-white/60 px-6 py-10 text-center">
            <p className="text-sm font-medium text-black/70">
              No skill categories yet
            </p>
            <p className="mt-1 text-sm text-black/40">
              Add a category, then add skills inside it.
            </p>
          </div>
        ) : (
          categories.map((category, index) => (
            <CategoryCard
              key={category.id}
              category={category}
              index={index}
              total={categories.length}
              disabled={pending}
              onMove={move}
              onNotice={setNotice}
            />
          ))
        )}
      </div>
    </section>
  );
}

function CategoryCard({
  category,
  index,
  total,
  disabled,
  onMove,
  onNotice,
}: {
  category: SkillCategoryRow;
  index: number;
  total: number;
  disabled: boolean;
  onMove: (category: SkillCategoryRow, direction: -1 | 1) => void;
  onNotice: (message: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [pending, startTransition] = useTransition();

  const [skillName, setSkillName] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  const busy = pending || disabled || adding;

  function rename() {
    const value = name.trim();
    setResult(null);
    if (!value) {
      setResult({ ok: false, error: "Category name is required." });
      return;
    }
    startTransition(async () => {
      const response = await renameSkillCategory(category.id, value);
      setResult(response);
      if (response.ok) {
        onNotice("Category renamed.");
        router.refresh();
      }
    });
  }

  function removeCategory() {
    setResult(null);
    startTransition(async () => {
      const response = await deleteSkillCategory(category.id);
      if (!response.ok) {
        setResult(response);
        setConfirming(false);
        return;
      }
      onNotice(
        `Category “${category.name}” and its skills were deleted.`,
      );
      router.refresh();
    });
  }

  function moveSkill(skill: SkillRowData, direction: -1 | 1) {
    const skillIndex = category.skills.findIndex((item) => item.id === skill.id);
    const target = skillIndex + direction;
    if (skillIndex < 0 || target < 0 || target >= category.skills.length) return;

    const next = [...category.skills];
    [next[skillIndex], next[target]] = [next[target], next[skillIndex]];

    setResult(null);
    startTransition(async () => {
      const response = await reorderSkills(
        category.id,
        next.map((item) => item.id),
      );
      if (!response.ok) {
        setResult(response);
        return;
      }
      router.refresh();
    });
  }

  function handleIconChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setIconFile(file);
  }

  function addSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    const value = skillName.trim();
    if (!value) {
      setResult({ ok: false, error: "Skill name is required." });
      return;
    }

    setAdding(true);

    void (async () => {
      let iconUrl = "";
      if (iconFile) {
        setUploadingIcon(true);
        const upload = await uploadAboutFile(iconFile, "image", "skills");
        setUploadingIcon(false);
        if (!upload.ok) {
          setResult({ ok: false, error: upload.error });
          setAdding(false);
          return;
        }
        iconUrl = upload.url;
      }

      const response = await createSkill(category.id, value, iconUrl);
      setAdding(false);
      if (!response.ok) {
        setResult(response);
        return;
      }
      setSkillName("");
      setIconFile(null);
      onNotice(`Skill “${value}” added.`);
      router.refresh();
    })();
  }

  const nameChanged = name.trim() !== category.name;

  return (
    <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={`${FIELD_CLASS} flex-1`}
          aria-label="Category name"
          disabled={busy}
          maxLength={200}
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onMove(category, -1)}
            disabled={busy || index === 0}
            aria-label={`Move ${category.name} up`}
            className={`${BUTTON_CLASS} px-2.5`}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(category, 1)}
            disabled={busy || index === total - 1}
            aria-label={`Move ${category.name} down`}
            className={`${BUTTON_CLASS} px-2.5`}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={rename}
            disabled={busy || !nameChanged}
            className={BUTTON_CLASS}
          >
            Save name
          </button>

          {confirming ? (
            <>
              <button
                type="button"
                onClick={removeCategory}
                disabled={busy}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete skills too
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className={BUTTON_CLASS}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={busy}
              className={`${BUTTON_CLASS} border-accent/40 text-accent hover:bg-accent/10`}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {result && !result.ok && (
        <p role="alert" className="mt-3 text-xs text-accent">
          {result.error}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {category.skills.length === 0 ? (
          <p className="text-sm text-black/40">No skills in this category.</p>
        ) : (
          category.skills.map((skill, skillIndex) => (
            <SkillItem
              key={skill.id}
              skill={skill}
              index={skillIndex}
              total={category.skills.length}
              disabled={busy || pending}
              onMove={moveSkill}
              onError={(message) =>
                setResult({ ok: false, error: message })
              }
              onNotice={onNotice}
            />
          ))
        )}
      </div>

      <form onSubmit={addSkill} noValidate className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={skillName}
          onChange={(event) => setSkillName(event.target.value)}
          className={FIELD_CLASS}
          placeholder="New skill name"
          aria-label={`New skill in ${category.name}`}
          disabled={busy}
          maxLength={200}
        />
        <input
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={handleIconChange}
          disabled={busy}
          aria-label={`Icon for new skill in ${category.name}`}
          className="min-w-0 flex-1 text-xs text-black/60 file:mr-2 file:rounded-lg file:border-0 file:bg-black/5 file:px-2.5 file:py-2 file:text-xs file:font-medium file:text-black/70 hover:file:bg-black/10 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {adding ? (uploadingIcon ? "Uploading…" : "Adding…") : "Add skill"}
        </button>
      </form>
    </div>
  );
}

function SkillItem({
  skill,
  index,
  total,
  disabled,
  onMove,
  onError,
  onNotice,
}: {
  skill: SkillRowData;
  index: number;
  total: number;
  disabled: boolean;
  onMove: (skill: SkillRowData, direction: -1 | 1) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(skill.name);
  const [iconUrl, setIconUrl] = useState(skill.iconUrl);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const nameChanged = name.trim() !== skill.name;
  const iconChanged = iconUrl !== skill.iconUrl;
  const busy = disabled || pending || uploading;

  function saveName() {
    const value = name.trim();
    setResult(null);
    if (!value) {
      setResult({ ok: false, error: "Skill name is required." });
      return;
    }
    startTransition(async () => {
      const response = await updateSkill(skill.id, value, iconUrl);
      setResult(response);
      if (response.ok) {
        onNotice(`Skill “${value}” saved.`);
        router.refresh();
      }
    });
  }

  function remove() {
    setResult(null);
    startTransition(async () => {
      const response = await deleteSkill(skill.id);
      if (!response.ok) {
        setResult(response);
        setConfirming(false);
        return;
      }
      onNotice(`Skill “${skill.name}” deleted.`);
      router.refresh();
    });
  }

  async function handleIcon(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setResult(null);
    setProgress(0);
    setUploading(true);

    const upload = await uploadAboutFile(file, "image", "skills", setProgress);
    if (!upload.ok) {
      setUploading(false);
      onError(upload.error);
      return;
    }

    const response = await updateSkill(skill.id, name.trim() || skill.name, upload.url);
    setUploading(false);
    if (!response.ok) {
      onError(response.error);
      return;
    }
    setIconUrl(upload.url);
    onNotice("Skill icon updated.");
    router.refresh();
  }

  function removeIcon() {
    setResult(null);
    startTransition(async () => {
      const response = await updateSkill(skill.id, name.trim() || skill.name, "");
      if (!response.ok) {
        setResult(response);
        return;
      }
      setIconUrl("");
      onNotice("Skill icon removed.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-3 sm:flex-row sm:items-center">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-black/10 bg-black/5">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain p-1"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-black/30">
            icon
          </div>
        )}
      </div>

      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        className={`${FIELD_CLASS} flex-1 py-2`}
        aria-label="Skill name"
        disabled={busy}
        maxLength={200}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={handleIcon}
          disabled={busy}
          aria-label={`Replace icon for ${skill.name}`}
          className="w-32 text-[11px] text-black/60 file:mr-1.5 file:rounded file:border-0 file:bg-black/5 file:px-2 file:py-1 file:text-[11px] file:font-medium file:text-black/70 hover:file:bg-black/10 disabled:opacity-50"
        />
        {iconUrl && (
          <button
            type="button"
            onClick={removeIcon}
            disabled={busy}
            className={`${BUTTON_CLASS} px-2`}
          >
            No icon
          </button>
        )}
        <button
          type="button"
          onClick={saveName}
          disabled={busy || (!nameChanged && !iconChanged)}
          className={BUTTON_CLASS}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => onMove(skill, -1)}
          disabled={busy || index === 0}
          aria-label={`Move ${skill.name} up`}
          className={`${BUTTON_CLASS} px-2`}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(skill, 1)}
          disabled={busy || index === total - 1}
          aria-label={`Move ${skill.name} down`}
          className={`${BUTTON_CLASS} px-2`}
        >
          ↓
        </button>

        {confirming ? (
          <>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className={BUTTON_CLASS}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            className={`${BUTTON_CLASS} border-accent/40 text-accent hover:bg-accent/10`}
          >
            Delete
          </button>
        )}
      </div>

      {uploading && (
        <span className="text-xs text-black/40" role="status">
          {progress}%
        </span>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-xs text-accent">
          {result.error}
        </p>
      )}
    </div>
  );
}
