"use server";

import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { CV_MIGRATION, CV_TAG, isMissingCvTable } from "@/lib/cv";
import { CHAT_KNOWLEDGE_TAG } from "@/lib/chat/knowledge";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LIMITS = {
  fullName: 120,
  headline: 160,
  summary: 4000,
  email: 160,
  phone: 60,
  location: 120,
  url: 300,
  sectionTitle: 120,
  entryTitle: 160,
  entrySubtitle: 160,
  entryPeriod: 80,
  entryDescription: 4000,
} as const;

export type CvActionResult = { ok: true } | { ok: false; error: string };

export type CvProfileInput = {
  fullName: string;
  headline: string;
  summary: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  github: string;
  linkedin: string;
  isPublished: boolean;
};

export type CvEntryInput = {
  title: string;
  subtitle: string;
  period: string;
  description: string;
};

function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Trim a value and check its length. */
function limit(
  value: unknown,
  max: number,
  label: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const text = String(value ?? "").trim();
  if (text.length > max) {
    return {
      ok: false,
      error: `${label} must be ${max} characters or fewer.`,
    };
  }
  return { ok: true, value: text };
}

/**
 * A link may be written with or without a scheme. A bare host is turned into
 * an https link; anything that is not a valid http(s) URL is rejected.
 */
function normaliseUrl(value: string): string | null {
  if (!value) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value)
    ? value
    : `https://${value}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The migration has to be applied before anything can be written. */
function missingTableError(error: { code?: string; message?: string }) {
  if (!isMissingCvTable(error)) return null;
  return `Apply ${CV_MIGRATION} first.`;
}

function revalidateCv() {
  revalidateTag(CV_TAG, { expire: 0 });
  revalidateTag(CHAT_KNOWLEDGE_TAG, { expire: 0 });
}

/* -------------------------------- Profile -------------------------------- */

/** Saves the CV profile (the single row). */
export async function saveCvProfile(
  input: CvProfileInput,
): Promise<CvActionResult> {
  await requireAdmin();

  const fullName = limit(input?.fullName, LIMITS.fullName, "Full name");
  if (!fullName.ok) return { ok: false, error: fullName.error };
  if (!fullName.value) {
    return { ok: false, error: "Full name is required." };
  }

  const headline = limit(input?.headline, LIMITS.headline, "Headline");
  if (!headline.ok) return { ok: false, error: headline.error };

  const summary = limit(input?.summary, LIMITS.summary, "Summary");
  if (!summary.ok) return { ok: false, error: summary.error };

  const email = limit(input?.email, LIMITS.email, "Email");
  if (!email.ok) return { ok: false, error: email.error };
  if (email.value && !EMAIL_RE.test(email.value)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const phone = limit(input?.phone, LIMITS.phone, "Phone");
  if (!phone.ok) return { ok: false, error: phone.error };

  const location = limit(input?.location, LIMITS.location, "Location");
  if (!location.ok) return { ok: false, error: location.error };

  const urls: Record<"website" | "github" | "linkedin", string> = {
    website: "",
    github: "",
    linkedin: "",
  };
  for (const key of ["website", "github", "linkedin"] as const) {
    const raw = limit(input?.[key], LIMITS.url, key);
    if (!raw.ok) return { ok: false, error: raw.error };
    const normalised = normaliseUrl(raw.value);
    if (normalised === null) {
      return {
        ok: false,
        error: `Enter a valid URL for the ${key} (starting with http:// or https://).`,
      };
    }
    urls[key] = normalised;
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("cv_profile").upsert(
      {
        id: 1,
        full_name: fullName.value,
        headline: headline.value || null,
        summary: summary.value || null,
        email: email.value || null,
        phone: phone.value || null,
        location: location.value || null,
        website: urls.website || null,
        github: urls.github || null,
        linkedin: urls.linkedin || null,
        is_published: Boolean(input?.isPublished),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      console.error("[cv] failed to save the profile:", error);
      const missing = missingTableError(error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not save the profile." };
    }
  } catch (error) {
    console.error("[cv] unexpected profile save error:", error);
    return { ok: false, error: "Could not save the profile." };
  }

  revalidateCv();
  return { ok: true };
}

/* ------------------------------- Sections -------------------------------- */

/** Adds a section at the end of the list. */
export async function createCvSection(input: {
  title: string;
}): Promise<CvActionResult> {
  await requireAdmin();

  const title = limit(input?.title, LIMITS.sectionTitle, "Section title");
  if (!title.ok) return { ok: false, error: title.error };
  if (!title.value) {
    return { ok: false, error: "The section needs a title." };
  }

  try {
    const admin = createAdminClient();
    const { data: last, error: lastError } = await admin
      .from("cv_sections")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) {
      console.error("[cv] failed to read the section order:", lastError);
      const missing = missingTableError(lastError);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not add the section." };
    }

    const { error } = await admin.from("cv_sections").insert({
      title: title.value,
      sort_order: Number(last?.sort_order ?? -1) + 1,
    });

    if (error) {
      console.error("[cv] failed to add the section:", error);
      const missing = missingTableError(error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not add the section." };
    }
  } catch (error) {
    console.error("[cv] unexpected section add error:", error);
    return { ok: false, error: "Could not add the section." };
  }

  revalidateCv();
  return { ok: true };
}

/** Renames a section. */
export async function renameCvSection(
  id: string,
  title: string,
): Promise<CvActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing section id." };
  }

  const name = limit(title, LIMITS.sectionTitle, "Section title");
  if (!name.ok) return { ok: false, error: name.error };
  if (!name.value) {
    return { ok: false, error: "The section needs a title." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("cv_sections")
      .update({ title: name.value })
      .eq("id", id);

    if (error) {
      console.error("[cv] failed to rename the section:", error);
      const missing = missingTableError(error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not rename the section." };
    }
  } catch (error) {
    console.error("[cv] unexpected section rename error:", error);
    return { ok: false, error: "Could not rename the section." };
  }

  revalidateCv();
  return { ok: true };
}

/** Deletes a section (and, by cascade, its entries). */
export async function deleteCvSection(id: string): Promise<CvActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing section id." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("cv_sections").delete().eq("id", id);

    if (error) {
      console.error("[cv] failed to delete the section:", error);
      const missing = missingTableError(error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not delete the section." };
    }
  } catch (error) {
    console.error("[cv] unexpected section delete error:", error);
    return { ok: false, error: "Could not delete the section." };
  }

  revalidateCv();
  return { ok: true };
}

/** Reorders the sections (the order is the order on the CV). */
export async function reorderCvSections(
  orderedIds: string[],
): Promise<CvActionResult> {
  await requireAdmin();

  const ids = Array.isArray(orderedIds)
    ? Array.from(new Set(orderedIds.filter(isValidId)))
    : [];

  if (ids.length === 0) {
    return { ok: false, error: "No sections to reorder." };
  }

  try {
    const admin = createAdminClient();
    const results = await Promise.all(
      ids.map((id, index) =>
        admin.from("cv_sections").update({ sort_order: index }).eq("id", id),
      ),
    );

    const failed = results.find((result) => result.error);
    if (failed?.error) {
      console.error("[cv] failed to reorder the sections:", failed.error);
      const missing = missingTableError(failed.error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not reorder the sections." };
    }
  } catch (error) {
    console.error("[cv] unexpected section reorder error:", error);
    return { ok: false, error: "Could not reorder the sections." };
  }

  revalidateCv();
  return { ok: true };
}

/* -------------------------------- Entries --------------------------------- */

/** Adds an entry at the end of a section. */
export async function createCvEntry(
  sectionId: string,
  input: CvEntryInput,
): Promise<CvActionResult> {
  await requireAdmin();

  if (!isValidId(sectionId)) {
    return { ok: false, error: "Missing section id." };
  }

  const title = limit(input?.title, LIMITS.entryTitle, "Title");
  if (!title.ok) return { ok: false, error: title.error };
  if (!title.value) {
    return { ok: false, error: "The entry needs a title." };
  }

  const subtitle = limit(input?.subtitle, LIMITS.entrySubtitle, "Subtitle");
  if (!subtitle.ok) return { ok: false, error: subtitle.error };

  const period = limit(input?.period, LIMITS.entryPeriod, "Period");
  if (!period.ok) return { ok: false, error: period.error };

  const description = limit(
    input?.description,
    LIMITS.entryDescription,
    "Description",
  );
  if (!description.ok) return { ok: false, error: description.error };

  try {
    const admin = createAdminClient();
    const { data: last, error: lastError } = await admin
      .from("cv_entries")
      .select("sort_order")
      .eq("section_id", sectionId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) {
      console.error("[cv] failed to read the entry order:", lastError);
      const missing = missingTableError(lastError);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not add the entry." };
    }

    const { error } = await admin.from("cv_entries").insert({
      section_id: sectionId,
      title: title.value,
      subtitle: subtitle.value || null,
      period: period.value || null,
      description: description.value || null,
      sort_order: Number(last?.sort_order ?? -1) + 1,
    });

    if (error) {
      console.error("[cv] failed to add the entry:", error);
      const missing = missingTableError(error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not add the entry." };
    }
  } catch (error) {
    console.error("[cv] unexpected entry add error:", error);
    return { ok: false, error: "Could not add the entry." };
  }

  revalidateCv();
  return { ok: true };
}

/** Saves one entry. */
export async function updateCvEntry(
  id: string,
  input: CvEntryInput,
): Promise<CvActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing entry id." };
  }

  const title = limit(input?.title, LIMITS.entryTitle, "Title");
  if (!title.ok) return { ok: false, error: title.error };
  if (!title.value) {
    return { ok: false, error: "The entry needs a title." };
  }

  const subtitle = limit(input?.subtitle, LIMITS.entrySubtitle, "Subtitle");
  if (!subtitle.ok) return { ok: false, error: subtitle.error };

  const period = limit(input?.period, LIMITS.entryPeriod, "Period");
  if (!period.ok) return { ok: false, error: period.error };

  const description = limit(
    input?.description,
    LIMITS.entryDescription,
    "Description",
  );
  if (!description.ok) return { ok: false, error: description.error };

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("cv_entries")
      .update({
        title: title.value,
        subtitle: subtitle.value || null,
        period: period.value || null,
        description: description.value || null,
      })
      .eq("id", id);

    if (error) {
      console.error("[cv] failed to update the entry:", error);
      const missing = missingTableError(error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not save the entry." };
    }
  } catch (error) {
    console.error("[cv] unexpected entry update error:", error);
    return { ok: false, error: "Could not save the entry." };
  }

  revalidateCv();
  return { ok: true };
}

/** Deletes one entry. */
export async function deleteCvEntry(id: string): Promise<CvActionResult> {
  await requireAdmin();

  if (!isValidId(id)) {
    return { ok: false, error: "Missing entry id." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("cv_entries").delete().eq("id", id);

    if (error) {
      console.error("[cv] failed to delete the entry:", error);
      const missing = missingTableError(error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not delete the entry." };
    }
  } catch (error) {
    console.error("[cv] unexpected entry delete error:", error);
    return { ok: false, error: "Could not delete the entry." };
  }

  revalidateCv();
  return { ok: true };
}

/** Reorders the entries of one section. */
export async function reorderCvEntries(
  sectionId: string,
  orderedIds: string[],
): Promise<CvActionResult> {
  await requireAdmin();

  if (!isValidId(sectionId)) {
    return { ok: false, error: "Missing section id." };
  }

  const ids = Array.isArray(orderedIds)
    ? Array.from(new Set(orderedIds.filter(isValidId)))
    : [];

  if (ids.length === 0) {
    return { ok: false, error: "No entries to reorder." };
  }

  try {
    const admin = createAdminClient();
    const results = await Promise.all(
      ids.map((id, index) =>
        admin
          .from("cv_entries")
          .update({ sort_order: index })
          .eq("id", id)
          .eq("section_id", sectionId),
      ),
    );

    const failed = results.find((result) => result.error);
    if (failed?.error) {
      console.error("[cv] failed to reorder the entries:", failed.error);
      const missing = missingTableError(failed.error);
      if (missing) return { ok: false, error: missing };
      return { ok: false, error: "Could not reorder the entries." };
    }
  } catch (error) {
    console.error("[cv] unexpected entry reorder error:", error);
    return { ok: false, error: "Could not reorder the entries." };
  }

  revalidateCv();
  return { ok: true };
}
