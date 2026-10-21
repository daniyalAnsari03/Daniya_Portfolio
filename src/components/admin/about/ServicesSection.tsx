"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createService,
  deleteService,
  reorderServices,
  updateService,
} from "@/lib/admin/about-actions";
import {
  BUTTON_CLASS,
  CARD_CLASS,
  FIELD_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  type ServiceRow,
} from "./shared";

type Editing = ServiceRow | "new" | null;

export default function ServicesSection({
  services,
}: {
  services: ServiceRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setError(null);
    setNotice(null);
    setConfirmingId(null);
    setTitle("");
    setDescription("");
    setEditing("new");
  }

  function openEdit(service: ServiceRow) {
    setError(null);
    setNotice(null);
    setConfirmingId(null);
    setTitle(service.title);
    setDescription(service.description);
    setEditing(service);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Service title is required.");
      return;
    }

    const current = editing;
    if (!current) return;

    startTransition(async () => {
      const isNew = current === "new";
      const result = isNew
        ? await createService({ title: trimmedTitle, description })
        : await updateService(current.id, { title: trimmedTitle, description });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(null);
      setNotice(isNew ? "Service added." : "Service saved.");
      router.refresh();
    });
  }

  function move(service: ServiceRow, direction: -1 | 1) {
    const index = services.findIndex((item) => item.id === service.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= services.length) return;

    const next = [...services];
    [next[index], next[target]] = [next[target], next[index]];

    setError(null);
    setNotice(null);
    setConfirmingId(null);
    startTransition(async () => {
      const result = await reorderServices(next.map((item) => item.id));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(service: ServiceRow) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await deleteService(service.id);
      if (!result.ok) {
        setError(result.error);
        setConfirmingId(null);
        return;
      }
      if (editing !== "new" && editing?.id === service.id) setEditing(null);
      setConfirmingId(null);
      setNotice("Service deleted.");
      router.refresh();
    });
  }

  return (
    <section className={CARD_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
            Services
          </h2>
          <p className="mt-2 text-sm text-black/50">
            {services.length === 0
              ? "Services offered, shown on the About page."
              : `${services.length} service${services.length === 1 ? "" : "s"} · order and edit.`}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add service
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
          <div>
            <label htmlFor="service-title" className={LABEL_CLASS}>
              Title
            </label>
            <input
              id="service-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={FIELD_CLASS}
              placeholder="Service title"
              disabled={pending}
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="service-description" className={LABEL_CLASS}>
              Description
            </label>
            <textarea
              id="service-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={`${FIELD_CLASS} min-h-24 resize-y`}
              placeholder="What this service covers"
              disabled={pending}
              maxLength={5000}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
              {pending
                ? "Saving…"
                : editing === "new"
                  ? "Add service"
                  : "Save service"}
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
        {services.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 bg-white/60 px-6 py-10 text-center">
            <p className="text-sm font-medium text-black/70">No services yet</p>
            <p className="mt-1 text-sm text-black/40">
              Add your first service to build this section.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {services.map((service, index) => {
              const isConfirming = confirmingId === service.id;
              return (
                <li
                  key={service.id}
                  className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4 sm:flex-row sm:items-start"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-medium tracking-[-0.01em]">
                      {service.title}
                    </h3>
                    {service.description && (
                      <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-black/55">
                        {service.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => move(service, -1)}
                      disabled={pending || index === 0}
                      aria-label={`Move ${service.title} up`}
                      className={`${BUTTON_CLASS} px-2.5`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(service, 1)}
                      disabled={pending || index === services.length - 1}
                      aria-label={`Move ${service.title} down`}
                      className={`${BUTTON_CLASS} px-2.5`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(service)}
                      disabled={pending}
                      className={BUTTON_CLASS}
                    >
                      Edit
                    </button>

                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => remove(service)}
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
                        onClick={() => setConfirmingId(service.id)}
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
