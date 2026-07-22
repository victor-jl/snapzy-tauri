import React from "react";
import type { Annotation } from "../useAnnotationStore";

interface BlurToolProps {
  annotation: Annotation;
  isSelected: boolean;
  onSelect: (id: string) => void;
  blurIntensity: number;
}

const BlurTool: React.FC<BlurToolProps> = ({
  annotation,
  isSelected,
  onSelect,
  blurIntensity,
}) => {
  const { id, x, y, width, height } = annotation;

  if (width <= 0 || height <= 0) return null;

  const filterId = `blur-${id}`;
  const clipId = `clip-${id}`;

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      style={{ cursor: "pointer" }}
    >
      <defs>
        <filter id={filterId}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={blurIntensity / 5} />
        </filter>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={width} height={height} rx={4} />
        </clipPath>
      </defs>
      <image
        href={annotation.data?.imageHref as string ?? ""}
        x={x}
        y={y}
        width={width}
        height={height}
        filter={`url(#${filterId})`}
        clipPath={`url(#${clipId})`}
        preserveAspectRatio="none"
        style={{ pointerEvents: "none" }}
      />
      {/* Semi-transparent overlay to indicate blur region */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="rgba(128, 128, 128, 0.15)"
        stroke={isSelected ? "var(--color-accent)" : "rgba(255,255,255,0.4)"}
        strokeWidth={isSelected ? 2 : 1}
        strokeDasharray={isSelected ? "4 2" : undefined}
        rx={4}
      />
      {isSelected && (
        <>
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

export default React.memo(BlurTool);
