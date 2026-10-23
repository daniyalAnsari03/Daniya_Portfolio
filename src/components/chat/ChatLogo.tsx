import type { CSSProperties } from "react";

export type ChatLogoAnimation =
  | "none"
  | "idle"
  | "thinking"
  | "listening"
  | "speaking";

type ChatLogoProps = {
  /** Pixel size for fixed-size uses; omit to size it with CSS (e.g. a token). */
  size?: number;
  animate?: ChatLogoAnimation;
  className?: string;
};

/** The twelve ray lengths, clockwise. */
const RAY_LENGTHS = [17, 12, 16, 10, 17, 13, 15, 11, 17, 12, 16, 10] as const;
/** Per-ray angular jitter so the burst never looks mechanical. */
const RAY_JITTER = [0, 3, -2, 4, -3, 2] as const;
/** Ray thickness — matches the old 3.2px round stroke. */
const RAY_WIDTH = 3.2;
const RAY_HALF = RAY_WIDTH / 2;

/**
 * The 12-ray starburst used as the Ask AI logo and thinking indicator.
 *
 * Only the rays remain; no background circle. Each ray is a thin rounded
 * rectangle (not a line): a line has a zero-width fill-box, where the CSS
 * `transform-origin: 50% 100%` + `scaleY` breath cannot be resolved
 * reliably. The rectangle has a real box, so the ray always scales from its
 * inner end. All motion is driven by the state class + CSS in `globals.css` —
 * the component itself never animates.
 */
export default function ChatLogo({
  size,
  animate = "none",
  className,
}: ChatLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={["chat-logo", `chat-logo--${animate}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      <g className="spin">
        {RAY_LENGTHS.map((length, index) => {
          const angle = index * 30 + RAY_JITTER[index % RAY_JITTER.length];

          return (
            <g key={index} transform={`rotate(${angle} 24 24)`}>
              <rect
                className="chat-logo-ray"
                x={24 - RAY_HALF}
                y={24 - length - RAY_HALF}
                width={RAY_WIDTH}
                height={length - RAY_HALF / 2}
                rx={RAY_HALF}
                fill="currentColor"
                style={{ "--i": index } as CSSProperties}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
