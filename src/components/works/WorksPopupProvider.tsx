"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type WorksPopupContextValue = {
  popupOpen: boolean;
  setPopupOpen: (open: boolean) => void;
};

const WorksPopupContext = createContext<WorksPopupContextValue | null>(null);

export function WorksPopupProvider({ children }: { children: ReactNode }) {
  const [popupOpen, setPopupOpen] = useState(false);
  const setOpen = useCallback((open: boolean) => setPopupOpen(open), []);
  return (
    <WorksPopupContext.Provider value={{ popupOpen, setPopupOpen: setOpen }}>
      {children}
    </WorksPopupContext.Provider>
  );
}

export function useWorksPopup() {
  const ctx = useContext(WorksPopupContext);
  if (!ctx) {
    return { popupOpen: false, setPopupOpen: () => {} };
  }
  return ctx;
}
