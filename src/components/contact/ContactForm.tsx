"use client";

import { useActionState } from "react";
import { content } from "@/lib/content";
import {
  submitContactMessage,
  type ContactFormState,
} from "@/lib/contact/actions";
import { ArrowUpRight, CheckIcon } from "@/components/icons";

const initialState: ContactFormState = { status: "idle" };

const LABEL_CLASS =
  "mb-2 block text-[15px] font-medium tracking-[-0.01em] text-white sm:text-[16px] md:text-[18px] lg:text-[16px]";

const FIELD_CLASS =
  "w-full rounded-[8px] bg-white/[0.06] px-4 h-[52px] text-[16px] text-white outline-none transition-colors placeholder:text-white/30 focus:ring-0 focus:ring-offset-0 disabled:opacity-50 sm:h-[56px] md:h-[52px] lg:h-[52px] lg:text-[15px]";

const TEXTAREA_CLASS =
  "w-full rounded-[8px] bg-white/[0.06] px-4 py-[12px] h-[120px] text-[16px] text-white outline-none transition-colors placeholder:text-white/30 focus:ring-0 focus:ring-offset-0 disabled:opacity-50 resize-none sm:h-[130px] md:h-[140px] lg:h-[130px] lg:text-[15px]";

export default function ContactForm() {
  const copy = content.contact.popup;
  const [state, formAction, pending] = useActionState(
    submitContactMessage,
    initialState,
  );

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-accent-on-dark text-charcoal">
          <CheckIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-lg font-medium tracking-[-0.02em]">
            {copy.successTitle}
          </p>
          <p className="mt-1 text-sm text-white/60">{copy.successBody}</p>
        </div>
      </div>
    );
  }

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <div>
        <label
          htmlFor="popup-email"
          className={LABEL_CLASS}
        >
          {copy.emailFieldLabel}
        </label>
        <input
          id="popup-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={copy.emailPlaceholder}
          required
          aria-invalid={fieldErrors?.email ? true : undefined}
          className={FIELD_CLASS}
        />
        {fieldErrors?.email && (
          <p className="mt-1.5 text-xs text-accent-on-dark">{fieldErrors.email}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="popup-message"
          className={LABEL_CLASS}
        >
          {copy.messageFieldLabel}
        </label>
        <textarea
          id="popup-message"
          name="message"
          rows={5}
          placeholder={copy.messagePlaceholder}
          required
          aria-invalid={fieldErrors?.message ? true : undefined}
          className={TEXTAREA_CLASS}
        />
        {fieldErrors?.message && (
          <p className="mt-1.5 text-xs text-accent-on-dark">{fieldErrors.message}</p>
        )}
      </div>

      {/* Honeypot — hidden from users, catches naive bots. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label htmlFor="popup-company">Company</label>
        <input
          id="popup-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-accent-on-dark">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="group flex items-center justify-center gap-3 w-full rounded-[12px] bg-accent-on-dark h-[60px] px-6 text-[16px] font-medium text-charcoal transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 focus:ring-0 focus:ring-offset-0 sm:h-[64px] sm:text-[17px] md:h-[60px] md:text-[16px] lg:h-[56px] lg:text-[15px]"
      >
        <span>{pending ? copy.sending : copy.submit}</span>
        <span className="flex h-[24px] w-[24px] items-center justify-center rounded-[8px] bg-white text-accent transition-transform duration-300 group-hover:rotate-45 shrink-0 sm:h-[28px] sm:w-[28px] lg:h-[24px] lg:w-[24px]">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </button>
    </form>
  );
}