"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { saveHomepageContent } from "@/lib/admin/homepage-actions";
import type { HomepageContentData, HomepageStatus } from "./shared";

/**
 * Saves the homepage copy. Every section writes the same single row, so the
 * whole (current) content is sent on every save.
 */
export function useHomepageSave(
  data: HomepageContentData,
  setStatus: (status: HomepageStatus) => void,
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function save() {
    setStatus(null);
    startTransition(async () => {
      const result = await saveHomepageContent(data);
      if (!result.ok) {
        setStatus({ status: "error", message: result.error });
        return;
      }
      setStatus({ status: "success", message: "Homepage saved." });
      router.refresh();
    });
  }

  return { save, busy: pending };
}
