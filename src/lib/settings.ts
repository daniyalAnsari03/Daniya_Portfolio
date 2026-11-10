import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { content } from "@/lib/content";
import { normalizeSocialUrl } from "@/lib/social-url";

/** Cache tag shared by every settings read. Revalidate after a settings write. */
export const SETTINGS_TAG = "settings";

export type SocialSetting = {
  name: string;
  url: string;
};

/** Everything the public site is allowed to read (never admin_emails). */
export type PublicSettings = {
  siteName: string;
  contactEmail: string;
  socials: SocialSetting[];
};

/** Admin-only view: public settings plus the allowlist and the bot facts. */
export type AdminSettings = PublicSettings & {
  adminEmails: string[];
  chatbotKnowledge: string;
};

const DEFAULT_SOCIALS: SocialSetting[] = [
  { name: "GitHub", url: "https://github.com/" },
  { name: "LinkedIn", url: "https://linkedin.com/" },
];

function parseSocials(value: unknown): SocialSetting[] {
  if (!Array.isArray(value)) return DEFAULT_SOCIALS;

  // Existing stored values are normalized here too, so bare domains and old
  // malformed rows are fixed at read time (no database change needed).
  const socials: SocialSetting[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    const url = normalizeSocialUrl(String(row.url ?? ""));
    if (name && url) socials.push({ name, url });
  }

  return socials.length > 0 ? socials : DEFAULT_SOCIALS;
}

function parseAdminEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
    .filter(Boolean);
}

async function readSettingsMap() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("settings").select("key, value");
  if (error || !data) return null;
  return new Map<string, unknown>(data.map((row) => [row.key, row.value]));
}

/**
 * Public settings used by the contact popup. Cached with the shared `settings`
 * tag; the homepage stays static and revalidates on-demand after a settings
 * write.
 */
export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheLife("max");
  cacheTag(SETTINGS_TAG);

  const fallback: PublicSettings = {
    siteName: content.name,
    contactEmail: content.contact.email,
    socials: DEFAULT_SOCIALS,
  };

  try {
    const map = await readSettingsMap();
    if (!map) return fallback;

    const siteName =
      typeof map.get("site_name") === "string"
        ? (map.get("site_name") as string).trim()
        : "";
    const contactEmail =
      typeof map.get("contact_email") === "string"
        ? (map.get("contact_email") as string).trim()
        : "";

    return {
      siteName: siteName || fallback.siteName,
      contactEmail: contactEmail || fallback.contactEmail,
      socials: parseSocials(map.get("socials")),
    };
  } catch {
    return fallback;
  }
}

/** Full settings for the admin form (read at request time, never cached). */
export async function getAdminSettings(): Promise<AdminSettings> {
  const fallback: AdminSettings = {
    siteName: content.name,
    contactEmail: content.contact.email,
    socials: DEFAULT_SOCIALS,
    adminEmails: [],
    chatbotKnowledge: "",
  };

  try {
    const map = await readSettingsMap();
    if (!map) return fallback;

    const siteName =
      typeof map.get("site_name") === "string"
        ? (map.get("site_name") as string).trim()
        : "";
    const contactEmail =
      typeof map.get("contact_email") === "string"
        ? (map.get("contact_email") as string).trim()
        : "";
    const chatbotKnowledge =
      typeof map.get("chatbot_knowledge") === "string"
        ? (map.get("chatbot_knowledge") as string).trim()
        : "";

    return {
      siteName: siteName || fallback.siteName,
      contactEmail: contactEmail || fallback.contactEmail,
      socials: parseSocials(map.get("socials")),
      adminEmails: parseAdminEmails(map.get("admin_emails")),
      chatbotKnowledge,
    };
  } catch {
    return fallback;
  }
}
