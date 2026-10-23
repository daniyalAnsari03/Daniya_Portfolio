/**
 * The CV shapes and the small pure helpers around them.
 *
 * This module has no server-only import on purpose: the client components
 * (the Resume tab and the CV drawer) read the same shapes. The data itself is
 * only ever fetched on the server (`src/lib/cv.ts`).
 */

export type CvProfile = {
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

export type CvEntry = {
  id: string;
  sectionId: string;
  title: string;
  subtitle: string;
  period: string;
  /** Multi-line text — every line is rendered as one bullet. */
  description: string;
  sortOrder: number;
};

export type CvSection = {
  id: string;
  title: string;
  sortOrder: number;
  entries: CvEntry[];
};

export type CvDocument = {
  profile: CvProfile;
  sections: CvSection[];
};

/** The description of an entry, split into its bullet lines. */
export function cvBullets(description: string): string[] {
  return description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * The contact line of the CV: only the fields that are actually filled, in a
 * fixed order. Used by the drawer and by the PDF.
 */
export function cvContactItems(profile: CvProfile): string[] {
  const items: string[] = [];
  if (profile.email) items.push(profile.email);
  if (profile.phone) items.push(profile.phone);
  if (profile.location) items.push(profile.location);
  if (profile.website) items.push(profile.website);
  if (profile.github) items.push(profile.github);
  if (profile.linkedin) items.push(profile.linkedin);
  return items;
}
