import React from "react";
import type { Annotation } from "../useAnnotationStore";

interface CropToolProps {
  annotation: Annotation;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const CropTool: React.FC<CropToolProps> = ({
  annotation,
  isSelected,
  onSelect,
}) => {
  const { id, x, y, width, height } = annotation;

  if (width <= 0 || height <= 0) return null;

  const dashColor = isSelected ? "var(--color-accent)" : "rgba(255,255,255,0.7)";
  const dashWidth = isSelected ? 2 : 1;

  // Rule of thirds lines
  const thirdW = width / 3;
  const thirdH = height / 3;

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      style={{ cursor: "pointer" }}
    >
      {/* Darken outside area */}
      <rect
        x={0}
        y={0}
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.5)"
        style={{ pointerEvents: "none" }}
      />
      {/* Clear crop area */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        style={{ pointerEvents: "none" }}
      />
      {/* Reset the overlay using mask */}
      <defs>
        <mask id={`crop-mask-${id}`}>
          <rect x={0} y={0} width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={width} height={height} fill="black" />
        </mask>
        <rect
          x={0}
          y={0}
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask={`url(#crop-mask-${id})`}
          style={{ pointerEvents: "none" }}
        />
      </defs>
      <rect
        x={0}
        y={0}
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.55)"
        mask={`url(#crop-mask-${id})`}
        style={{ pointerEvents: "none" }}
      />
      {/* Crop border */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={dashColor}
        strokeWidth={dashWidth}
      />
      {/* Rule of thirds grid */}
      <line
        x1={x + thirdW}
        y1={y}
        x2={x + thirdW}
        y2={y + height}
        stroke={dashColor}
        strokeWidth={0.5}
        strokeDasharray="4 4"
      />
      <line
        x1={x + thirdW * 2}
        y1={y}
        x2={x + thirdW * 2}
        y2={y + height}
        stroke={dashColor}
        strokeWidth={0.5}
        strokeDasharray="4 4"
      />
      <line
        x1={x}
        y1={y + thirdH}
        x2={x + width}
        y2={y + thirdH}
        stroke={dashColor}
        strokeWidth={0.5}
        strokeDasharray="4 4"
      />
      <line
        x1={x}
        y1={y + thirdH * 2}
        x2={x + width}
        y2={y + thirdH * 2}
        stroke={dashColor}
        strokeWidth={0.5}
        strokeDasharray="4 4"
      />
      {/* Corner handles */}
      {[
        { x: x - 1, y: y - 1 },
        { x: x + width - 1, y: y - 1 },
        { x: x - 1, y: y + height - 1 },
        { x: x + width - 1, y: y + height - 1 },
      ].map((h, i) => (
        <rect
          key={i}
          x={h.x - 4}
          y={h.y - 4}
          width={10}
          height={10}
          fill="transparent"
          stroke={dashColor}
          strokeWidth={dashWidth}
        />
      ))}
      {/* Dimensions label */}
      <text
        x={x + width / 2}
        y={y - 8}
        textAnchor="middle"
        fill={dashColor}
        fontSize={12}
        fontFamily="system-ui, monospace"
      >
        {`${Math.round(width)} × ${Math.round(height)}`}
      </text>
    </g>
  );
};

export default React.memo(CropTool);
