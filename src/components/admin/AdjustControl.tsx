"use client";

import {
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  clampCoverAdjust,
  COVER_ZOOM_MAX,
  COVER_ZOOM_MIN,
  COVER_ZOOM_STEP,
  DEFAULT_COVER_ADJUST,
  type CoverAdjust,
} from "@/lib/cover-adjust";

const BUTTON_CLASS =
  "rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40";

/** The preview box used when the caller does not bring its own. */
const DEFAULT_BOX_CLASS =
  "aspect-[16/10] rounded-[14px] bg-charcoal/5 ring-1 ring-black/5 sm:max-w-[22rem]";

type AdjustControlProps = {
  /** The current framing. */
  adjust: CoverAdjust;
  /** Called with the next (clamped) framing. */
  onChange: (adjust: CoverAdjust) => void;
  /** The media shown inside the preview box (null → nothing to frame). */
  preview: ReactNode;
  /** Classes of the preview box (aspect ratio, radius, max width…). */
  boxClassName?: string;
  /** Inline styles of the preview box (e.g. a computed aspect ratio). */
  boxStyle?: CSSProperties;
  /** Label shown when there is nothing to preview. */
  emptyLabel?: string;
  /** Heading above the control (null → no heading, only the Reset button). */
  title?: string | null;
  /** What the Reset button goes back to (defaults to the shared default). */
  resetTo?: CoverAdjust;
  disabled?: boolean;
  /** Unique id for the zoom slider. */
  zoomInputId?: string;
};

/**
 * The shared "Image fit" control: fit / fill, a zoom slider and a
 * drag-to-position preview. It is used by the project cover, the About hero
 * cards and the homepage cards, so every surface frames its media exactly the
 * same way.
 *
 * The uploaded file is never modified — only a uniform scale and a position
 * are applied to the rendered element.
 */
export default function AdjustControl({
  adjust,
  onChange,
  preview,
  boxClassName = DEFAULT_BOX_CLASS,
  boxStyle,
  emptyLabel = "No image",
  title = "Image fit",
  resetTo = DEFAULT_COVER_ADJUST,
  disabled = false,
  zoomInputId = "adjust-zoom",
}: AdjustControlProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const hasMedia = preview !== null && preview !== undefined && preview !== false;

  function update(patch: Partial<CoverAdjust>) {
    onChange(clampCoverAdjust({ ...adjust, ...patch }, resetTo));
  }

  function reset() {
    onChange(clampCoverAdjust(resetTo, resetTo));
  }

  /** The pointer position inside the preview sets the focus point (0…100). */
  function setAdjustFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const box = previewRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;

    const posX = ((event.clientX - box.left) / box.width) * 100;
    const posY = ((event.clientY - box.top) / box.height) * 100;

    update({
      posX: Math.round(posX * 10) / 10,
      posY: Math.round(posY * 10) / 10,
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!hasMedia || disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    setAdjustFromPointer(event);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    setAdjustFromPointer(event);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ? (
          <span className="mb-1.5 block text-sm font-medium text-[#111111]/70">
            {title}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={reset}
          disabled={disabled}
          className={BUTTON_CLASS}
        >
          Reset
        </button>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-4">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {/* Live preview: the same box and the same rendering rule as the
              published card, so what is seen here is what is published. */}
          <div
            ref={previewRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`relative w-full shrink-0 touch-none select-none overflow-hidden ${boxClassName} ${
              hasMedia ? "cursor-grab active:cursor-grabbing" : ""
            }`}
            style={boxStyle}
          >
            {hasMedia ? (
              preview
            ) : (
              <div className="flex h-full items-center justify-center px-3 text-center text-xs text-black/35">
                {emptyLabel}
              </div>
            )}

            {hasMedia && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                style={{
                  left: `${adjust.posX}%`,
                  top: `${adjust.posY}%`,
                }}
              />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <span className="mb-1.5 block text-sm font-medium text-foreground/70">
                Fit
              </span>
              <div className="inline-flex rounded-lg border border-black/10 bg-black/5 p-1">
                {(["contain", "cover"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update({ fit: value })}
                    disabled={disabled}
                    aria-pressed={adjust.fit === value}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      adjust.fit === value
                        ? "bg-white text-foreground shadow-sm"
                        : "text-black/55 hover:text-foreground"
                    }`}
                  >
                    {value === "contain" ? "Fit" : "Fill"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={zoomInputId}
                  className="text-sm font-medium text-foreground/70"
                >
                  Zoom
                </label>
                <span className="text-xs text-black/45">
                  {adjust.zoom.toFixed(2)}x
                </span>
              </div>
              <input
                id={zoomInputId}
                type="range"
                min={COVER_ZOOM_MIN}
                max={COVER_ZOOM_MAX}
                step={COVER_ZOOM_STEP}
                value={adjust.zoom}
                onChange={(event) =>
                  update({ zoom: Number(event.target.value) })
                }
                disabled={disabled}
                className="mt-2 w-full accent-accent"
              />
            </div>

            <p className="text-xs text-black/45">
              Drag the preview to set the focus point (
              {Math.round(adjust.posX)}% / {Math.round(adjust.posY)}%). Fit
              shows the whole image, Fill crops it to the box.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
