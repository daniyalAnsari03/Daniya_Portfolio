"use client";

import type { ReactNode } from "react";

/**
 * The shared stack of right-edge tabs (Resume + Ask AI).
 *
 * It lives in the public layout, OUTSIDE the page-transition wrappers, so a
 * page transition never transforms it. The stack as a whole is vertically
 * centred: when only one tab is rendered it sits alone in the middle, and
 * when both are rendered they grow away from the centre in a column.
 *
 * The container ignores pointer events; each tab re-enables them on its own
 * button.
 */
export default function EdgeTabs({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed top-1/2 right-0 z-[var(--z-chrome)] flex -translate-y-1/2 flex-col items-end gap-[4px]">
      {children}
    </div>
  );
}
