import type { Metadata } from "next";
import Contact from "@/components/Contact";
import WorksExplorer from "@/components/works/WorksExplorer";
import { content } from "@/lib/content";
import { getProjects } from "@/lib/projects";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: content.worksPage.heading,
  description: `Selected projects by ${content.name} — ${content.headline.line1} ${content.headline.line2}.`,
  alternates: {
    canonical: `${SITE_URL}/works`,
  },
};

export default async function WorksPage() {
  const projects = await getProjects();

  return (
    <main className="relative w-full overflow-x-clip">
      {/* Opaque content layer that slides up over the fixed contact screen. */}
      <div className="relative z-10 rounded-b-[16px] bg-background sm:rounded-b-[24px]">
        <WorksExplorer projects={projects} />
      </div>

      {/* Same fixed contact screen + 100vh reveal spacer as the homepage. */}
      <Contact />
    </main>
  );
}
