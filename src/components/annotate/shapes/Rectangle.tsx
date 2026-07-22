import React from "react";
import type { Annotation } from "../useAnnotationStore";

interface RectangleProps {
  annotation: Annotation;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const Rectangle: React.FC<RectangleProps> = ({
  annotation,
  isSelected,
  onSelect,
}) => {
  const {
    id,
    x,
    y,
    width,
    height,
    color,
    strokeWidth,
    opacity,
    data,
  } = annotation;

  const rounded = (data?.rounded as boolean) ?? false;
  const rx = rounded ? Math.min(8, Math.abs(width) * 0.15) : 0;
  const ry = rounded ? Math.min(8, Math.abs(height) * 0.15) : 0;
  const fillColor = (data?.fillColor as string) ?? "transparent";
  const fillOpacity = (data?.fillOpacity as number) ?? 0;

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fillColor}
        fillOpacity={fillOpacity}
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={opacity / 100}
        rx={rx}
        ry={ry}
        strokeDasharray={annotation.type === "highlighter" ? undefined : undefined}
      />
      {isSelected && (
        <>
          <rect
            x={x - 2}
            y={y - 2}
            width={width + 4}
            height={height + 4}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={1}
            strokeDasharray="4 2"
            rx={rx + 2}
            ry={ry + 2}
          />
          {/* Resize handles */}
          {["nw", "ne", "sw", "se"].map((corner) => {
            let hx = x;
            let hy = y;
            if (corner.includes("e")) hx = x + width;
            if (corner.includes("s")) hy = y + height;
            return (
              <rect
                key={corner}
                x={hx - 4}
                y={hy - 4}
                width={8}
                height={8}
                fill="white"
                stroke="var(--color-accent)"
                strokeWidth={1}
                style={{ cursor: `${corner}-resize` }}
              />
            );
          })}
        </>
      )}
    </g>
  );
};

export default React.memo(Rectangle);
