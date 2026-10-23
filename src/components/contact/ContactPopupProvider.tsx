"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PublicSettings } from "@/lib/settings";

/** The modal is only needed once the user opens it, so it is loaded lazily. */
const ContactPopup = dynamic(() => import("./ContactPopup"), { ssr: false });

type ContactPopupContextValue = {
  openContact: () => void;
  /** `true` while the contact sheet is open (the Resume tab hides then). */
  isOpen: boolean;
};

const ContactPopupContext = createContext<ContactPopupContextValue | null>(null);

export function useContactPopup() {
  const context = useContext(ContactPopupContext);
  if (!context) {
    throw new Error("useContactPopup must be used within a ContactPopupProvider");
  }
  return context;
}

export default function ContactPopupProvider({
  settings,
  children,
}: {
  settings: PublicSettings;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openContact = useCallback(() => setOpen(true), []);
  const closeContact = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openContact, isOpen: open }), [openContact, open]);

  return (
    <ContactPopupContext.Provider value={value}>
      {children}
      <ContactPopup open={open} onClose={closeContact} settings={settings} />
    </ContactPopupContext.Provider>
  );
}
