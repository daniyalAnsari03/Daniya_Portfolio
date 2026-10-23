"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { CvDocument } from "@/lib/cv-shared";

/**
 * The CV drawer is only needed once the user opens it, so it is loaded
 * lazily — the module is requested on the first click.
 */
const CvDrawer = dynamic(() => import("./CvDrawer"), { ssr: false });

type CvContextValue = {
  /** The published CV, or `null` when nothing is published. */
  cv: CvDocument | null;
  /** `true` while the drawer is open. */
  open: boolean;
  openCv: () => void;
  closeCv: () => void;
  /** The Resume tab — the focus returns here when the drawer closes. */
  triggerRef: RefObject<HTMLButtonElement | null>;
};

const CvContext = createContext<CvContextValue | null>(null);

export function useCv() {
  const context = useContext(CvContext);
  if (!context) {
    throw new Error("useCv must be used within a CvProvider");
  }
  return context;
}

/**
 * Holds the state of the CV drawer. It lives in the shared (public) layout,
 * OUTSIDE the transitioning page content, so the drawer is never part of a
 * transformed wrapper and the page transition never touches it.
 */
export default function CvProvider({
  cv,
  children,
}: {
  cv: CvDocument | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // The drawer is mounted from the first click on, so the lazy chunk is only
  // requested when the user actually opens the CV.
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const openCv = useCallback(() => {
    setMounted(true);
    setOpen(true);
  }, []);

  const closeCv = useCallback(() => setOpen(false), []);

  const handleExited = useCallback(() => {
    setMounted(false);
    triggerRef.current?.focus();
  }, []);

  const value = useMemo(
    () => ({ cv, open, openCv, closeCv, triggerRef }),
    [cv, open, openCv, closeCv],
  );

  return (
    <CvContext.Provider value={value}>
      {children}
      {mounted && cv ? (
        <CvDrawer
          cv={cv}
          open={open}
          onClose={closeCv}
          onExited={handleExited}
        />
      ) : null}
    </CvContext.Provider>
  );
}
