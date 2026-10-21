import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { content } from "@/lib/content";

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

/** Admin-only view: public settings plus the allowlist. */
export type AdminSettings = PublicSettings & {
  adminEmails: string[];
};

const DEFAULT_SOCIALS: SocialSetting[] = [
  { name: "GitHub", url: "https://github.com/" },
  { name: "LinkedIn", url: "https://linkedin.com/" },
];

function parseSocials(value: unknown): SocialSetting[] {
  if (!Array.isArray(value)) return DEFAULT_SOCIALS;

  const socials = value
    .map((row) =>
      row && typeof row === "object" ? (row as Record<string, unknown>) : null,
    )
    .filter((row): row is Record<string, unknown> => row !== null)
    .map((row) => ({
      name: String(row.name ?? "").trim(),
      url: String(row.url ?? "").trim(),
    }))
    .filter((row) => row.name && row.url);

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
      adminEmails: parseAdminEmails(map.get("admin_emails")),
    };
  } catch {
    return fallback;
  }
}
