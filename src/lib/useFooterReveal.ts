"use client";

import { useEffect, useState } from "react";

/**
 * `true` while the contact / footer reveal covers the bottom of the page.
 * The contact screen writes `data-footer="true"` on `<html>` while its
 * reveal spacer is in the viewport.
 *
 * The right-edge tabs hide themselves while the footer reveal is active, so
 * they never collide with the dark contact screen.
 */
export function useFooterReveal() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setRevealed(root.getAttribute("data-footer") === "true");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-footer"] });
    return () => observer.disconnect();
  }, []);

  return revealed;
}
