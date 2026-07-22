import React from "react";
import type { Annotation } from "../useAnnotationStore";

interface EllipseProps {
  annotation: Annotation;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const Ellipse: React.FC<EllipseProps> = ({
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

  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = Math.abs(width) / 2;
  const ry = Math.abs(height) / 2;
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
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill={fillColor}
        fillOpacity={fillOpacity}
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={opacity / 100}
      />
      {isSelected && (
        <>
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx + 2}
            ry={ry + 2}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={1}
            strokeDasharray="4 2"
          />
          {/* Bounding box resize handles */}
          {[
            { cx: x, cy: y },
            { cx: x + width, cy: y },
            { cx: x, cy: y + height },
            { cx: x + width, cy: y + height },
          ].map((h, i) => (
            <rect
              key={i}
              x={h.cx - 4}
              y={h.cy - 4}
              width={8}
              height={8}
              fill="white"
              stroke="var(--color-accent)"
              strokeWidth={1}
            />
          ))}
        </>
      )}
    </g>
  );
};

export default React.memo(Ellipse);
