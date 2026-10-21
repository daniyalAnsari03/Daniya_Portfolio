import { Suspense } from "react";
import type { Metadata } from "next";
import ProjectsManager from "@/components/admin/ProjectsManager";
import type { ProjectRow } from "@/components/admin/projects-types";
import { getAdminProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects",
};

async function ProjectsContent() {
  const projects = await getAdminProjects();
  const rows: ProjectRow[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    techStack: project.techStack,
    demoLink: project.demoLink,
    coverImageUrl: project.coverImageUrl,
    coverAdjust: project.coverAdjust,
    visible: project.visible,
    images: project.images.map((image) => ({
      id: image.id,
      url: image.url,
    })),
  }));

  return <ProjectsManager initialProjects={rows} />;
}

function ProjectsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl" aria-hidden="true">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-black/10" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded bg-black/5" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-2xl border border-black/10 bg-white"
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminProjectsPage() {
  return (
    <Suspense fallback={<ProjectsSkeleton />}>
      <ProjectsContent />
    </Suspense>
  );
}
