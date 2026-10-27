"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import { CheckIcon } from "@/components/icons";
import {
  submitChatContactMessage,
  type ContactFormState,
} from "@/lib/contact/actions";

const MESSAGE_MAX = 1000;

const FORM_STATE: ContactFormState = { status: "idle" };

const LABEL_CLASS =
  "mb-1.5 block text-[11px] font-medium tracking-[0.14em] uppercase text-chat-muted";

const FIELD_CLASS =
  "w-full min-w-0 rounded-[10px] bg-chat-input px-3.5 py-2.5 text-[16px] leading-snug text-chat-text outline-none placeholder:text-chat-muted ring-1 ring-chat-border focus-visible:ring-chat-accent disabled:opacity-50 sm:text-[14px]";

const FIELD_ERROR_CLASS = "mt-1 text-[11px] text-chat-accent [overflow-wrap:anywhere]";

type ContactFieldErrors = NonNullable<
  Extract<ContactFormState, { status: "error" }>["fieldErrors"]
>;

type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "success" }
  | {
      status: "error";
      message: string;
      fieldErrors?: ContactFieldErrors;
    };

/**
 * The in-chat contact form card.
 *
 * The Contact agent's `show_contact_form` tool only signals the UI — this card
 * is rendered under a settled assistant answer and submits through the SAME
 * server-side path the Contact popup uses (validate + honeypot + insert into
 * `messages`). Nothing typed here goes into chat_messages and every field
 * value stays in this component's local state (the chat log keeps only the
 * assistant's text).
 */
export default function ContactFormCard({
  fresh,
  renderDelay,
}: {
  /** `true` on the fresh settle (the whole card fades in like the actions row). */
  fresh: boolean;
  /** Extra delay (seconds) — the same beat the speaker/copy buttons use. */
  renderDelay: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  const fieldErrors =
    state.status === "error" ? (state.fieldErrors ?? undefined) : undefined;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.status === "sending") return;

    const form = event.currentTarget;
    const data = new FormData(form);

    setState({ status: "sending" });
    try {
      const result = await submitChatContactMessage(FORM_STATE, data);
      if (result.status === "success") {
        form.reset();
        setState({ status: "success" });
        return;
      }
      if (result.status === "error") {
        setState({
          status: "error",
          message: result.message,
          fieldErrors: result.fieldErrors,
        });
        return;
      }
    } catch {
      // The action call itself failed (offline / server unreachable).
      setState({
        status: "error",
        message: content.askAi.contactForm.networkError,
      });
    }
  };

  const { contactForm: copy } = content.askAi;
  const fieldMotion = {
    duration: askAiMotion.contactForm.enter,
    ease: askAiMotion.easeOut,
  };

  return (
    <motion.div
      initial={
        fresh
          ? { opacity: 0, y: reduce ? 0 : askAiMotion.contactForm.distance }
          : false
      }
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...fieldMotion,
        delay: fresh ? renderDelay : 0,
      }}
      style={{
        willChange: fresh && !reduce ? "transform, opacity" : undefined,
      }}
      className="mt-2 w-full max-w-[85%] min-w-0"
    >
      {state.status === "success" ? (
        <p className="flex items-center gap-2 text-[13px] leading-snug text-chat-muted">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-chat-primary text-chat-primary-fg">
            <CheckIcon className="h-3 w-3" />
          </span>
          {copy.success}
        </p>
      ) : (
        <form
          noValidate
          onSubmit={(event) => void handleSubmit(event)}
          className="flex min-w-0 flex-col gap-3 rounded-[14px] bg-chat-surface p-3.5 ring-1 ring-chat-border"
        >
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : askAiMotion.contactForm.distance }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...fieldMotion, delay: 0 }}
          >
            <label htmlFor="chat-contact-email" className={LABEL_CLASS}>
              {copy.emailLabel}
            </label>
            <input
              id="chat-contact-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={copy.emailPlaceholder}
              aria-invalid={fieldErrors?.email ? true : undefined}
              disabled={state.status === "sending"}
              className={FIELD_CLASS}
            />
            {fieldErrors?.email ? (
              <p role="alert" className={FIELD_ERROR_CLASS}>
                {fieldErrors.email}
              </p>
            ) : null}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : askAiMotion.contactForm.distance }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              ...fieldMotion,
              delay: askAiMotion.contactForm.fieldStagger,
            }}
          >
            <label htmlFor="chat-contact-message" className={LABEL_CLASS}>
              {copy.messageLabel}
            </label>
            <textarea
              id="chat-contact-message"
              name="message"
              rows={4}
              maxLength={MESSAGE_MAX}
              placeholder={copy.messagePlaceholder}
              aria-invalid={fieldErrors?.message ? true : undefined}
              disabled={state.status === "sending"}
              className={`${FIELD_CLASS} resize-none`}
            />
            {fieldErrors?.message ? (
              <p role="alert" className={FIELD_ERROR_CLASS}>
                {fieldErrors.message}
              </p>
            ) : null}
          </motion.div>

          {/* Honeypot — the SAME hidden field the Contact popup uses, hidden
              from users, catches naive bots. Never visible, never focused. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden"
          >
            <label htmlFor="chat-contact-company">Company</label>
            <input
              id="chat-contact-company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {state.status === "error" ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: askAiMotion.contactForm.enter }}
              role="alert"
              className="text-[12px] leading-snug text-chat-accent [overflow-wrap:anywhere]"
            >
              {state.message}
            </motion.p>
          ) : null}

          <motion.button
            type="submit"
            disabled={state.status === "sending"}
            initial={{ opacity: 0, y: reduce ? 0 : askAiMotion.contactForm.distance }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              ...fieldMotion,
              delay: askAiMotion.contactForm.fieldStagger * 2,
            }}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-chat-primary text-[13px] font-medium text-chat-primary-fg transition-opacity disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent"
          >
            {state.status === "sending" ? copy.sending : copy.submit}
          </motion.button>
        </form>
      )}
    </motion.div>
  );
}
