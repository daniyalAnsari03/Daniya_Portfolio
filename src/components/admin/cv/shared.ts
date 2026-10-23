/** Types shared by the admin CV components. */

export type CvProfileData = {
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

export type CvEntryRow = {
  id: string;
  title: string;
  subtitle: string;
  period: string;
  description: string;
};

export type CvSectionRow = {
  id: string;
  title: string;
  entries: CvEntryRow[];
};

export type CvStatus =
  | { status: "success"; message: string }
  | { status: "error"; message: string }
  | null;
