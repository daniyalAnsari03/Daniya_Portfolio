"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  saveSettings,
  type SaveSettingsResult,
} from "@/lib/admin/settings-actions";
import type { AdminSettings, SocialSetting } from "@/lib/settings";

const FIELD_CLASS =
  "w-full rounded-lg border border-black/10 bg-white px-3.5 py-3 text-sm text-[#111111] outline-none transition-colors placeholder:text-black/30 focus:border-accent";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[#111111]/70";
const CARD_CLASS =
  "rounded-2xl border border-black/10 bg-white p-5 sm:p-6";

export default function SettingsForm({ initial }: { initial: AdminSettings }) {
  const router = useRouter();
  const [siteName, setSiteName] = useState(initial.siteName);
  const [contactEmail, setContactEmail] = useState(initial.contactEmail);
  const [socials, setSocials] = useState<SocialSetting[]>(initial.socials);
  const [adminEmails, setAdminEmails] = useState<string[]>(
    initial.adminEmails,
  );
  const [chatbotKnowledge, setChatbotKnowledge] = useState(
    initial.chatbotKnowledge,
  );
  const [result, setResult] = useState<SaveSettingsResult | null>(null);
  const [pending, startTransition] = useTransition();

  function updateSocial(index: number, patch: Partial<SocialSetting>) {
    setSocials((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      const response = await saveSettings({
        siteName,
        contactEmail,
        socials,
        adminEmails,
        chatbotKnowledge,
      });
      setResult(response);
      if (response.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
      <section className={CARD_CLASS}>
        <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
          Site
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="site-name" className={LABEL_CLASS}>
              Site name
            </label>
            <input
              id="site-name"
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              className={FIELD_CLASS}
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="contact-email" className={LABEL_CLASS}>
              Public contact email
            </label>
            <input
              id="contact-email"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              className={FIELD_CLASS}
              placeholder="you@example.com"
            />
          </div>
        </div>
      </section>

      <section className={CARD_CLASS}>
        <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
          Chatbot
        </h2>
        <div className="mt-5">
          <label htmlFor="chatbot-knowledge" className={LABEL_CLASS}>
            Chatbot knowledge
          </label>
          <textarea
            id="chatbot-knowledge"
            value={chatbotKnowledge}
            onChange={(event) => setChatbotKnowledge(event.target.value)}
            maxLength={4000}
            rows={6}
            className={`${FIELD_CLASS} min-h-32 resize-y`}
            placeholder="Extra facts the assistant may use…"
            aria-describedby="chatbot-knowledge-help"
          />
          <p id="chatbot-knowledge-help" className="mt-2 text-xs text-black/40">
            Extra facts the Ask AI bot may use. Public information only. Do not
            paste private data.
          </p>
          <p className="mt-1 text-xs text-black/40">
            {chatbotKnowledge.length}/4000
          </p>
        </div>
      </section>

      <section className={CARD_CLASS}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
            Socials
          </h2>
          <button
            type="button"
            onClick={() => setSocials((prev) => [...prev, { name: "", url: "" }])}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
          >
            Add social
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {socials.length === 0 && (
            <p className="text-sm text-black/40">No social links yet.</p>
          )}
          {socials.map((social, index) => (
            <div key={index} className="flex flex-col gap-3 sm:flex-row">
              <input
                value={social.name}
                onChange={(event) =>
                  updateSocial(index, { name: event.target.value })
                }
                className={FIELD_CLASS}
                placeholder="GitHub"
                aria-label="Social name"
              />
              <input
                value={social.url}
                onChange={(event) =>
                  updateSocial(index, { url: event.target.value })
                }
                className={FIELD_CLASS}
                placeholder="https://…"
                aria-label="Social URL"
              />
              <button
                type="button"
                onClick={() =>
                  setSocials((prev) => prev.filter((_, i) => i !== index))
                }
                className="shrink-0 rounded-lg border border-black/10 px-3 py-2 text-sm text-black/60 transition-colors hover:bg-black/5"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className={CARD_CLASS}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium tracking-[0.18em] text-black/40 uppercase">
            Admin emails
          </h2>
          <button
            type="button"
            onClick={() => setAdminEmails((prev) => [...prev, ""])}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
          >
            Add email
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {adminEmails.length === 0 && (
            <p className="text-sm text-black/40">
              No admin emails. Add at least one to keep access.
            </p>
          )}
          {adminEmails.map((email, index) => (
            <div key={index} className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setAdminEmails((prev) =>
                    prev.map((value, i) =>
                      i === index ? event.target.value : value,
                    ),
                  )
                }
                className={FIELD_CLASS}
                placeholder="admin@example.com"
                aria-label="Admin email"
              />
              <button
                type="button"
                onClick={() =>
                  setAdminEmails((prev) => prev.filter((_, i) => i !== index))
                }
                className="shrink-0 rounded-lg border border-black/10 px-3 py-2 text-sm text-black/60 transition-colors hover:bg-black/5"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>

        {result?.ok && (
          <p className="text-sm text-green-700">Settings saved.</p>
        )}
        {result && !result.ok && (
          <p role="alert" className="text-sm text-accent">
            {result.error}
          </p>
        )}
      </div>
    </form>
  );
}
