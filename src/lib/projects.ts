import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clampCoverAdjust,
  DEFAULT_COVER_ADJUST,
  type CoverAdjust,
} from "@/lib/cover-adjust";

/** Cache tag shared by public project reads. Revalidate after every write. */
export const PROJECTS_TAG = "projects";

/** Public storage bucket that holds original project images. */
export const PROJECT_IMAGES_BUCKET = "project-images";

export type ProjectImage = {
  id: string;
  url: string;
  sortOrder: number;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  demoLink: string;
  coverImageUrl: string;
  /** Framing of the cover image inside the card (fit, focus point, zoom). */
  coverAdjust: CoverAdjust;
  sortOrder: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
  images: ProjectImage[];
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  tech_stack: string[] | null;
  demo_link: string | null;
  cover_image_url: string | null;
  cover_fit: string | null;
  cover_pos_x: number | string | null;
  cover_pos_y: number | string | null;
  cover_zoom: number | string | null;
  sort_order: number | null;
  is_visible: boolean | null;
  created_at: string;
  updated_at: string;
};

type ProjectImageRow = {
  id: string;
  image_url: string;
  sort_order: number | null;
};

function toNumber(
  value: number | string | null | undefined,
  fallback: number,
): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapProject(row: ProjectRow, images: ProjectImage[]): Project {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : "",
    techStack: Array.isArray(row.tech_stack)
      ? row.tech_stack.map((tech) => String(tech))
      : [],
    demoLink: row.demo_link ? String(row.demo_link) : "",
    coverImageUrl: row.cover_image_url ? String(row.cover_image_url) : "",
    coverAdjust: clampCoverAdjust({
      fit: row.cover_fit === "cover" ? "cover" : "contain",
      posX: toNumber(row.cover_pos_x, DEFAULT_COVER_ADJUST.posX),
      posY: toNumber(row.cover_pos_y, DEFAULT_COVER_ADJUST.posY),
      zoom: toNumber(row.cover_zoom, DEFAULT_COVER_ADJUST.zoom),
    }),
    sortOrder: Number(row.sort_order ?? 0),
    visible: Boolean(row.is_visible),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    images,
  };
}

function mapImage(row: ProjectImageRow): ProjectImage {
  return {
    id: String(row.id),
    url: String(row.image_url),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

/** Columns read from `projects`, including the cover framing. */
const PROJECT_COLUMNS =
  "id, name, description, tech_stack, demo_link, cover_image_url, cover_fit, cover_pos_x, cover_pos_y, cover_zoom, sort_order, is_visible, created_at, updated_at";

/** Columns read when the cover framing columns do not exist yet. */
const PROJECT_COLUMNS_LEGACY =
  "id, name, description, tech_stack, demo_link, cover_image_url, sort_order, is_visible, created_at, updated_at";

/**
 * True when Postgres/PostgREST reports a missing column, which means the
 * cover framing migration has not been applied yet.
 */
export function isMissingColumnError(error: {
  code?: string;
  message?: string;
}) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("cover_fit") ||
    message.includes("cover_pos_x")
  );
}

async function readProjects(onlyVisible: boolean): Promise<Project[]> {
  try {
    const admin = createAdminClient();
    let query = admin
      .from("projects")
      .select(PROJECT_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (onlyVisible) {
      query = query.eq("is_visible", true);
    }

    const { data, error } = await query;
    let rows: ProjectRow[] = [];

    if (error) {
      if (!isMissingColumnError(error)) {
        console.error("[projects] failed to read projects:", error);
        return [];
      }

      // The cover framing columns are not there yet (the migration is applied
      // manually). Read the projects anyway and use the default framing, so
      // the public page keeps working.
      console.warn(
        "[projects] cover framing columns are missing — apply supabase/migrations/005_project_cover_adjust.sql",
      );

      let legacyQuery = admin
        .from("projects")
        .select(PROJECT_COLUMNS_LEGACY)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (onlyVisible) {
        legacyQuery = legacyQuery.eq("is_visible", true);
      }

      const legacy = await legacyQuery;

      if (legacy.error || !legacy.data) {
        if (legacy.error) {
          console.error("[projects] failed to read projects:", legacy.error);
        }
        return [];
      }

      rows = legacy.data as ProjectRow[];
    } else {
      rows = (data ?? []) as ProjectRow[];
    }

    // Fetch every gallery in parallel; preserve project order when joining.
    const imageResults = await Promise.all(
      rows.map((row) =>
        admin
          .from("project_images")
          .select("id, image_url, sort_order")
          .eq("project_id", row.id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ),
    );

    return rows.map((row, index) => {
      const result = imageResults[index];
      if (result.error || !result.data) {
        if (result.error) {
          console.error(
            `[projects] failed to read images for ${row.id}:`,
            result.error,
          );
        }
        return mapProject(row, []);
      }
      return mapProject(
        row,
        (result.data as ProjectImageRow[]).map(mapImage),
      );
    });
  } catch (error) {
    console.error("[projects] unexpected error reading projects:", error);
    return [];
  }
}

/**
 * Public projects for the homepage Works section. Cached with the shared
 * `projects` tag; the page stays static and revalidates on-demand after a
 * project write.
 */
export async function getProjects(): Promise<Project[]> {
  "use cache";
  cacheLife("max");
  cacheTag(PROJECTS_TAG);

  return readProjects(true);
}

/**
 * Full project list for the admin UI. Admin data must always be fresh, so this
 * is intentionally uncached and must be read inside a <Suspense> boundary.
 */
export async function getAdminProjects(): Promise<Project[]> {
  return readProjects(false);
}

/**
 * Turn a public storage URL back into an object path inside the project-images
 * bucket so it can be removed. Returns null for external/unrecognised URLs.
 */
export function storagePathFromPublicUrl(url: string): string | null {
  if (!url) return null;

  const marker = `/storage/v1/object/public/${PROJECT_IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;

  const path = url.slice(index + marker.length).split("?")[0];
  if (!path) return null;

  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
