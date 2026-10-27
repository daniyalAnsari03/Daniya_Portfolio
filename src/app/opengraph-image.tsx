import { ImageResponse } from "next/og";

/**
 * Static Open Graph / Twitter share image for the whole public site.
 * Rendered at build time with next/og; the default system font only.
 */

const OG = {
  width: 1200,
  height: 630,
  background: "#E8E8E8",
  nameColor: "#333333",
  titleColor: "#333333",
  taglineColor: "#A0A0A0",
  name: "Daniyal",
  title: "Full-Stack AI Developer",
  tagline: "building web apps and AI agents",
};

export const alt = `${OG.name} — ${OG.title}`;
export const size = { width: OG.width, height: OG.height };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: OG.background,
        }}
      >
        <div style={{ display: "flex", fontSize: 128, fontWeight: 700, color: OG.nameColor }}>
          {OG.name}
        </div>
        <div style={{ display: "flex", fontSize: 56, color: OG.titleColor, marginTop: 18 }}>
          {OG.title}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: OG.taglineColor, marginTop: 30 }}>
          {OG.tagline}
        </div>
      </div>
    ),
    size,
  );
}
