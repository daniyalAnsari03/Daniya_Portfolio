"use server";

import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { SETTINGS_TAG, type SocialSetting } from "@/lib/settings";
import { normalizeSocialUrl } from "@/lib/social-url";
import { CHAT_KNOWLEDGE_TAG } from "@/lib/chat/knowledge";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CHATBOT_KNOWLEDGE_LENGTH = 4000;

export type SettingsInput = {
  siteName: string;
  contactEmail: string;
  socials: SocialSetting[];
  adminEmails: string[];
  chatbotKnowledge: string;
};

export type SaveSettingsResult = { ok: true } | { ok: false; error: string };

export async function saveSettings(
  input: SettingsInput,
): Promise<SaveSettingsResult> {
  await requireAdmin();

  const siteName = String(input?.siteName ?? "").trim();
  const contactEmail = String(input?.contactEmail ?? "").trim();
  const chatbotKnowledge = String(input?.chatbotKnowledge ?? "").trim();

  if (!siteName) {
    return { ok: false, error: "Site name is required." };
  }
  if (!EMAIL_RE.test(contactEmail)) {
    return { ok: false, error: "Enter a valid public contact email." };
  }
  if (chatbotKnowledge.length > MAX_CHATBOT_KNOWLEDGE_LENGTH) {
    return {
      ok: false,
      error: `Chatbot knowledge must be ${MAX_CHATBOT_KNOWLEDGE_LENGTH} characters or fewer.`,
    };
  }

  const rawSocials = (Array.isArray(input?.socials) ? input.socials : [])
    .map((row) => ({
      name: String(row?.name ?? "").trim(),
      url: String(row?.url ?? "").trim(),
    }))
    .filter((row) => row.name || row.url);

  // New values are stored normalized (https:// prepended on bare domains,
  // etc.), so every future render gets an absolute link from the database.
  const socials: SocialSetting[] = [];
  for (const social of rawSocials) {
    if (!social.name) {
      return { ok: false, error: "Every social link needs a name." };
    }
    const url = normalizeSocialUrl(social.url);
    if (!url) {
      return {
        ok: false,
        error: `Enter a valid URL for "${social.name}" (for example https://github.com/name).`,
      };
    }
    socials.push({ name: social.name, url });
  }

  const adminEmails = (Array.isArray(input?.adminEmails)
    ? input.adminEmails
    : []
  )
    .map((email) => String(email ?? "").trim().toLowerCase())
    .filter(Boolean);

  for (const email of adminEmails) {
    if (!EMAIL_RE.test(email)) {
      return { ok: false, error: `"${email}" is not a valid admin email.` };
    }
  }
  if (adminEmails.length === 0) {
    return { ok: false, error: "Add at least one admin email." };
  }

  try {
    const admin = createAdminClient();
    const updatedAt = new Date().toISOString();
    const { error } = await admin.from("settings").upsert(
      [
        { key: "site_name", value: siteName, updated_at: updatedAt },
        { key: "contact_email", value: contactEmail, updated_at: updatedAt },
        { key: "socials", value: socials, updated_at: updatedAt },
        { key: "admin_emails", value: adminEmails, updated_at: updatedAt },
        {
          key: "chatbot_knowledge",
          value: chatbotKnowledge,
          updated_at: updatedAt,
        },
      ],
      { onConflict: "key" },
    );

    if (error) {
      return { ok: false, error: "Could not save settings. Please try again." };
    }
  } catch {
    return { ok: false, error: "Could not save settings. Please try again." };
  }

  // `expire: 0` so the next read blocks for fresh data (read-your-own-writes).
  revalidateTag(SETTINGS_TAG, { expire: 0 });
  revalidateTag(CHAT_KNOWLEDGE_TAG, { expire: 0 });
  return { ok: true };
}
