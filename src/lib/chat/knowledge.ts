import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { content } from "@/lib/content";
import { cvBullets } from "@/lib/cv-shared";

/**
 * Read-only knowledge for the Ask AI bot.
 *
 * Only data that is already public on the site is exposed here: visible
 * projects, the published CV, the About page content and the allowlisted public
 * settings keys. The service-role client is used for these reads only because
 * every table is service-role-only; the queries below apply the same visibility
 * rules as the public pages. Private tables (messages, admin_emails, chat logs)
 * are never queried, every query lists its columns explicitly (no select('*')),
 * and the bot never sees private data. Text is capped so the payload stays
 * small for the model.
 */

/** Cache tag shared by every knowledge read. Revalidate after a content write. */
export const CHAT_KNOWLEDGE_TAG = "chat-knowledge";

/**
 * The only settings keys the bot may read. `admin_emails` and every other key
 * are deliberately absent.
 */
export const CHAT_SETTINGS_KEYS = [
  "site_name",
  "contact_email",
  "socials",
  "chatbot_knowledge",
] as const;

const KNOWLEDGE_KEY = "chatbot_knowledge";
const CONTACT_KEYS = CHAT_SETTINGS_KEYS.filter((key) => key !== KNOWLEDGE_KEY);

const MAX_SHORT_DESCRIPTION = 240;
const MAX_LONG_DESCRIPTION = 2000;
const MAX_TECH_ITEMS = 40;
const MAX_TECH_LENGTH = 40;
const MAX_KNOWLEDGE_LENGTH = 4000;
const MAX_SOCIALS = 20;
const MAX_SOCIAL_NAME = 60;
const MAX_SOCIAL_URL = 500;

export type ChatProjectSummary = {
  id: string;
  name: string;
  shortDescription: string;
  techStack: string[];
  demoLink: string;
};

export type ChatProjectDetail = {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  demoLink: string;
};

export type ChatCvEntry = {
  title: string;
  subtitle: string;
  period: string;
  descriptionLines: string[];
};

export type ChatCvSection = {
  title: string;
  entries: ChatCvEntry[];
};

export type ChatCv = {
  profile: {
    fullName: string;
    headline: string;
    summary: string;
    email: string;
    phone: string;
    location: string;
    website: string;
    github: string;
    linkedin: string;
  };
  sections: ChatCvSection[];
};

export type ChatAbout = {
  statement: string;
  paragraph: string;
  location: string;
  services: { title: string; description: string }[];
  skillCategories: { name: string; skills: string[] }[];
  education: { degree: string; school: string; year: string }[];
};

export type ChatPublicContact = {
  siteName: string;
  contactEmail: string;
  socials: { name: string; url: string }[];
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  tech_stack: string[] | null;
  demo_link: string | null;
};

type CvProfileRow = {
  full_name: string | null;
  headline: string | null;
  summary: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  website: string | null;
  github: string | null;
  linkedin: string | null;
  is_published: boolean | null;
};

type CvSectionRow = {
  id: string;
  title: string | null;
};

type CvEntryRow = {
  section_id: string;
  title: string | null;
  subtitle: string | null;
  period: string | null;
  description: string | null;
};

type AboutIntroRow = {
  statement_heading: string | null;
  paragraph: string | null;
  location: string | null;
};

type ServiceRow = {
  title: string;
  description: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
};

type SkillRow = {
  category_id: string;
  name: string;
};

type EducationRow = {
  degree: string;
  school: string;
  year: string | null;
};

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

/** Trim and cut a value so it stays small for the model. */
function clampText(value: unknown, max: number): string {
  const trimmed = text(value).trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

function techStack(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((tech) => clampText(tech, MAX_TECH_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_TECH_ITEMS);
}

function mapProjectSummary(row: ProjectRow): ChatProjectSummary {
  return {
    id: String(row.id),
    name: clampText(row.name, MAX_SHORT_DESCRIPTION),
    shortDescription: clampText(row.description, MAX_SHORT_DESCRIPTION),
    techStack: techStack(row.tech_stack),
    demoLink: clampText(row.demo_link, MAX_SOCIAL_URL),
  };
}

function mapProjectDetail(row: ProjectRow): ChatProjectDetail {
  return {
    id: String(row.id),
    name: clampText(row.name, MAX_SHORT_DESCRIPTION),
    description: clampText(row.description, MAX_LONG_DESCRIPTION),
    techStack: techStack(row.tech_stack),
    demoLink: clampText(row.demo_link, MAX_SOCIAL_URL),
  };
}

async function readVisibleProjects(): Promise<ProjectRow[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("projects")
      .select("id, name, description, tech_stack, demo_link")
      .eq("is_visible", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error || !data) {
      if (error) console.error("[chat] failed to read projects:", error);
      return [];
    }

    return data as ProjectRow[];
  } catch (error) {
    console.error("[chat] unexpected error reading projects:", error);
    return [];
  }
}

/** Visible projects in display order. No image URLs. */
export async function getProjects(): Promise<ChatProjectSummary[]> {
  "use cache";
  cacheLife("max");
  cacheTag(CHAT_KNOWLEDGE_TAG);

  const rows = await readVisibleProjects();
  return rows.map(mapProjectSummary);
}

/** One visible project by id or (case-insensitive) name. Null otherwise. */
export async function getProjectDetail(
  idOrName: string,
): Promise<ChatProjectDetail | null> {
  "use cache";
  cacheLife("max");
  cacheTag(CHAT_KNOWLEDGE_TAG);

  const needle = String(idOrName ?? "").trim().toLowerCase();
  if (!needle) return null;

  const rows = await readVisibleProjects();
  const match = rows.find(
    (row) =>
      String(row.id).toLowerCase() === needle ||
      text(row.name).trim().toLowerCase() === needle,
  );

  return match ? mapProjectDetail(match) : null;
}

async function readPublishedCv(): Promise<ChatCv | null> {
  try {
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("cv_profile")
      .select(
        "full_name, headline, summary, email, phone, location, website, github, linkedin, is_published",
      )
      .eq("id", 1)
      .maybeSingle();

    if (profileError) {
      if (profileError.code !== "42P01") {
        console.error("[chat] failed to read the CV profile:", profileError);
      }
      return null;
    }

    const row = (profile as CvProfileRow | null) ?? null;
    if (!row || row.is_published !== true) return null;

    const [sectionsResult, entriesResult] = await Promise.all([
      admin
        .from("cv_sections")
        .select("id, title")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      admin
        .from("cv_entries")
        .select("section_id, title, subtitle, period, description")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (sectionsResult.error || !sectionsResult.data) {
      if (sectionsResult.error) {
        console.error("[chat] failed to read the CV sections:", sectionsResult.error);
      }
      return null;
    }

    if (entriesResult.error) {
      console.error("[chat] failed to read the CV entries:", entriesResult.error);
    }

    const entriesBySection = new Map<string, ChatCvEntry[]>();
    for (const entry of (entriesResult.data as CvEntryRow[] | null) ?? []) {
      const key = String(entry.section_id);
      const list = entriesBySection.get(key) ?? [];
      list.push({
        title: clampText(entry.title, MAX_SHORT_DESCRIPTION),
        subtitle: clampText(entry.subtitle, MAX_SHORT_DESCRIPTION),
        period: clampText(entry.period, MAX_SHORT_DESCRIPTION),
        descriptionLines: cvBullets(clampText(entry.description, MAX_LONG_DESCRIPTION)),
      });
      entriesBySection.set(key, list);
    }

    return {
      profile: {
        fullName: clampText(row.full_name, MAX_SHORT_DESCRIPTION),
        headline: clampText(row.headline, MAX_SHORT_DESCRIPTION),
        summary: clampText(row.summary, MAX_LONG_DESCRIPTION),
        email: clampText(row.email, MAX_SHORT_DESCRIPTION),
        phone: clampText(row.phone, MAX_SHORT_DESCRIPTION),
        location: clampText(row.location, MAX_SHORT_DESCRIPTION),
        website: clampText(row.website, MAX_SOCIAL_URL),
        github: clampText(row.github, MAX_SOCIAL_URL),
        linkedin: clampText(row.linkedin, MAX_SOCIAL_URL),
      },
      sections: (sectionsResult.data as CvSectionRow[]).map((section) => ({
        title: clampText(section.title, MAX_SHORT_DESCRIPTION),
        entries: entriesBySection.get(String(section.id)) ?? [],
      })),
    };
  } catch (error) {
    console.error("[chat] unexpected error reading the CV:", error);
    return null;
  }
}

/** The published CV only. Null when it is not published or does not exist. */
export async function getCv(): Promise<ChatCv | null> {
  "use cache";
  cacheLife("max");
  cacheTag(CHAT_KNOWLEDGE_TAG);

  return readPublishedCv();
}

async function readAbout(): Promise<ChatAbout> {
  const empty: ChatAbout = {
    statement: "",
    paragraph: "",
    location: "",
    services: [],
    skillCategories: [],
    education: [],
  };

  try {
    const admin = createAdminClient();
    const [introResult, servicesResult, categoriesResult, skillsResult, educationResult] =
      await Promise.all([
        admin
          .from("about_intro")
          .select("statement_heading, paragraph, location")
          .limit(1)
          .maybeSingle(),
        admin
          .from("services")
          .select("title, description")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        admin
          .from("skill_categories")
          .select("id, name")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        admin
          .from("skills")
          .select("category_id, name")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        admin
          .from("education")
          .select("degree, school, year")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

    if (introResult.error) {
      console.error("[chat] failed to read the About intro:", introResult.error);
    }
    if (servicesResult.error) {
      console.error("[chat] failed to read services:", servicesResult.error);
    }
    if (categoriesResult.error) {
      console.error(
        "[chat] failed to read skill categories:",
        categoriesResult.error,
      );
    }
    if (skillsResult.error) {
      console.error("[chat] failed to read skills:", skillsResult.error);
    }
    if (educationResult.error) {
      console.error("[chat] failed to read education:", educationResult.error);
    }

    const intro = (introResult.data as AboutIntroRow | null) ?? null;

    const skillsByCategory = new Map<string, string[]>();
    for (const skill of (skillsResult.data as SkillRow[] | null) ?? []) {
      const key = String(skill.category_id);
      const list = skillsByCategory.get(key) ?? [];
      const name = clampText(skill.name, MAX_TECH_LENGTH);
      if (name) list.push(name);
      skillsByCategory.set(key, list);
    }

    return {
      statement: clampText(intro?.statement_heading, MAX_SHORT_DESCRIPTION),
      paragraph: clampText(intro?.paragraph, MAX_LONG_DESCRIPTION),
      location: clampText(intro?.location, MAX_SHORT_DESCRIPTION),
      services: ((servicesResult.data as ServiceRow[] | null) ?? []).map(
        (service) => ({
          title: clampText(service.title, MAX_SHORT_DESCRIPTION),
          description: clampText(service.description, MAX_LONG_DESCRIPTION),
        }),
      ),
      skillCategories: ((categoriesResult.data as CategoryRow[] | null) ?? []).map(
        (category) => ({
          name: clampText(category.name, MAX_SHORT_DESCRIPTION),
          skills: skillsByCategory.get(String(category.id)) ?? [],
        }),
      ),
      education: ((educationResult.data as EducationRow[] | null) ?? []).map(
        (item) => ({
          degree: clampText(item.degree, MAX_SHORT_DESCRIPTION),
          school: clampText(item.school, MAX_SHORT_DESCRIPTION),
          year: clampText(item.year, MAX_SHORT_DESCRIPTION),
        }),
      ),
    };
  } catch (error) {
    console.error("[chat] unexpected error reading the About content:", error);
    return empty;
  }
}

/** The About page content, limited to the fields shown publicly. */
export async function getAbout(): Promise<ChatAbout> {
  "use cache";
  cacheLife("max");
  cacheTag(CHAT_KNOWLEDGE_TAG);

  return readAbout();
}

function parseSocials(value: unknown): { name: string; url: string }[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((row) =>
      row && typeof row === "object" ? (row as Record<string, unknown>) : null,
    )
    .filter((row): row is Record<string, unknown> => row !== null)
    .map((row) => ({
      name: clampText(row.name, MAX_SOCIAL_NAME),
      url: clampText(row.url, MAX_SOCIAL_URL),
    }))
    .filter((row) => row.name && row.url)
    .slice(0, MAX_SOCIALS);
}

function settingsMap(rows: { key: string; value: unknown }[]): Map<string, unknown> {
  return new Map(rows.map((row) => [String(row.key), row.value]));
}

/**
 * The public contact details. Reads only `site_name`, `contact_email` and
 * `socials` — never `admin_emails` or any other settings key.
 */
export async function getPublicContact(): Promise<ChatPublicContact> {
  "use cache";
  cacheLife("max");
  cacheTag(CHAT_KNOWLEDGE_TAG);

  const fallback: ChatPublicContact = {
    siteName: content.name,
    contactEmail: content.contact.email,
    socials: [],
  };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("settings")
      .select("key, value")
      .in("key", CONTACT_KEYS);

    if (error || !data) {
      if (error) console.error("[chat] failed to read public settings:", error);
      return fallback;
    }

    const map = settingsMap(data as { key: string; value: unknown }[]);
    const siteName = clampText(map.get("site_name"), MAX_SHORT_DESCRIPTION);
    const contactEmail = clampText(map.get("contact_email"), MAX_SHORT_DESCRIPTION);

    return {
      siteName: siteName || fallback.siteName,
      contactEmail: contactEmail || fallback.contactEmail,
      socials: parseSocials(map.get("socials")),
    };
  } catch (error) {
    console.error("[chat] unexpected error reading public settings:", error);
    return fallback;
  }
}

/**
 * The free-text facts the admin added in Settings → Chatbot knowledge. Reads
 * only the `chatbot_knowledge` key. Empty string when not set.
 */
export async function getChatbotKnowledge(): Promise<string> {
  "use cache";
  cacheLife("max");
  cacheTag(CHAT_KNOWLEDGE_TAG);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("settings")
      .select("key, value")
      .in("key", [KNOWLEDGE_KEY]);

    if (error || !data) {
      if (error) console.error("[chat] failed to read knowledge:", error);
      return "";
    }

    const map = settingsMap(data as { key: string; value: unknown }[]);
    return clampText(map.get(KNOWLEDGE_KEY), MAX_KNOWLEDGE_LENGTH);
  } catch (error) {
    console.error("[chat] unexpected error reading knowledge:", error);
    return "";
  }
}
