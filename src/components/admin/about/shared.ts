import { createAboutMediaUpload } from "@/lib/admin/about-actions";
import {
  type MediaKind,
  uploadWithProgress,
  validateMediaFile,
} from "@/components/admin/shared";
import { type CoverAdjust } from "@/lib/cover-adjust";

export {
  BUTTON_CLASS,
  CARD_CLASS,
  FIELD_CLASS,
  IMAGE_ACCEPT,
  LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  VIDEO_ACCEPT,
  isValidHttpUrl,
  uploadWithProgress,
  validateImageFile,
  validateMediaFile,
  validateVideoFile,
} from "@/components/admin/shared";

export type { MediaKind };

export type AboutHeroCardRow = {
  id: string;
  mediaType: MediaKind;
  fileUrl: string;
  /** The framing of the card (fit, focus point, zoom). */
  coverAdjust: CoverAdjust;
};

export type AboutIntroData = {
  heroHeading: string;
  heroSubtitle: string;
  statementHeading: string;
  paragraph: string;
  photoUrl: string;
  location: string;
  email: string;
  phone: string;
};

export type ServiceRow = {
  id: string;
  title: string;
  description: string;
};

export type SkillRowData = {
  id: string;
  name: string;
  iconUrl: string;
};

export type SkillCategoryRow = {
  id: string;
  name: string;
  skills: SkillRowData[];
};

export type EducationRow = {
  id: string;
  degree: string;
  school: string;
  year: string;
};

export async function uploadAboutFile(
  file: File,
  kind: MediaKind,
  scope: string,
  onProgress?: (percent: number) => void,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const validation = validateMediaFile(file, kind);
  if (validation) return { ok: false, error: validation };

  const ticket = await createAboutMediaUpload({
    kind,
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    scope,
  });
  if (!ticket.ok) return { ok: false, error: ticket.error };

  const upload = await uploadWithProgress(ticket.signedUrl, file, (percent) =>
    onProgress?.(percent),
  );
  if (!upload.ok) return { ok: false, error: upload.error };

  return { ok: true, url: ticket.publicUrl };
}
