/**
 * JS mirror of the CSS palette tokens defined in `src/app/globals.css`.
 * Framer Motion's `useTransform` needs concrete color strings to interpolate,
 * so the few scroll-linked colour animations read their values from here.
 * Keep in sync with the `:root` variables.
 */
export const PALETTE = {
  background: "#E8E8E8",
  foreground: "#111111",
  charcoal: "#333333",
  accent: "#333333",
  accentOnDark: "#A0A0A0",
};
