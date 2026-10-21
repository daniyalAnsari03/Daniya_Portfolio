import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clampCoverAdjust,
  DEFAULT_CARD_ADJUST,
  type CoverAdjust,
} from "@/lib/cover-adjust";

/**
 * Cache tags for the public About content. Each table gets its own tag so the
 * future public `/about` page can revalidate surgically after an admin write.
 */
export const ABOUT_HERO_TAG = "about-hero";
export const ABOUT_INTRO_TAG = "about-intro";
export const SERVICES_TAG = "services";
export const SKILLS_TAG = "skills";
export const EDUCATION_TAG = "education";

export type AboutMediaType = "image" | "video";

export type AboutHeroCard = {
  id: string;
  mediaType: AboutMediaType;
  fileUrl: string;
  /** Framing of the media inside the card box (fit, focus point, zoom). */
  coverAdjust: CoverAdjust;
  sortOrder: number;
};

export type AboutIntro = {
  heroHeading: string;
  heroSubtitle: string;
  statementHeading: string;
  paragraph: string;
  photoUrl: string;
  location: string;
  email: string;
  phone: string;
};

export type Service = {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
};

export type Skill = {
  id: string;
  name: string;
  iconUrl: string;
  sortOrder: number;
};

export type SkillCategory = {
  id: string;
  name: string;
  sortOrder: number;
  skills: Skill[];
};

export type EducationItem = {
  id: string;
  degree: string;
  school: string;
  year: string;
  sortOrder: number;
};

type HeroCardRow = {
  id: string;
  media_type: string | null;
  file_url: string;
  sort_order: number | null;
  cover_fit?: string | null;
  cover_pos_x?: number | string | null;
  cover_pos_y?: number | string | null;
  cover_zoom?: number | string | null;
};

type IntroRow = {
  hero_heading: string | null;
  hero_subtitle: string | null;
  statement_heading: string | null;
  paragraph: string | null;
  photo_url: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
};

type ServiceRow = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number | null;
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number | null;
};

type SkillRow = {
  id: string;
  category_id: string;
  name: string;
  icon_url: string | null;
  sort_order: number | null;
};

type EducationRow = {
  id: string;
  degree: string;
  school: string;
  year: string | null;
  sort_order: number | null;
};

const EMPTY_INTRO: AboutIntro = {
  heroHeading: "",
  heroSubtitle: "",
  statementHeading: "",
  paragraph: "",
  photoUrl: "",
  location: "",
  email: "",
  phone: "",
};

/** The hero card columns, including the framing columns. */
const HERO_CARD_COLUMNS =
  "id, media_type, file_url, sort_order, cover_fit, cover_pos_x, cover_pos_y, cover_zoom";

/** The hero card columns before the framing columns were added. */
const HERO_CARD_COLUMNS_LEGACY = "id, media_type, file_url, sort_order";

/**
 * True when the error is a "column does not exist" error — that happens when
 * a migration has not been applied yet. The read then falls back to the
 * columns that do exist instead of failing.
 */
export function isMissingColumnError(error: {
  message?: string;
  code?: string;
}): boolean {
  const message = (error?.message ?? "").toLowerCase();
  const code = (error?.code ?? "").toLowerCase();
  return (
    code === "42703" ||
    message.includes("column") ||
    message.includes("does not exist")
  );
}

/**
 * The About hero cards have always been cropped to their box
 * (object-fit: cover), so that is the framing used when a card has none
 * stored — the page looks exactly the same as it did before the framing
 * columns existed.
 */
export const DEFAULT_ABOUT_HERO_ADJUST: CoverAdjust = DEFAULT_CARD_ADJUST;

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function toNumber(
  value: number | string | null | undefined,
  fallback: number,
): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapHeroCard(row: HeroCardRow): AboutHeroCard {
  return {
    id: String(row.id),
    mediaType: row.media_type === "video" ? "video" : "image",
    fileUrl: text(row.file_url),
    coverAdjust: clampCoverAdjust(
      {
        fit:
          row.cover_fit === "cover"
            ? "cover"
            : row.cover_fit === "contain"
              ? "contain"
              : undefined,
        posX: toNumber(row.cover_pos_x, DEFAULT_ABOUT_HERO_ADJUST.posX),
        posY: toNumber(row.cover_pos_y, DEFAULT_ABOUT_HERO_ADJUST.posY),
        zoom: toNumber(row.cover_zoom, DEFAULT_ABOUT_HERO_ADJUST.zoom),
      },
      DEFAULT_ABOUT_HERO_ADJUST,
    ),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapIntro(row: IntroRow | null): AboutIntro {
  if (!row) return { ...EMPTY_INTRO };
  return {
    heroHeading: text(row.hero_heading),
    heroSubtitle: text(row.hero_subtitle),
    statementHeading: text(row.statement_heading),
    paragraph: text(row.paragraph),
    photoUrl: text(row.photo_url),
    location: text(row.location),
    email: text(row.email),
    phone: text(row.phone),
  };
}

function mapService(row: ServiceRow): Service {
  return {
    id: String(row.id),
    title: text(row.title),
    description: text(row.description),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapSkill(row: SkillRow): Skill {
  return {
    id: String(row.id),
    name: text(row.name),
    iconUrl: text(row.icon_url),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapEducation(row: EducationRow): EducationItem {
  return {
    id: String(row.id),
    degree: text(row.degree),
    school: text(row.school),
    year: text(row.year),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

async function readHeroCards(): Promise<AboutHeroCard[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("about_hero_cards")
      .select(HERO_CARD_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error || !data) {
      if (error) {
        console.error("[about] failed to read hero cards:", error);
        if (!isMissingColumnError(error)) return [];
        // The framing columns are not there yet (the migration is applied
        // manually). Read the cards anyway and use the default framing, so the
        // public page keeps working.
        console.warn(
          "[about] hero card framing columns are missing — apply supabase/migrations/006_homepage_admin.sql",
        );

        const legacy = await admin
          .from("about_hero_cards")
          .select(HERO_CARD_COLUMNS_LEGACY)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (legacy.error || !legacy.data) {
          if (legacy.error) {
            console.error("[about] failed to read hero cards:", legacy.error);
          }
          return [];
        }

        return (legacy.data as HeroCardRow[]).map(mapHeroCard);
      }
      return [];
    }

    return (data as HeroCardRow[]).map(mapHeroCard);
  } catch (error) {
    console.error("[about] unexpected error reading hero cards:", error);
    return [];
  }
}

async function readIntro(): Promise<AboutIntro> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("about_intro")
      .select(
        "hero_heading, hero_subtitle, statement_heading, paragraph, photo_url, location, email, phone",
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[about] failed to read intro:", error);
      return { ...EMPTY_INTRO };
    }

    return mapIntro((data as IntroRow | null) ?? null);
  } catch (error) {
    console.error("[about] unexpected error reading intro:", error);
    return { ...EMPTY_INTRO };
  }
}

async function readServices(): Promise<Service[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("services")
      .select("id, title, description, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error || !data) {
      if (error) console.error("[about] failed to read services:", error);
      return [];
    }

    return (data as ServiceRow[]).map(mapService);
  } catch (error) {
    console.error("[about] unexpected error reading services:", error);
    return [];
  }
}

async function readSkillCategories(): Promise<SkillCategory[]> {
  try {
    const admin = createAdminClient();
    const [categoriesResult, skillsResult] = await Promise.all([
      admin
        .from("skill_categories")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      admin
        .from("skills")
        .select("id, category_id, name, icon_url, sort_order")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (categoriesResult.error || !categoriesResult.data) {
      if (categoriesResult.error) {
        console.error(
          "[about] failed to read skill categories:",
          categoriesResult.error,
        );
      }
      return [];
    }

    if (skillsResult.error) {
      console.error("[about] failed to read skills:", skillsResult.error);
    }

    const skillsByCategory = new Map<string, Skill[]>();
    for (const row of (skillsResult.data as SkillRow[] | null) ?? []) {
      const key = String(row.category_id);
      const list = skillsByCategory.get(key) ?? [];
      list.push(mapSkill(row));
      skillsByCategory.set(key, list);
    }

    return (categoriesResult.data as CategoryRow[]).map((row) => ({
      id: String(row.id),
      name: text(row.name),
      sortOrder: Number(row.sort_order ?? 0),
      skills: skillsByCategory.get(String(row.id)) ?? [],
    }));
  } catch (error) {
    console.error("[about] unexpected error reading skill categories:", error);
    return [];
  }
}

async function readEducation(): Promise<EducationItem[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("education")
      .select("id, degree, school, year, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error || !data) {
      if (error) console.error("[about] failed to read education:", error);
      return [];
    }

    return (data as EducationRow[]).map(mapEducation);
  } catch (error) {
    console.error("[about] unexpected error reading education:", error);
    return [];
  }
}

/**
 * Public About reads. Each is cached with its own tag so the future public page
 * can stay static and revalidate surgically after an admin write.
 */
export async function getAboutHeroCards(): Promise<AboutHeroCard[]> {
  "use cache";
  cacheLife("max");
  cacheTag(ABOUT_HERO_TAG);
  return readHeroCards();
}

export async function getAboutIntro(): Promise<AboutIntro> {
  "use cache";
  cacheLife("max");
  cacheTag(ABOUT_INTRO_TAG);
  return readIntro();
}

export async function getServices(): Promise<Service[]> {
  "use cache";
  cacheLife("max");
  cacheTag(SERVICES_TAG);
  return readServices();
}

export async function getSkillCategories(): Promise<SkillCategory[]> {
  "use cache";
  cacheLife("max");
  cacheTag(SKILLS_TAG);
  return readSkillCategories();
}

export async function getEducation(): Promise<EducationItem[]> {
  "use cache";
  cacheLife("max");
  cacheTag(EDUCATION_TAG);
  return readEducation();
}

/**
 * Admin reads. Admin data must always be fresh, so these are intentionally
 * uncached and must only be called from an async component inside <Suspense>.
 */
export async function getAdminAboutHeroCards(): Promise<AboutHeroCard[]> {
  return readHeroCards();
}

export async function getAdminAboutIntro(): Promise<AboutIntro> {
  return readIntro();
}

export async function getAdminServices(): Promise<Service[]> {
  return readServices();
}

export async function getAdminSkillCategories(): Promise<SkillCategory[]> {
  return readSkillCategories();
}

export async function getAdminEducation(): Promise<EducationItem[]> {
  return readEducation();
}
