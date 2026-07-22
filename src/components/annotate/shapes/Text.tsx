import React, { useState, useRef, useEffect, useCallback } from "react";
import type { Annotation } from "../useAnnotationStore";
import { useAnnotationStore } from "../useAnnotationStore";

interface TextProps {
  annotation: Annotation;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const Text: React.FC<TextProps> = ({ annotation, isSelected, onSelect }) => {
  const { id, x, y, width, height, color, opacity, fontSize, fontFamily } =
    annotation;
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(annotation.text ?? "");
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditValue(annotation.text ?? "");
  }, [annotation.text]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(inputRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    onSelect(id);
    setIsEditing(true);
  }, [id, onSelect]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (editValue !== annotation.text) {
      updateAnnotation(id, { text: editValue });
    }
  }, [editValue, annotation.text, id, updateAnnotation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditValue(annotation.text ?? "");
        setIsEditing(false);
      }
      e.stopPropagation();
    },
    [annotation.text]
  );

  const textContent = annotation.text || "Text";

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        if (!isEditing) onSelect(id);
      }}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: isEditing ? "text" : "pointer" }}
    >
      {isEditing ? (
        <foreignObject
          x={x}
          y={y}
          width={Math.max(width || 200, 200)}
          height={Math.max(height || 60, 60)}
        >
          <div
            ref={inputRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{
              color,
              fontSize: `${fontSize ?? 24}px`,
              fontFamily: fontFamily ?? "Inter, system-ui, sans-serif",
              opacity: opacity / 100,
              outline: "none",
              minWidth: "40px",
              minHeight: "24px",
              width: "100%",
              height: "100%",
              wordBreak: "break-word",
            }}
          >
            {editValue}
          </div>
        </foreignObject>
      ) : (
        <>
          <text
            x={x}
            y={y}
            fill={color}
            opacity={opacity / 100}
            fontSize={fontSize ?? 24}
            fontFamily={fontFamily ?? "Inter, system-ui, sans-serif"}
          >
            {textContent.split("\n").map((line, i) => (
              <tspan key={i} x={x} dy={i === 0 ? fontSize ?? 24 : fontSize ?? 24}>
                {line}
              </tspan>
            ))}
          </text>
          {isSelected && (
            <rect
              x={x - 2}
              y={y - (fontSize ?? 24) - 2}
              width={
                Math.max(
                  ...textContent.split("\n").map((l) => l.length * ((fontSize ?? 24) * 0.6))
                ) + 4
              }
              height={(fontSize ?? 24) * (textContent.split("\n").length || 1) + 4}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
          )}
        </>
      )}
    </g>
  );
};

export default React.memo(Text);
