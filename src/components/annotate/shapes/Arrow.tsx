import React from "react";
import type { Annotation } from "../useAnnotationStore";

interface ArrowProps {
  annotation: Annotation;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const Arrow: React.FC<ArrowProps> = ({ annotation, isSelected, onSelect }) => {
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

  const markerId = `arrowhead-${id}`;

  const arrowSize = Math.max(8, strokeWidth * 3);

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      style={{ cursor: "pointer" }}
    >
      <defs>
        <marker
          id={markerId}
          markerWidth={arrowSize}
          markerHeight={arrowSize}
          refX={arrowSize}
          refY={arrowSize / 2}
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polygon
            points={`0,0 ${arrowSize},${arrowSize / 2} 0,${arrowSize}`}
            fill={color}
            opacity={opacity / 100}
          />
        </marker>
      </defs>
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={opacity / 100}
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
      />
      {isSelected && (
        <rect
          x={Math.min(startX, endX) - 4}
          y={Math.min(startY, endY) - 4}
          width={Math.abs(endX - startX) + 8}
          height={Math.abs(endY - startY) + 8}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      )}
    </g>
  );
};

export default React.memo(Arrow);
