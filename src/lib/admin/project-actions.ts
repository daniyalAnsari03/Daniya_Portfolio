"use server";

import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PROJECTS_TAG,
  PROJECT_IMAGES_BUCKET,
  isMissingColumnError,
  storagePathFromPublicUrl,
  type ProjectImage,
} from "@/lib/projects";
import { clampCoverAdjust, type CoverAdjust } from "@/lib/cover-adjust";

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

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_TECH_ITEMS = 40;
const MAX_TECH_LENGTH = 40;

export type ProjectInput = {
  name: string;
  description: string;
  techStack: string[];
  demoLink: string;
  coverImageUrl: string;
  /** Framing of the cover image inside the card (fit, focus point, zoom). */
  coverAdjust: CoverAdjust;
  visible: boolean;
};

export type ProjectActionResult = { ok: true } | { ok: false; error: string };

export type CreateProjectResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type AddGalleryImageResult =
  | { ok: true; image: ProjectImage }
  | { ok: false; error: string };

export type ProjectUploadTicket =
  | {
      ok: true;
      signedUrl: string;
      token: string;
      path: string;
      publicUrl: string;
    }
  | { ok: false; error: string };

type NormalizedProject = {
  name: string;
  description: string;
  techStack: string[];
  demoLink: string;
  coverImageUrl: string;
  coverAdjust: CoverAdjust;
  visible: boolean;
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

/**
 * The cover framing columns are added by a migration that is applied
 * manually, so the write can fail with a missing column error.
 */
function missingCoverColumnsError(error: {
  code?: string;
  message?: string;
}) {
  if (!isMissingColumnError(error)) return null;
  return "The cover framing columns are missing. Apply supabase/migrations/005_project_cover_adjust.sql first.";
}

function normalizeProjectInput(
  input: ProjectInput,
): { ok: true; value: NormalizedProject } | { ok: false; error: string } {
  const name = String(input?.name ?? "").trim();
  const description = String(input?.description ?? "").trim();
  const demoLink = String(input?.demoLink ?? "").trim();
  const coverImageUrl = String(input?.coverImageUrl ?? "").trim();

  if (!name) {
    return { ok: false, error: "Project name is required." };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      error: `Project name must be ${MAX_NAME_LENGTH} characters or fewer.`,
    };
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
    };
  }
  if (demoLink && !isValidUrl(demoLink)) {
    return {
      ok: false,
      error: "Demo link must be a valid URL starting with http:// or https://.",
    };
  }
  if (coverImageUrl && !isValidUrl(coverImageUrl)) {
    return { ok: false, error: "Cover image URL is not valid." };
  }

  const techStack = (Array.isArray(input?.techStack) ? input.techStack : [])
    .map((tech) => String(tech ?? "").trim())
    .filter(Boolean);

  if (techStack.length > MAX_TECH_ITEMS) {
    return {
      ok: false,
      error: `Add at most ${MAX_TECH_ITEMS} tech stack items.`,
    };
  }
  if (techStack.some((tech) => tech.length > MAX_TECH_LENGTH)) {
    return {
      ok: false,
      error: `Each tech stack item must be ${MAX_TECH_LENGTH} characters or fewer.`,
    };
  }

  return {
    ok: true,
    value: {
      name,
      description,
      techStack,
      demoLink,
      coverImageUrl,
      // Fit must be contain/cover, the focus point 0…100 and the zoom 1…3.
      coverAdjust: clampCoverAdjust(input?.coverAdjust),
      visible: Boolean(input?.visible),
    },
  };
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
      console.error("[projects] failed to remove storage objects:", error);
    }
  } catch (error) {
    console.error("[projects] unexpected storage cleanup error:", error);
  }
}

export async function createProject(
  input: ProjectInput,
): Promise<CreateProjectResult> {
  await requireAdmin();

  const parsed = normalizeProjectInput(input);
  if (!parsed.ok) return parsed;

  try {
    const admin = createAdminClient();
    const { data: last, error: lastError } = await admin
      .from("projects")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) {
      return { ok: false, error: "Could not create the project." };
    }

    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("projects")
      .insert({
        name: parsed.value.name,
        description: parsed.value.description || null,
        tech_stack: parsed.value.techStack,
        demo_link: parsed.value.demoLink || null,
        cover_image_url: parsed.value.coverImageUrl || null,
        cover_fit: parsed.value.coverAdjust.fit,
        cover_pos_x: parsed.value.coverAdjust.posX,
        cover_pos_y: parsed.value.coverAdjust.posY,
        cover_zoom: parsed.value.coverAdjust.zoom,
        sort_order: Number(last?.sort_order ?? -1) + 1,
        is_visible: parsed.value.visible,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error || !data) {
      if (error) {
        console.error("[projects] failed to create the project:", error);
        const missing = missingCoverColumnsError(error);
        if (missing) return { ok: false, error: missing };
      }
      return { ok: false, error: "Could not create the project." };
    }

    revalidateTag(PROJECTS_TAG, { expire: 0 });
    return { ok: true, id: String(data.id) };
  } catch (error) {
    console.error("[projects] unexpected create error:", error);
    return { ok: false, error: "Could not create the project." };
  }
}

export async function updateProject(
  id: string,
  input: ProjectInput,
): Promise<ProjectActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing project id." };
  }

  const parsed = normalizeProjectInput(input);
  if (!parsed.ok) return parsed;

  try {
    const admin = createAdminClient();
    const { data: existing, error: readError } = await admin
      .from("projects")
      .select("cover_image_url")
      .eq("id", id)
      .maybeSingle();

    if (readError || !existing) {
      return { ok: false, error: "Project not found." };
    }

    const now = new Date().toISOString();
    const { error } = await admin
      .from("projects")
      .update({
        name: parsed.value.name,
        description: parsed.value.description || null,
        tech_stack: parsed.value.techStack,
        demo_link: parsed.value.demoLink || null,
        cover_image_url: parsed.value.coverImageUrl || null,
        cover_fit: parsed.value.coverAdjust.fit,
        cover_pos_x: parsed.value.coverAdjust.posX,
        cover_pos_y: parsed.value.coverAdjust.posY,
        cover_zoom: parsed.value.coverAdjust.zoom,
        is_visible: parsed.value.visible,
        updated_at: now,
      })
      .eq("id", id);

    if (error) {
      console.error("[projects] failed to update the project:", error);
      const missing = missingCoverColumnsError(error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not update the project." };
    }

    const previousCover = existing.cover_image_url
      ? String(existing.cover_image_url)
      : "";
    if (previousCover && previousCover !== parsed.value.coverImageUrl) {
      const path = storagePathFromPublicUrl(previousCover);
      if (path) await removeStoragePaths([path]);
    }

    revalidateTag(PROJECTS_TAG, { expire: 0 });
    return { ok: true };
  } catch (error) {
    console.error("[projects] unexpected update error:", error);
    return { ok: false, error: "Could not update the project." };
  }
}

export async function setProjectVisibility(
  id: string,
  visible: boolean,
): Promise<ProjectActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing project id." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("projects")
      .update({ is_visible: Boolean(visible), updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { ok: false, error: "Could not change project visibility." };
    }
  } catch (error) {
    console.error("[projects] unexpected visibility error:", error);
    return { ok: false, error: "Could not change project visibility." };
  }

  revalidateTag(PROJECTS_TAG, { expire: 0 });
  return { ok: true };
}

export async function deleteProject(id: string): Promise<ProjectActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing project id." };
  }

  try {
    const admin = createAdminClient();
    const { data: project, error: readError } = await admin
      .from("projects")
      .select("cover_image_url")
      .eq("id", id)
      .maybeSingle();

    if (readError || !project) {
      return { ok: false, error: "Project not found." };
    }

    const { data: images } = await admin
      .from("project_images")
      .select("image_url")
      .eq("project_id", id);

    const { error } = await admin.from("projects").delete().eq("id", id);

    if (error) {
      return { ok: false, error: "Could not delete the project." };
    }

    const urls: string[] = [];
    if (project.cover_image_url) urls.push(String(project.cover_image_url));
    for (const image of images ?? []) {
      if (image?.image_url) urls.push(String(image.image_url));
    }

    await removeStoragePaths(
      urls
        .map((url) => storagePathFromPublicUrl(url))
        .filter((path): path is string => Boolean(path)),
    );

    revalidateTag(PROJECTS_TAG, { expire: 0 });
    return { ok: true };
  } catch (error) {
    console.error("[projects] unexpected delete error:", error);
    return { ok: false, error: "Could not delete the project." };
  }
}

export async function reorderProjects(
  orderedIds: string[],
): Promise<ProjectActionResult> {
  await requireAdmin();

  const ids = Array.isArray(orderedIds)
    ? Array.from(new Set(orderedIds.filter(isValidId)))
    : [];

  if (ids.length === 0) {
    return { ok: false, error: "No projects to reorder." };
  }

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const results = await Promise.all(
      ids.map((id, index) =>
        admin
          .from("projects")
          .update({ sort_order: index, updated_at: now })
          .eq("id", id),
      ),
    );

    if (results.some((result) => result.error)) {
      return { ok: false, error: "Could not reorder the projects." };
    }
  } catch (error) {
    console.error("[projects] unexpected reorder error:", error);
    return { ok: false, error: "Could not reorder the projects." };
  }

  revalidateTag(PROJECTS_TAG, { expire: 0 });
  return { ok: true };
}

export async function createProjectImageUpload(input: {
  fileName: string;
  contentType: string;
  size: number;
  projectId?: string | null;
}): Promise<ProjectUploadTicket> {
  await requireAdmin();

  const contentType = String(input?.contentType ?? "").toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return { ok: false, error: "Only JPEG, PNG or WebP images are allowed." };
  }

  const size = Number(input?.size ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: "That image could not be read." };
  }
  if (size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Images must be 10 MB or smaller." };
  }

  const requestedProject = String(input?.projectId ?? "");
  const scope = /^[0-9a-f-]{36}$/i.test(requestedProject)
    ? requestedProject
    : "drafts";
  const extension = IMAGE_EXTENSIONS[contentType];
  const path = `${scope}/${Date.now()}-${randomUUID()}.${extension}`;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(PROJECT_IMAGES_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("[projects] failed to sign upload:", error);
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
    console.error("[projects] unexpected upload signing error:", error);
    return { ok: false, error: "Could not start the upload. Try again." };
  }
}

export async function addGalleryImage(
  projectId: string,
  imageUrl: string,
): Promise<AddGalleryImageResult> {
  await requireAdmin();

  if (!isValidId(projectId)) {
    return { ok: false, error: "Missing project id." };
  }

  const url = String(imageUrl ?? "").trim();
  if (!isValidUrl(url)) {
    return { ok: false, error: "The gallery image URL is not valid." };
  }

  try {
    const admin = createAdminClient();
    const { data: last, error: lastError } = await admin
      .from("project_images")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) {
      return { ok: false, error: "Could not add the gallery image." };
    }

    const sortOrder = Number(last?.sort_order ?? -1) + 1;
    const { data, error } = await admin
      .from("project_images")
      .insert({
        project_id: projectId,
        image_url: url,
        sort_order: sortOrder,
      })
      .select("id, image_url, sort_order")
      .single();

    if (error || !data) {
      return { ok: false, error: "Could not add the gallery image." };
    }

    revalidateTag(PROJECTS_TAG, { expire: 0 });
    return {
      ok: true,
      image: {
        id: String(data.id),
        url: String(data.image_url),
        sortOrder: Number(data.sort_order ?? sortOrder),
      },
    };
  } catch (error) {
    console.error("[projects] unexpected gallery add error:", error);
    return { ok: false, error: "Could not add the gallery image." };
  }
}

export async function removeGalleryImage(
  projectId: string,
  imageId: string,
): Promise<ProjectActionResult> {
  await requireAdmin();

  if (!isValidId(projectId) || !isValidId(imageId)) {
    return { ok: false, error: "Missing image id." };
  }

  try {
    const admin = createAdminClient();
    const { data: image, error: readError } = await admin
      .from("project_images")
      .select("image_url")
      .eq("id", imageId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (readError || !image) {
      return { ok: false, error: "Gallery image not found." };
    }

    const { error } = await admin
      .from("project_images")
      .delete()
      .eq("id", imageId)
      .eq("project_id", projectId);

    if (error) {
      return { ok: false, error: "Could not remove the gallery image." };
    }

    const path = storagePathFromPublicUrl(String(image.image_url));
    if (path) await removeStoragePaths([path]);

    revalidateTag(PROJECTS_TAG, { expire: 0 });
    return { ok: true };
  } catch (error) {
    console.error("[projects] unexpected gallery remove error:", error);
    return { ok: false, error: "Could not remove the gallery image." };
  }
}

export async function reorderGalleryImages(
  projectId: string,
  orderedIds: string[],
): Promise<ProjectActionResult> {
  await requireAdmin();

  if (!isValidId(projectId)) {
    return { ok: false, error: "Missing project id." };
  }

  const ids = Array.isArray(orderedIds)
    ? Array.from(new Set(orderedIds.filter(isValidId)))
    : [];

  if (ids.length === 0) {
    return { ok: false, error: "No gallery images to reorder." };
  }

  try {
    const admin = createAdminClient();
    const results = await Promise.all(
      ids.map((id, index) =>
        admin
          .from("project_images")
          .update({ sort_order: index })
          .eq("id", id)
          .eq("project_id", projectId),
      ),
    );

    if (results.some((result) => result.error)) {
      return { ok: false, error: "Could not reorder the gallery images." };
    }
  } catch (error) {
    console.error("[projects] unexpected gallery reorder error:", error);
    return { ok: false, error: "Could not reorder the gallery images." };
  }

  revalidateTag(PROJECTS_TAG, { expire: 0 });
  return { ok: true };
}
