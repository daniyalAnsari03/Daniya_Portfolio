"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PROJECT_IMAGES_BUCKET,
  storagePathFromPublicUrl,
} from "@/lib/projects";
import {
  ABOUT_HERO_TAG,
  ABOUT_INTRO_TAG,
  DEFAULT_ABOUT_HERO_ADJUST,
  EDUCATION_TAG,
  isMissingColumnError,
  SERVICES_TAG,
  SKILLS_TAG,
  type AboutMediaType,
} from "@/lib/about";
import {
  clampCoverAdjust,
  type CoverAdjust,
} from "@/lib/cover-adjust";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_YEAR_LENGTH = 60;
const MAX_CONTACT_LENGTH = 200;

export type AboutActionResult = { ok: true } | { ok: false; error: string };

export type CreateAboutResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type AboutUploadTicket =
  | {
      ok: true;
      signedUrl: string;
      token: string;
      path: string;
      publicUrl: string;
    }
  | { ok: false; error: string };

export type AboutMediaUploadInput = {
  kind: AboutMediaType;
  fileName: string;
  contentType: string;
  size: number;
  scope?: string | null;
};

export type AboutIntroInput = {
  heroHeading: string;
  heroSubtitle: string;
  statementHeading: string;
  paragraph: string;
  photoUrl: string;
  location: string;
  email: string;
  phone: string;
};

export type ServiceInput = {
  title: string;
  description: string;
};

export type EducationInput = {
  degree: string;
  school: string;
  year: string;
};

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cleanScope(value: unknown): string {
  const scope = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{1,40}$/.test(scope) ? scope : "about";
}

function revalidateAbout(tags: string[]) {
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }
  revalidatePath("/about");
}

async function removeStoragePaths(paths: string[]) {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return;

  try {
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from(PROJECT_IMAGES_BUCKET)
      .remove(unique);
    if (error) {
      console.error("[about] failed to remove storage objects:", error);
    }
  } catch (error) {
    console.error("[about] unexpected storage cleanup error:", error);
  }
}

async function nextSortOrder(
  table: string,
  column?: { name: string; value: string },
): Promise<number> {
  const admin = createAdminClient();
  let query = admin
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  if (column) query = query.eq(column.name, column.value);

  const { data } = await query.maybeSingle();
  return Number(data?.sort_order ?? -1) + 1;
}

export async function createAboutMediaUpload(
  input: AboutMediaUploadInput,
): Promise<AboutUploadTicket> {
  await requireAdmin();

  const kind: AboutMediaType = input?.kind === "video" ? "video" : "image";
  const contentType = String(input?.contentType ?? "").toLowerCase();
  const size = Number(input?.size ?? 0);

  let extension: string;
  if (kind === "video") {
    if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
      return { ok: false, error: "Only MP4 or WebM videos are allowed." };
    }
    if (!Number.isFinite(size) || size <= 0) {
      return { ok: false, error: "That video could not be read." };
    }
    if (size > MAX_VIDEO_BYTES) {
      return { ok: false, error: "Videos must be 50 MB or smaller." };
    }
    extension = VIDEO_EXTENSIONS[contentType];
  } else {
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return { ok: false, error: "Only JPEG, PNG or WebP images are allowed." };
    }
    if (!Number.isFinite(size) || size <= 0) {
      return { ok: false, error: "That image could not be read." };
    }
    if (size > MAX_IMAGE_BYTES) {
      return { ok: false, error: "Images must be 10 MB or smaller." };
    }
    extension = IMAGE_EXTENSIONS[contentType];
  }

  const scope = cleanScope(input?.scope);
  const path = `about/${scope}/${Date.now()}-${randomUUID()}.${extension}`;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(PROJECT_IMAGES_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("[about] failed to sign upload:", error);
      return { ok: false, error: "Could not start the upload. Try again." };
    }

    const { data: publicUrlData } = admin.storage
      .from(PROJECT_IMAGES_BUCKET)
      .getPublicUrl(path);

    return {
      ok: true,
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      publicUrl: publicUrlData.publicUrl,
    };
  } catch (error) {
    console.error("[about] unexpected upload signing error:", error);
    return { ok: false, error: "Could not start the upload. Try again." };
  }
}

/* ------------------------------- Hero cards ------------------------------ */

export async function addAboutHeroCard(
  mediaType: AboutMediaType,
  fileUrl: string,
  adjust?: CoverAdjust,
): Promise<CreateAboutResult> {
  await requireAdmin();

  if (mediaType !== "image" && mediaType !== "video") {
    return { ok: false, error: "Choose an image or a video for the card." };
  }

  const url = String(fileUrl ?? "").trim();
  if (!isValidUrl(url)) {
    return { ok: false, error: "The uploaded file could not be added." };
  }

  try {
    const admin = createAdminClient();
    const sortOrder = await nextSortOrder("about_hero_cards");
    // A new card is cropped to its box, exactly like the existing ones.
    const framing = clampCoverAdjust(
      adjust ?? DEFAULT_ABOUT_HERO_ADJUST,
      DEFAULT_ABOUT_HERO_ADJUST,
    );

    let result = await admin
      .from("about_hero_cards")
      .insert({
        media_type: mediaType,
        file_url: url,
        sort_order: sortOrder,
        cover_fit: framing.fit,
        cover_pos_x: framing.posX,
        cover_pos_y: framing.posY,
        cover_zoom: framing.zoom,
      })
      .select("id")
      .single();

    if (result.error && isMissingColumnError(result.error)) {
      // The framing columns are not migrated yet — add the card without them
      // so the About page keeps working. The framing can be saved once
      // supabase/migrations/006_homepage_admin.sql has been applied.
      result = await admin
        .from("about_hero_cards")
        .insert({ media_type: mediaType, file_url: url, sort_order: sortOrder })
        .select("id")
        .single();
    }

    if (result.error || !result.data) {
      return { ok: false, error: "Could not add the hero card." };
    }

    revalidateAbout([ABOUT_HERO_TAG]);
    return { ok: true, id: String(result.data.id) };
  } catch (error) {
    console.error("[about] unexpected hero card add error:", error);
    return { ok: false, error: "Could not add the hero card." };
  }
}

export async function deleteAboutHeroCard(
  id: string,
): Promise<AboutActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing hero card id." };
  }

  try {
    const admin = createAdminClient();
    const { data: card, error: readError } = await admin
      .from("about_hero_cards")
      .select("file_url")
      .eq("id", id)
      .maybeSingle();

    if (readError || !card) {
      return { ok: false, error: "Hero card not found." };
    }

    const { error } = await admin
      .from("about_hero_cards")
      .delete()
      .eq("id", id);

    if (error) {
      return { ok: false, error: "Could not delete the hero card." };
    }

    const path = storagePathFromPublicUrl(String(card.file_url));
    if (path) await removeStoragePaths([path]);

    revalidateAbout([ABOUT_HERO_TAG]);
    return { ok: true };
  } catch (error) {
    console.error("[about] unexpected hero card delete error:", error);
    return { ok: false, error: "Could not delete the hero card." };
  }
}

export async function reorderAboutHeroCards(
  orderedIds: string[],
): Promise<AboutActionResult> {
  await requireAdmin();

  const ids = Array.isArray(orderedIds)
    ? Array.from(new Set(orderedIds.filter(isValidId)))
    : [];

  if (ids.length === 0) {
    return { ok: false, error: "No hero cards to reorder." };
  }

  try {
    const admin = createAdminClient();
    const results = await Promise.all(
      ids.map((id, index) =>
        admin.from("about_hero_cards").update({ sort_order: index }).eq("id", id),
      ),
    );

    if (results.some((result) => result.error)) {
      return { ok: false, error: "Could not reorder the hero cards." };
    }
  } catch (error) {
    console.error("[about] unexpected hero card reorder error:", error);
    return { ok: false, error: "Could not reorder the hero cards." };
  }

  revalidateAbout([ABOUT_HERO_TAG]);
  return { ok: true };
}

/**
 * Saves the framing (fit, focus point, zoom) of one hero card. The uploaded
 * file is never touched — only the rendering of the card changes.
 */
export async function updateAboutHeroCardAdjust(
  id: string,
  adjust: CoverAdjust,
): Promise<AboutActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing hero card id." };
  }

  const clamped = clampCoverAdjust(adjust, DEFAULT_ABOUT_HERO_ADJUST);

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("about_hero_cards")
      .update({
        cover_fit: clamped.fit,
        cover_pos_x: clamped.posX,
        cover_pos_y: clamped.posY,
        cover_zoom: clamped.zoom,
      })
      .eq("id", id);

    if (error) {
      if (isMissingColumnError(error)) {
        return {
          ok: false,
          error:
            "Apply supabase/migrations/006_homepage_admin.sql to enable the framing of the hero cards.",
        };
      }
      return { ok: false, error: "Could not save the hero card framing." };
    }
  } catch (error) {
    console.error("[about] unexpected hero card adjust error:", error);
    return { ok: false, error: "Could not save the hero card framing." };
  }

  revalidateAbout([ABOUT_HERO_TAG]);
  return { ok: true };
}

/* --------------------------------- Intro --------------------------------- */
export async function saveAboutIntro(
  input: AboutIntroInput,
): Promise<AboutActionResult> {
  await requireAdmin();

  const heroHeading = String(input?.heroHeading ?? "").trim();
  const heroSubtitle = String(input?.heroSubtitle ?? "").trim();
  const statementHeading = String(input?.statementHeading ?? "").trim();
  const paragraph = String(input?.paragraph ?? "").trim();
  const photoUrl = String(input?.photoUrl ?? "").trim();
  const location = String(input?.location ?? "").trim();
  const email = String(input?.email ?? "").trim();
  const phone = String(input?.phone ?? "").trim();

  if (heroHeading.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Hero heading must be ${MAX_TITLE_LENGTH} characters or fewer.`,
    };
  }
  if (statementHeading.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Statement heading must be ${MAX_TITLE_LENGTH} characters or fewer.`,
    };
  }
  if (paragraph.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Paragraph must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
    };
  }
  if (photoUrl && !isValidUrl(photoUrl)) {
    return { ok: false, error: "The photo URL is not valid." };
  }
  if (location.length > MAX_CONTACT_LENGTH || email.length > MAX_CONTACT_LENGTH) {
    return { ok: false, error: "Contact details are too long." };
  }

  try {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("about_intro")
      .select("photo_url")
      .limit(1)
      .maybeSingle();

    const previousPhoto = existing?.photo_url
      ? String(existing.photo_url)
      : "";

    const { error } = await admin.from("about_intro").upsert(
      {
        is_singleton: true,
        hero_heading: heroHeading || null,
        hero_subtitle: heroSubtitle || null,
        statement_heading: statementHeading || null,
        paragraph: paragraph || null,
        photo_url: photoUrl || null,
        location: location || null,
        email: email || null,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "is_singleton" },
    );

    if (error) {
      return { ok: false, error: "Could not save the intro. Please try again." };
    }

    if (previousPhoto && previousPhoto !== photoUrl) {
      const path = storagePathFromPublicUrl(previousPhoto);
      if (path) await removeStoragePaths([path]);
    }

    revalidateAbout([ABOUT_INTRO_TAG]);
    return { ok: true };
  } catch (error) {
    console.error("[about] unexpected intro save error:", error);
    return { ok: false, error: "Could not save the intro. Please try again." };
  }
}

/* -------------------------------- Services ------------------------------- */

export async function createService(
  input: ServiceInput,
): Promise<CreateAboutResult> {
  await requireAdmin();

  const title = String(input?.title ?? "").trim();
  const description = String(input?.description ?? "").trim();

  if (!title) return { ok: false, error: "Service title is required." };
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Service title must be ${MAX_TITLE_LENGTH} characters or fewer.`,
    };
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
    };
  }

  try {
    const admin = createAdminClient();
    const sortOrder = await nextSortOrder("services");
    const { data, error } = await admin
      .from("services")
      .insert({ title, description: description || null, sort_order: sortOrder })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: "Could not add the service." };
    }

    revalidateAbout([SERVICES_TAG]);
    return { ok: true, id: String(data.id) };
  } catch (error) {
    console.error("[about] unexpected service create error:", error);
    return { ok: false, error: "Could not add the service." };
  }
}

export async function updateService(
  id: string,
  input: ServiceInput,
): Promise<AboutActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing service id." };
  }

  const title = String(input?.title ?? "").trim();
  const description = String(input?.description ?? "").trim();

  if (!title) return { ok: false, error: "Service title is required." };
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Service title must be ${MAX_TITLE_LENGTH} characters or fewer.`,
    };
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
    };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("services")
      .update({ title, description: description || null })
      .eq("id", id);

    if (error) {
      return { ok: false, error: "Could not update the service." };
    }
  } catch (error) {
    console.error("[about] unexpected service update error:", error);
    return { ok: false, error: "Could not update the service." };
  }

  revalidateAbout([SERVICES_TAG]);
  return { ok: true };
}

export async function deleteService(id: string): Promise<AboutActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing service id." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("services").delete().eq("id", id);
    if (error) {
      return { ok: false, error: "Could not delete the service." };
    }
  } catch (error) {
    console.error("[about] unexpected service delete error:", error);
    return { ok: false, error: "Could not delete the service." };
  }

  revalidateAbout([SERVICES_TAG]);
  return { ok: true };
}

export async function reorderServices(
  orderedIds: string[],
): Promise<AboutActionResult> {
  await requireAdmin();

  const ids = Array.isArray(orderedIds)
    ? Array.from(new Set(orderedIds.filter(isValidId)))
    : [];

  if (ids.length === 0) {
    return { ok: false, error: "No services to reorder." };
  }

  try {
    const admin = createAdminClient();
    const results = await Promise.all(
      ids.map((id, index) =>
        admin.from("services").update({ sort_order: index }).eq("id", id),
      ),
    );

    if (results.some((result) => result.error)) {
      return { ok: false, error: "Could not reorder the services." };
    }
  } catch (error) {
    console.error("[about] unexpected service reorder error:", error);
    return { ok: false, error: "Could not reorder the services." };
  }

  revalidateAbout([SERVICES_TAG]);
  return { ok: true };
}

/* ---------------------------- Skill categories --------------------------- */

export async function createSkillCategory(
  name: string,
): Promise<CreateAboutResult> {
  await requireAdmin();

  const value = String(name ?? "").trim();
  if (!value) return { ok: false, error: "Category name is required." };
  if (value.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Category name must be ${MAX_TITLE_LENGTH} characters or fewer.`,
    };
  }

  try {
    const admin = createAdminClient();
    const sortOrder = await nextSortOrder("skill_categories");
    const { data, error } = await admin
      .from("skill_categories")
      .insert({ name: value, sort_order: sortOrder })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: "Could not add the category." };
    }

    revalidateAbout([SKILLS_TAG]);
    return { ok: true, id: String(data.id) };
  } catch (error) {
    console.error("[about] unexpected category create error:", error);
    return { ok: false, error: "Could not add the category." };
  }
}

export async function renameSkillCategory(
  id: string,
  name: string,
): Promise<AboutActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing category id." };
  }

  const value = String(name ?? "").trim();
  if (!value) return { ok: false, error: "Category name is required." };
  if (value.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Category name must be ${MAX_TITLE_LENGTH} characters or fewer.`,
    };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("skill_categories")
      .update({ name: value })
      .eq("id", id);

    if (error) {
      return { ok: false, error: "Could not rename the category." };
    }
  } catch (error) {
    console.error("[about] unexpected category rename error:", error);
    return { ok: false, error: "Could not rename the category." };
  }

  revalidateAbout([SKILLS_TAG]);
  return { ok: true };
}

export async function deleteSkillCategory(
  id: string,
): Promise<AboutActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing category id." };
  }

  try {
    const admin = createAdminClient();
    const { data: skills } = await admin
      .from("skills")
      .select("icon_url")
      .eq("category_id", id);

    const { error } = await admin
      .from("skill_categories")
      .delete()
      .eq("id", id);

    if (error) {
      return { ok: false, error: "Could not delete the category." };
    }

    const paths = (skills ?? [])
      .map((skill) =>
        skill?.icon_url ? storagePathFromPublicUrl(String(skill.icon_url)) : null,
      )
      .filter((path): path is string => Boolean(path));
    await removeStoragePaths(paths);

    revalidateAbout([SKILLS_TAG]);
    return { ok: true };
  } catch (error) {
    console.error("[about] unexpected category delete error:", error);
    return { ok: false, error: "Could not delete the category." };
  }
}

export async function reorderSkillCategories(
  orderedIds: string[],
): Promise<AboutActionResult> {
  await requireAdmin();

  const ids = Array.isArray(orderedIds)
    ? Array.from(new Set(orderedIds.filter(isValidId)))
    : [];

  if (ids.length === 0) {
    return { ok: false, error: "No categories to reorder." };
  }

  try {
    const admin = createAdminClient();
    const results = await Promise.all(
      ids.map((id, index) =>
        admin
          .from("skill_categories")
          .update({ sort_order: index })
          .eq("id", id),
      ),
    );

    if (results.some((result) => result.error)) {
      return { ok: false, error: "Could not reorder the categories." };
    }
  } catch (error) {
    console.error("[about] unexpected category reorder error:", error);
    return { ok: false, error: "Could not reorder the categories." };
  }

  revalidateAbout([SKILLS_TAG]);
  return { ok: true };
}

/* --------------------------------- Skills -------------------------------- */

export async function createSkill(
  categoryId: string,
  name: string,
  iconUrl: string,
): Promise<CreateAboutResult> {
  await requireAdmin();

  if (!isValidId(categoryId)) {
    return { ok: false, error: "Missing category id." };
  }

  const value = String(name ?? "").trim();
  const icon = String(iconUrl ?? "").trim();

  if (!value) return { ok: false, error: "Skill name is required." };
  if (value.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Skill name must be ${MAX_TITLE_LENGTH} characters or fewer.`,
    };
  }
  if (icon && !isValidUrl(icon)) {
    return { ok: false, error: "The skill icon URL is not valid." };
  }

  try {
    const admin = createAdminClient();
    const sortOrder = await nextSortOrder("skills", {
      name: "category_id",
      value: categoryId,
    });
    const { data, error } = await admin
      .from("skills")
      .insert({
        category_id: categoryId,
        name: value,
        icon_url: icon || null,
        sort_order: sortOrder,
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: "Could not add the skill." };
    }

    revalidateAbout([SKILLS_TAG]);
    return { ok: true, id: String(data.id) };
  } catch (error) {
    console.error("[about] unexpected skill create error:", error);
    return { ok: false, error: "Could not add the skill." };
  }
}

export async function updateSkill(
  id: string,
  name: string,
  iconUrl: string,
): Promise<AboutActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing skill id." };
  }

  const value = String(name ?? "").trim();
  const icon = String(iconUrl ?? "").trim();

  if (!value) return { ok: false, error: "Skill name is required." };
  if (value.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Skill name must be ${MAX_TITLE_LENGTH} characters or fewer.`,
    };
  }
  if (icon && !isValidUrl(icon)) {
    return { ok: false, error: "The skill icon URL is not valid." };
  }

  try {
    const admin = createAdminClient();
    const { data: existing, error: readError } = await admin
      .from("skills")
      .select("icon_url")
      .eq("id", id)
      .maybeSingle();

    if (readError || !existing) {
      return { ok: false, error: "Skill not found." };
    }

    const { error } = await admin
      .from("skills")
      .update({ name: value, icon_url: icon || null })
      .eq("id", id);

    if (error) {
      return { ok: false, error: "Could not update the skill." };
    }

    const previousIcon = existing.icon_url ? String(existing.icon_url) : "";
    if (previousIcon && previousIcon !== icon) {
      const path = storagePathFromPublicUrl(previousIcon);
      if (path) await removeStoragePaths([path]);
    }
  } catch (error) {
    console.error("[about] unexpected skill update error:", error);
    return { ok: false, error: "Could not update the skill." };
  }

  revalidateAbout([SKILLS_TAG]);
  return { ok: true };
}

export async function deleteSkill(id: string): Promise<AboutActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing skill id." };
  }

  try {
    const admin = createAdminClient();
    const { data: skill, error: readError } = await admin
      .from("skills")
      .select("icon_url")
      .eq("id", id)
      .maybeSingle();

    if (readError || !skill) {
      return { ok: false, error: "Skill not found." };
    }

    const { error } = await admin.from("skills").delete().eq("id", id);
    if (error) {
      return { ok: false, error: "Could not delete the skill." };
    }

    const path = skill.icon_url
      ? storagePathFromPublicUrl(String(skill.icon_url))
      : null;
    if (path) await removeStoragePaths([path]);

    revalidateAbout([SKILLS_TAG]);
    return { ok: true };
  } catch (error) {
    console.error("[about] unexpected skill delete error:", error);
    return { ok: false, error: "Could not delete the skill." };
  }
}

export async function reorderSkills(
  categoryId: string,
  orderedIds: string[],
): Promise<AboutActionResult> {
  await requireAdmin();

  if (!isValidId(categoryId)) {
    return { ok: false, error: "Missing category id." };
  }

  const ids = Array.isArray(orderedIds)
    ? Array.from(new Set(orderedIds.filter(isValidId)))
    : [];

  if (ids.length === 0) {
    return { ok: false, error: "No skills to reorder." };
  }

  try {
    const admin = createAdminClient();
    const results = await Promise.all(
      ids.map((id, index) =>
        admin
          .from("skills")
          .update({ sort_order: index })
          .eq("id", id)
          .eq("category_id", categoryId),
      ),
    );

    if (results.some((result) => result.error)) {
      return { ok: false, error: "Could not reorder the skills." };
    }
  } catch (error) {
    console.error("[about] unexpected skill reorder error:", error);
    return { ok: false, error: "Could not reorder the skills." };
  }

  revalidateAbout([SKILLS_TAG]);
  return { ok: true };
}

/* ------------------------------- Education ------------------------------- */

export async function createEducation(
  input: EducationInput,
): Promise<CreateAboutResult> {
  await requireAdmin();

  const degree = String(input?.degree ?? "").trim();
  const school = String(input?.school ?? "").trim();
  const year = String(input?.year ?? "").trim();

  if (!degree) return { ok: false, error: "Degree is required." };
  if (!school) return { ok: false, error: "School is required." };
  if (degree.length > MAX_TITLE_LENGTH || school.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Degree and school must be ${MAX_TITLE_LENGTH} characters or fewer.`,
    };
  }
  if (year.length > MAX_YEAR_LENGTH) {
    return {
      ok: false,
      error: `Year must be ${MAX_YEAR_LENGTH} characters or fewer.`,
    };
  }

  try {
    const admin = createAdminClient();
    const sortOrder = await nextSortOrder("education");
    const { data, error } = await admin
      .from("education")
      .insert({
        degree,
        school,
        year: year || null,
        sort_order: sortOrder,
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: "Could not add the education entry." };
    }

    revalidateAbout([EDUCATION_TAG]);
    return { ok: true, id: String(data.id) };
  } catch (error) {
    console.error("[about] unexpected education create error:", error);
    return { ok: false, error: "Could not add the education entry." };
  }
}

export async function updateEducation(
  id: string,
  input: EducationInput,
): Promise<AboutActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing education id." };
  }

  const degree = String(input?.degree ?? "").trim();
  const school = String(input?.school ?? "").trim();
  const year = String(input?.year ?? "").trim();

  if (!degree) return { ok: false, error: "Degree is required." };
  if (!school) return { ok: false, error: "School is required." };
  if (degree.length > MAX_TITLE_LENGTH || school.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Degree and school must be ${MAX_TITLE_LENGTH} characters or fewer.`,
    };
  }
  if (year.length > MAX_YEAR_LENGTH) {
    return {
      ok: false,
      error: `Year must be ${MAX_YEAR_LENGTH} characters or fewer.`,
    };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("education")
      .update({ degree, school, year: year || null })
      .eq("id", id);

    if (error) {
      return { ok: false, error: "Could not update the education entry." };
    }
  } catch (error) {
    console.error("[about] unexpected education update error:", error);
    return { ok: false, error: "Could not update the education entry." };
  }

  revalidateAbout([EDUCATION_TAG]);
  return { ok: true };
}

export async function deleteEducation(
  id: string,
): Promise<AboutActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing education id." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("education").delete().eq("id", id);
    if (error) {
      return { ok: false, error: "Could not delete the education entry." };
    }
  } catch (error) {
    console.error("[about] unexpected education delete error:", error);
    return { ok: false, error: "Could not delete the education entry." };
  }

  revalidateAbout([EDUCATION_TAG]);
  return { ok: true };
}

export async function reorderEducation(
  orderedIds: string[],
): Promise<AboutActionResult> {
  await requireAdmin();

  const ids = Array.isArray(orderedIds)
    ? Array.from(new Set(orderedIds.filter(isValidId)))
    : [];

  if (ids.length === 0) {
    return { ok: false, error: "No education entries to reorder." };
  }

  try {
    const admin = createAdminClient();
    const results = await Promise.all(
      ids.map((id, index) =>
        admin.from("education").update({ sort_order: index }).eq("id", id),
      ),
    );

    if (results.some((result) => result.error)) {
      return { ok: false, error: "Could not reorder the education entries." };
    }
  } catch (error) {
    console.error("[about] unexpected education reorder error:", error);
    return { ok: false, error: "Could not reorder the education entries." };
  }

  revalidateAbout([EDUCATION_TAG]);
  return { ok: true };
}
