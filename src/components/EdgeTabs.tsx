"use client";

import type { ReactNode } from "react";

/**
 * The shared stack of right-edge tabs (Resume + Ask AI).
 *
 * It lives in the public layout, OUTSIDE the page-transition wrappers, so a
 * page transition never transforms it. The stack sits BELOW the vertical
 * centre of the screen — pushed down by `--edge-tabs-down` (below `lg`) or
 * `--edge-tabs-down-lg` (`lg+`) in globals.css — so it clears the hero
 * headline ("Developer") on desktop and the hero subtitle on smaller
 * screens, while staying clear of the bottom socials and the nav pill.
 * When only one tab is rendered it is centred inside that lowered group, so
 * the Ask AI tab alone lands in the same lower area.
 *
 * The container ignores pointer events; each tab re-enables them on its own
 * button.
 */
export default function EdgeTabs({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed right-0 z-[var(--z-chrome)] top-[calc(50%+var(--edge-tabs-down))] flex -translate-y-1/2 flex-col items-end gap-[4px] lg:top-[calc(50%+var(--edge-tabs-down-lg))]">
      {children}
    </div>
  );
}
