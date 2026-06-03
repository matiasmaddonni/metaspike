"use client";

type Props = {
  imageUrl: string | null;
  cursorX: number;
  cursorY: number;
};

const POPOVER_WIDTH = 240;
const POPOVER_HEIGHT = 340;

export function CardPopover({ imageUrl, cursorX, cursorY }: Props) {
  if (!imageUrl) return null;
  const vw = typeof window !== "undefined" ? window.innerWidth : POPOVER_WIDTH;
  const vh = typeof window !== "undefined" ? window.innerHeight : POPOVER_HEIGHT;
  const left = Math.min(cursorX + 20, vw - (POPOVER_WIDTH + 20));
  const top = Math.min(cursorY, vh - (POPOVER_HEIGHT + 20));
  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        width: POPOVER_WIDTH,
        zIndex: 80,
        pointerEvents: "none",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 18px 50px rgba(0,0,0,.7)",
        border: "1px solid #2a2e38",
        background: "#000",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="" style={{ width: "100%", display: "block" }} />
    </div>
  );
}
