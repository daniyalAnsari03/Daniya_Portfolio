"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/projects";
import WorksList from "./WorksList";
import { useWorksPopup } from "./WorksPopupProvider";

/** The popup chunk is only requested after the first card is opened. */
const ProjectPopup = dynamic(() => import("./ProjectPopup"), { ssr: false });

export default function WorksExplorer({ projects }: { projects: Project[] }) {
  const [selected, setSelected] = useState<Project | null>(null);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const { setPopupOpen } = useWorksPopup();

  const handleSelect = useCallback(
    (project: Project, trigger: HTMLElement | null) => {
      triggerRef.current = trigger;
      setSelected(project);
      setOpen(true);
    },
    [],
  );

  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setPopupOpen(open);
  }, [open, setPopupOpen]);

  const handleExited = useCallback(() => {
    setSelected(null);
    setPopupOpen(false);
  }, [setPopupOpen]);

  return (
    <>
      <WorksList projects={projects} onSelect={handleSelect} />
      {selected ? (
        <ProjectPopup
          project={selected}
          open={open}
          onClose={handleClose}
          onExited={handleExited}
          returnFocusTo={triggerRef}
        />
      ) : null}
    </>
  );
}
