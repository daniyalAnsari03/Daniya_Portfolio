import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { clampCoverAdjust, DEFAULT_CARD_ADJUST } from "@/lib/cover-adjust";
import {
  HOMEPAGE_DEFAULTS,
  HOMEPAGE_STOCK_CARDS,
  type HomepageCard,
  type HomepageContent,
} from "@/lib/homepage-defaults";

/** Cache tag shared by every homepage read. Revalidate after a write. */
export const HOMEPAGE_TAG = "homepage";

/** The migration that creates the homepage tables (applied manually). */
export const HOMEPAGE_MIGRATION = "supabase/migrations/006_homepage_admin.sql";

export type { HomepageCard, HomepageContent };

type ContentRow = {
  id: number;
  hero_line1: string | null;
  hero_line2: string | null;
  hero_subtitle: string | null;
  cover_label: string | null;
  cover_heading1: string | null;
  cover_heading2: string | null;
  reel_label: string | null;
  reel_video_url: string | null;
  works_heading: string | null;
  contact_line1: string | null;
  contact_line2: string | null;
  contact_accent_word: string | null;
};

type CardRow = {
  id: string;
  image_url: string;
  sort_order: number | null;
  visible: boolean | null;
  cover_fit: string | null;
  cover_pos_x: number | string | null;
  cover_pos_y: number | string | null;
  cover_zoom: number | string | null;
};

const CONTENT_COLUMNS =
  "id, hero_line1, hero_line2, hero_subtitle, cover_label, cover_heading1, cover_heading2, reel_label, reel_video_url, works_heading, contact_line1, contact_line2, contact_accent_word";

const CARD_COLUMNS =
  "id, image_url, sort_order, visible, cover_fit, cover_pos_x, cover_pos_y, cover_zoom";

function text(value: string | null | undefined): string {
  return typeof value === "string" ? value : "";
}

function toNumber(
  value: number | string | null | undefined,
  fallback: number,
): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** True when the error means "the table (or a column) does not exist". */
export function isMissingHomepageTable(error: {
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

function mapContent(row: ContentRow | null): HomepageContent {
  if (!row) return { ...HOMEPAGE_DEFAULTS };

  return {
    hero: {
      line1: text(row.hero_line1) || HOMEPAGE_DEFAULTS.hero.line1,
      line2: text(row.hero_line2) || HOMEPAGE_DEFAULTS.hero.line2,
      subtitle: text(row.hero_subtitle) || HOMEPAGE_DEFAULTS.hero.subtitle,
    },
    cover: {
      label: text(row.cover_label) || HOMEPAGE_DEFAULTS.cover.label,
      heading1: text(row.cover_heading1) || HOMEPAGE_DEFAULTS.cover.heading1,
      heading2: text(row.cover_heading2) || HOMEPAGE_DEFAULTS.cover.heading2,
      reelLabel: text(row.reel_label) || HOMEPAGE_DEFAULTS.cover.reelLabel,
      reelVideoUrl: text(row.reel_video_url),
    },
    works: {
      heading: text(row.works_heading) || HOMEPAGE_DEFAULTS.works.heading,
    },
    contact: {
      line1: text(row.contact_line1) || HOMEPAGE_DEFAULTS.contact.line1,
      line2: text(row.contact_line2) || HOMEPAGE_DEFAULTS.contact.line2,
      accentWord:
        text(row.contact_accent_word) || HOMEPAGE_DEFAULTS.contact.accentWord,
    },
  };
}

function mapCard(row: CardRow): HomepageCard {
  return {
    id: String(row.id),
    src: text(row.image_url),
    alt: "",
    adjust: clampCoverAdjust(
      {
        fit:
          row.cover_fit === "cover"
            ? "cover"
            : row.cover_fit === "contain"
              ? "contain"
              : undefined,
        posX: toNumber(row.cover_pos_x, DEFAULT_CARD_ADJUST.posX),
        posY: toNumber(row.cover_pos_y, DEFAULT_CARD_ADJUST.posY),
        zoom: toNumber(row.cover_zoom, DEFAULT_CARD_ADJUST.zoom),
      },
      DEFAULT_CARD_ADJUST,
    ),
    visible: row.visible !== false,
  };
}

async function readContent(): Promise<HomepageContent> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("homepage_content")
      .select(CONTENT_COLUMNS)
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.warn(
        `[homepage] the homepage_content table is not available — using the defaults. Apply ${HOMEPAGE_MIGRATION}:`,
        error.message,
      );
      return { ...HOMEPAGE_DEFAULTS };
    }

    return mapContent((data as ContentRow | null) ?? null);
  } catch (error) {
    console.error("[homepage] unexpected error reading the content:", error);
    return { ...HOMEPAGE_DEFAULTS };
  }
}

async function readCards(): Promise<HomepageCard[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("homepage_cards")
      .select(CARD_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.warn(
        `[homepage] the homepage_cards table is not available — using the stock cards. Apply ${HOMEPAGE_MIGRATION}:`,
        error.message,
      );
      return [];
    }

    return ((data ?? []) as CardRow[]).map(mapCard);
  } catch (error) {
    console.error("[homepage] unexpected error reading the cards:", error);
    return [];
  }
}

/**
 * The homepage content. Cached with the `homepage` tag; the page stays static
 * and revalidates on demand after a write.
 */
export async function getHomepageContent(): Promise<HomepageContent> {
  "use cache";
  cacheLife("max");
  cacheTag(HOMEPAGE_TAG);

  return readContent();
}

/**
 * The homepage cards. Cached with the `homepage` tag.
 *
 * The stock cards are the fallback: they are only used while the database has
 * no visible card of its own. As soon as the admin saves one, the homepage
 * shows the database cards only.
 */
export async function getHomepageCards(): Promise<HomepageCard[]> {
  "use cache";
  cacheLife("max");
  cacheTag(HOMEPAGE_TAG);

  const cards = await readCards();
  const visible = cards.filter((card) => card.visible && card.src);
  return visible.length > 0 ? visible : HOMEPAGE_STOCK_CARDS;
}

/** The full homepage state for the admin UI (never cached, always fresh). */
export async function getAdminHomepage(): Promise<{
  content: HomepageContent;
  cards: HomepageCard[];
}> {
  const [content, cards] = await Promise.all([readContent(), readCards()]);
  return { content, cards };
}
