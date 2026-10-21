"use client";

import { content } from "@/lib/content";
import { useContactPopup } from "./contact/ContactPopupProvider";
import { ArrowUpRight } from "./icons";

type ContactButtonProps = {
  /**
   * Visual variant. `accent` (default) is the homepage button; `dark` inverts
   * it so it stays legible over the dark sections of the About page.
   */
  variant?: "accent" | "dark";
  className?: string;
};

export default function ContactButton({
  variant = "accent",
  className = "",
}: ContactButtonProps) {
  const { openContact } = useContactPopup();

  const pill =
    variant === "dark"
      ? "bg-white text-foreground"
      : "bg-accent text-accent-contrast";
  const badge =
    variant === "dark"
      ? "bg-accent text-accent-contrast"
      : "bg-white text-accent";

  return (
    <button
      type="button"
      onClick={openContact}
      className={`group flex h-[44px] w-[130px] items-center justify-between rounded-full p-2 pl-4 text-[15px] font-medium transition-[transform,background-color,color] duration-300 hover:-translate-y-0.5 active:translate-y-0 ${pill} ${className}`}
    >
      <span>{content.contact.label}</span>
      <span
        className={`flex h-full aspect-square items-center justify-center rounded-full transition-transform duration-300 group-hover:rotate-45 ${badge}`}
      >
        <ArrowUpRight className="h-1/2 w-1/2" />
      </span>
    </button>
  );
}
