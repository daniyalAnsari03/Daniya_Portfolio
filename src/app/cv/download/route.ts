import { NextResponse } from "next/server";
import { getCachedCvForPdf, renderCvPdf } from "@/lib/cv-pdf";

/**
 * Slugify a name for the download filename. Falls back to "resume".
 */
function slugify(value: string): string {
  const cleaned = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "resume";
}

export async function GET() {
  const cv = await getCachedCvForPdf();

  // Nothing published (or nothing to show) -> no PDF at all.
  if (!cv || !cv.profile.isPublished) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const hasContent =
    Boolean(cv.profile.fullName) ||
    Boolean(cv.profile.summary) ||
    cv.sections.some((section) => section.entries.length > 0);

  if (!hasContent) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const filename = `${slugify(cv.profile.fullName || "resume")}-CV.pdf`;
  const pdf = Buffer.from(await renderCvPdf(cv), "base64");

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
