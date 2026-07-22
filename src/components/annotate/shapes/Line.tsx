import React from "react";
import type { Annotation } from "../useAnnotationStore";

interface LineProps {
  annotation: Annotation;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const Line: React.FC<LineProps> = ({
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
    points,
  } = annotation;

  const startX = points.length >= 2 ? points[0].x : x;
  const startY = points.length >= 2 ? points[0].y : y;
  const endX = points.length >= 2 ? points[1].x : x + width;
  const endY = points.length >= 2 ? points[1].y : y + height;

  const minX = Math.min(startX, endX);
  const minY = Math.min(startY, endY);
  const absW = Math.abs(endX - startX);
  const absH = Math.abs(endY - startY);
  const selPadding = Math.max(strokeWidth / 2 + 2, 6);

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      style={{ cursor: "pointer" }}
    >
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={opacity / 100}
        strokeLinecap="round"
      />
      {isSelected && (
        <rect
          x={minX - selPadding}
          y={minY - selPadding}
          width={absW + selPadding * 2}
          height={absH + selPadding * 2}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      )}
    </g>
  );
};

export default React.memo(Line);
