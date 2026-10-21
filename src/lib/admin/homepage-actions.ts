"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  HOMEPAGE_MIGRATION,
  HOMEPAGE_TAG,
  isMissingHomepageTable,
} from "@/lib/homepage";
import {
  PROJECT_IMAGES_BUCKET,
  storagePathFromPublicUrl,
} from "@/lib/projects";
import {
  clampCoverAdjust,
  DEFAULT_CARD_ADJUST,
  type CoverAdjust,
} from "@/lib/cover-adjust";
import {
  HOMEPAGE_TEXT_LIMITS,
  type HomepageContentInput,
} from "@/lib/homepage-defaults";

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

export type HomepageActionResult = { ok: true } | { ok: false; error: string };

export type HomepageUploadTicket =
  | {
      ok: true;
      signedUrl: string;
      token: string;
      path: string;
      publicUrl: string;
    }
  | { ok: false; error: string };

export type HomepageCardInput = {
  imageUrl: string;
  coverAdjust: CoverAdjust;
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

function limit(value: unknown, max: number, label: string) {
  const text = String(value ?? "").trim();
  if (text.length > max) {
    return { ok: false as const, error: `${label} must be ${max} characters or fewer.` };
  }
  return { ok: true as const, value: text };
}

/**
 * The homepage tables are created by a migration that is applied manually, so
 * a write can fail with a missing table. The admin is told exactly what to do.
 */
function missingTableError(error: { code?: string; message?: string }) {
  if (!isMissingHomepageTable(error)) return null;
  return `Apply ${HOMEPAGE_MIGRATION} first.`;
}

function revalidateHomepage() {
  revalidateTag(HOMEPAGE_TAG, { expire: 0 });
  revalidatePath("/");
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
      console.error("[homepage] failed to remove storage objects:", error);
    }
  } catch (error) {
    console.error("[homepage] unexpected storage cleanup error:", error);
  }
}

/* ------------------------------- Uploads ---------------------------------- */

/**
 * A signed upload URL for a homepage card image. The file lands in the
 * `homepage/` folder of the existing public bucket; the original is never
 * modified.
 */
export async function createHomepageCardUpload(input: {
  fileName: string;
  contentType: string;
  size: number;
}): Promise<HomepageUploadTicket> {
  await requireAdmin();

  const contentType = String(input?.contentType ?? "").toLowerCase();
  const size = Number(input?.size ?? 0);

  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return { ok: false, error: "Only JPEG, PNG or WebP images are allowed." };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: "That image could not be read." };
  }
  if (size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Images must be 10 MB or smaller." };
  }

  const extension = IMAGE_EXTENSIONS[contentType];
  const path = `homepage/${Date.now()}-${randomUUID()}.${extension}`;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(PROJECT_IMAGES_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("[homepage] failed to sign the card upload:", error);
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
    console.error("[homepage] unexpected upload signing error:", error);
    return { ok: false, error: "Could not start the upload. Try again." };
  }
}

/**
 * A signed upload URL for the reel video. The file lands in the
 * `homepage/reel/` folder of the existing public bucket.
 */
export async function createHomepageReelUpload(input: {
  fileName: string;
  contentType: string;
  size: number;
}): Promise<HomepageUploadTicket> {
  await requireAdmin();

  const contentType = String(input?.contentType ?? "").toLowerCase();
  const size = Number(input?.size ?? 0);

  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    return { ok: false, error: "Only MP4 or WebM videos are allowed." };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: "That video could not be read." };
  }
  if (size > MAX_VIDEO_BYTES) {
    return { ok: false, error: "Videos must be 50 MB or smaller." };
  }

  const extension = VIDEO_EXTENSIONS[contentType];
  const path = `homepage/reel/${Date.now()}-${randomUUID()}.${extension}`;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(PROJECT_IMAGES_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("[homepage] failed to sign the reel upload:", error);
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
    console.error("[homepage] unexpected upload signing error:", error);
    return { ok: false, error: "Could not start the upload. Try again." };
  }
}

/* -------------------------------- Content --------------------------------- */

/**
 * Saves the homepage copy. Every field is trimmed and length-checked; an
 * empty field falls back to the default in the read layer.
 */
export async function saveHomepageContent(
  input: HomepageContentInput,
): Promise<HomepageActionResult> {
  await requireAdmin();

  const fields: [keyof HomepageContentInput, number, string][] = [
    ["heroLine1", HOMEPAGE_TEXT_LIMITS.headline, "Headline line 1"],
    ["heroLine2", HOMEPAGE_TEXT_LIMITS.headline, "Headline line 2"],
    ["heroSubtitle", HOMEPAGE_TEXT_LIMITS.subtitle, "Subtitle"],
    ["coverLabel", HOMEPAGE_TEXT_LIMITS.label, "Cover label"],
    ["coverHeading1", HOMEPAGE_TEXT_LIMITS.headline, "Cover heading line 1"],
    ["coverHeading2", HOMEPAGE_TEXT_LIMITS.headline, "Cover heading line 2"],
    ["reelLabel", HOMEPAGE_TEXT_LIMITS.pill, "Reel pill text"],
    ["worksHeading", HOMEPAGE_TEXT_LIMITS.headline, "Works heading"],
    ["contactLine1", HOMEPAGE_TEXT_LIMITS.contact, "Contact heading line 1"],
    ["contactLine2", HOMEPAGE_TEXT_LIMITS.contact, "Contact heading line 2"],
    [
      "contactAccentWord",
      HOMEPAGE_TEXT_LIMITS.contact,
      "Contact accent word",
    ],
  ];

  const values: Record<string, string> = {};
  for (const [key, max, label] of fields) {
    const result = limit(input?.[key], max, label);
    if (!result.ok) return { ok: false, error: result.error };
    values[key] = result.value;
  }

  const reelVideoUrl = String(input?.reelVideoUrl ?? "").trim();
  if (reelVideoUrl && !isValidUrl(reelVideoUrl)) {
    return { ok: false, error: "The reel video URL is not valid." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("homepage_content").upsert(
      {
        id: 1,
        hero_line1: values.heroLine1 || null,
        hero_line2: values.heroLine2 || null,
        hero_subtitle: values.heroSubtitle || null,
        cover_label: values.coverLabel || null,
        cover_heading1: values.coverHeading1 || null,
        cover_heading2: values.coverHeading2 || null,
        reel_label: values.reelLabel || null,
        reel_video_url: reelVideoUrl || null,
        works_heading: values.worksHeading || null,
        contact_line1: values.contactLine1 || null,
        contact_line2: values.contactLine2 || null,
        contact_accent_word: values.contactAccentWord || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      console.error("[homepage] failed to save the content:", error);
      const missing = missingTableError(error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not save the homepage content." };
    }
  } catch (error) {
    console.error("[homepage] unexpected content save error:", error);
    return { ok: false, error: "Could not save the homepage content." };
  }

  revalidateHomepage();
  return { ok: true };
}

/* --------------------------------- Cards ---------------------------------- */

/** Adds a card to the homepage row. */
export async function addHomepageCard(
  input: HomepageCardInput,
): Promise<HomepageActionResult> {
  await requireAdmin();

  const imageUrl = String(input?.imageUrl ?? "").trim();
  if (!isValidUrl(imageUrl)) {
    return { ok: false, error: "The uploaded image could not be added." };
  }

  const adjust = clampCoverAdjust(input?.coverAdjust, DEFAULT_CARD_ADJUST);

  try {
    const admin = createAdminClient();
    const { data: last, error: lastError } = await admin
      .from("homepage_cards")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) {
      console.error("[homepage] failed to read the card order:", lastError);
      const missing = missingTableError(lastError);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not add the card." };
    }

    const { error } = await admin.from("homepage_cards").insert({
      image_url: imageUrl,
      sort_order: Number(last?.sort_order ?? -1) + 1,
      visible: true,
      cover_fit: adjust.fit,
      cover_pos_x: adjust.posX,
      cover_pos_y: adjust.posY,
      cover_zoom: adjust.zoom,
    });

    if (error) {
      console.error("[homepage] failed to add the card:", error);
      const missing = missingTableError(error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not add the card." };
    }
  } catch (error) {
    console.error("[homepage] unexpected card add error:", error);
    return { ok: false, error: "Could not add the card." };
  }

  revalidateHomepage();
  return { ok: true };
}

/** Saves the framing and the visibility of one card. */
export async function updateHomepageCard(
  id: string,
  input: { coverAdjust: CoverAdjust; visible: boolean },
): Promise<HomepageActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing card id." };
  }

  const adjust = clampCoverAdjust(input?.coverAdjust, DEFAULT_CARD_ADJUST);

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("homepage_cards")
      .update({
        cover_fit: adjust.fit,
        cover_pos_x: adjust.posX,
        cover_pos_y: adjust.posY,
        cover_zoom: adjust.zoom,
        visible: Boolean(input?.visible),
      })
      .eq("id", id);

    if (error) {
      console.error("[homepage] failed to update the card:", error);
      const missing = missingTableError(error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not save the card." };
    }
  } catch (error) {
    console.error("[homepage] unexpected card update error:", error);
    return { ok: false, error: "Could not save the card." };
  }

  revalidateHomepage();
  return { ok: true };
}

/** Removes a card and the file it points to. */
export async function deleteHomepageCard(
  id: string,
): Promise<HomepageActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing card id." };
  }

  try {
    const admin = createAdminClient();
    const { data: card, error: readError } = await admin
      .from("homepage_cards")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();

    if (readError) {
      console.error("[homepage] failed to read the card:", readError);
      const missing = missingTableError(readError);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Card not found." };
    }

    const { error } = await admin.from("homepage_cards").delete().eq("id", id);

    if (error) {
      console.error("[homepage] failed to delete the card:", error);
      const missing = missingTableError(error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not delete the card." };
    }

    const path = card?.image_url
      ? storagePathFromPublicUrl(String(card.image_url))
      : null;
    if (path) await removeStoragePaths([path]);
  } catch (error) {
    console.error("[homepage] unexpected card delete error:", error);
    return { ok: false, error: "Could not delete the card." };
  }

  revalidateHomepage();
  return { ok: true };
}

/** Reorders the cards (the order is the order on the homepage). */
export async function reorderHomepageCards(
  orderedIds: string[],
): Promise<HomepageActionResult> {
  await requireAdmin();

  const ids = Array.isArray(orderedIds)
    ? Array.from(new Set(orderedIds.filter(isValidId)))
    : [];

  if (ids.length === 0) {
    return { ok: false, error: "No cards to reorder." };
  }

  try {
    const admin = createAdminClient();
    const results = await Promise.all(
      ids.map((id, index) =>
        admin.from("homepage_cards").update({ sort_order: index }).eq("id", id),
      ),
    );

    const failed = results.find((result) => result.error);
    if (failed?.error) {
      console.error("[homepage] failed to reorder the cards:", failed.error);
      const missing = missingTableError(failed.error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not reorder the cards." };
    }
  } catch (error) {
    console.error("[homepage] unexpected card reorder error:", error);
    return { ok: false, error: "Could not reorder the cards." };
  }

  revalidateHomepage();
  return { ok: true };
}

/** Removes the reel video (the pill falls back to the animated gradient). */
export async function removeHomepageReel(): Promise<HomepageActionResult> {
  await requireAdmin();

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("homepage_content")
      .select("reel_video_url")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("[homepage] failed to read the reel:", error);
      const missing = missingTableError(error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not remove the reel video." };
    }

    const { error: updateError } = await admin
      .from("homepage_content")
      .update({ reel_video_url: null, updated_at: new Date().toISOString() })
      .eq("id", 1);

    if (updateError) {
      console.error("[homepage] failed to remove the reel:", updateError);
      const missing = missingTableError(updateError);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not remove the reel video." };
    }

    const path = data?.reel_video_url
      ? storagePathFromPublicUrl(String(data.reel_video_url))
      : null;
    if (path) await removeStoragePaths([path]);
  } catch (error) {
    console.error("[homepage] unexpected reel removal error:", error);
    return { ok: false, error: "Could not remove the reel video." };
  }

  revalidateHomepage();
  return { ok: true };
}
