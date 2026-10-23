import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CvDocument,
  CvEntry,
  CvProfile,
  CvSection,
} from "@/lib/cv-shared";

/**
 * Cache tag shared by every CV read. Revalidate after a CV write.
 */
export const CV_TAG = "cv";

/** The migration that creates the CV tables (applied manually). */
export const CV_MIGRATION = "supabase/migrations/007_cv.sql";

export type { CvDocument, CvEntry, CvProfile, CvSection };

type ProfileRow = {
  id: number;
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

type SectionRow = {
  id: string;
  title: string | null;
  sort_order: number | null;
};

type EntryRow = {
  id: string;
  section_id: string;
  title: string | null;
  subtitle: string | null;
  period: string | null;
  description: string | null;
  sort_order: number | null;
};

const EMPTY_PROFILE: CvProfile = {
  fullName: "",
  headline: "",
  summary: "",
  email: "",
  phone: "",
  location: "",
  website: "",
  github: "",
  linkedin: "",
  isPublished: false,
};

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

/** True when the error means "the CV table does not exist yet". */
export function isMissingCvTable(error: {
  code?: string;
  message?: string;
}) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

function mapProfile(row: ProfileRow | null): CvProfile {
  if (!row) return { ...EMPTY_PROFILE };

  return {
    fullName: text(row.full_name),
    headline: text(row.headline),
    summary: text(row.summary),
    email: text(row.email),
    phone: text(row.phone),
    location: text(row.location),
    website: text(row.website),
    github: text(row.github),
    linkedin: text(row.linkedin),
    isPublished: row.is_published === true,
  };
}

function mapEntry(row: EntryRow): CvEntry {
  return {
    id: String(row.id),
    sectionId: String(row.section_id),
    title: text(row.title),
    subtitle: text(row.subtitle),
    period: text(row.period),
    description: text(row.description),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

/** The description of an entry, split into its bullet lines. */
export { cvBullets } from "@/lib/cv-shared";

async function readProfile(): Promise<CvProfile> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("cv_profile")
      .select(
        "id, full_name, headline, summary, email, phone, location, website, github, linkedin, is_published",
      )
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      if (isMissingCvTable(error)) {
        console.warn(
          `[cv] the cv_profile table is not available — apply ${CV_MIGRATION}:`,
          error.message,
        );
      } else {
        console.error("[cv] failed to read the profile:", error);
      }
      return { ...EMPTY_PROFILE };
    }

    return mapProfile((data as ProfileRow | null) ?? null);
  } catch (error) {
    console.error("[cv] unexpected error reading the profile:", error);
    return { ...EMPTY_PROFILE };
  }
}

async function readSections(): Promise<CvSection[]> {
  try {
    const admin = createAdminClient();
    const [sectionsResult, entriesResult] = await Promise.all([
      admin
        .from("cv_sections")
        .select("id, title, sort_order")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      admin
        .from("cv_entries")
        .select("id, section_id, title, subtitle, period, description, sort_order")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (sectionsResult.error || !sectionsResult.data) {
      if (sectionsResult.error) {
        if (isMissingCvTable(sectionsResult.error)) {
          console.warn(
            `[cv] the cv_sections table is not available — apply ${CV_MIGRATION}:`,
            sectionsResult.error.message,
          );
        } else {
          console.error("[cv] failed to read the sections:", sectionsResult.error);
        }
      }
      return [];
    }

    if (entriesResult.error) {
      console.error("[cv] failed to read the entries:", entriesResult.error);
    }

    const entriesBySection = new Map<string, CvEntry[]>();
    for (const row of (entriesResult.data as EntryRow[] | null) ?? []) {
      const key = String(row.section_id);
      const list = entriesBySection.get(key) ?? [];
      list.push(mapEntry(row));
      entriesBySection.set(key, list);
    }

    return (sectionsResult.data as SectionRow[]).map((row) => ({
      id: String(row.id),
      title: text(row.title),
      sortOrder: Number(row.sort_order ?? 0),
      entries: entriesBySection.get(String(row.id)) ?? [],
    }));
  } catch (error) {
    console.error("[cv] unexpected error reading the sections:", error);
    return [];
  }
}

/**
 * The public CV. `null` when nothing is published yet or when the published
 * profile has no content at all — the site then renders no Resume tab and
 * the PDF route answers 404.
 */
export async function getPublishedCv(): Promise<CvDocument | null> {
  "use cache";
  cacheLife("max");
  cacheTag(CV_TAG);

  const profile = await readProfile();
  if (!profile.isPublished) return null;

  const sections = await readSections();
  const hasContent =
    Boolean(profile.fullName) ||
    Boolean(profile.headline) ||
    Boolean(profile.summary) ||
    sections.length > 0;

  if (!hasContent) return null;

  return { profile, sections };
}

/** The full CV for the admin UI (never cached, always fresh). */
export async function getAdminCv(): Promise<CvDocument> {
  const [profile, sections] = await Promise.all([readProfile(), readSections()]);
  return { profile, sections };
}
