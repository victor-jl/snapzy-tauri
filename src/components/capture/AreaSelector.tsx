import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AreaSelectorProps {
  onSelect: (bounds: SelectionBounds) => void;
  onCancel: () => void;
  monitorBounds?: { x: number; y: number; width: number; height: number };
}

const SNAP_THRESHOLD = 10;
const MIN_SELECTION = 10;

const AreaSelector: React.FC<AreaSelectorProps> = ({
  onSelect,
  onCancel,
  monitorBounds,
}) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [magnifierPos, setMagnifierPos] = useState({ x: -100, y: -100 });
  const [selection, setSelection] = useState<SelectionBounds | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);

  const snapToEdge = useCallback(
    (value: number, edgeValue: number): number => {
      return Math.abs(value - edgeValue) <= SNAP_THRESHOLD ? edgeValue : value;
    },
    []
  );

  const getNormalizedBounds = useCallback(
    (sx: number, sy: number, ex: number, ey: number): SelectionBounds => {
      let x = Math.min(sx, ex);
      let y = Math.min(sy, ey);
      let width = Math.abs(ex - sx);
      let height = Math.abs(ey - sy);

      if (width >= MIN_SELECTION || height >= MIN_SELECTION) {
        if (monitorBounds) {
          x = snapToEdge(x, monitorBounds.x);
          y = snapToEdge(y, monitorBounds.y);
          const rightEdge = x + width;
          const bottomEdge = y + height;
          const monRight = monitorBounds.x + monitorBounds.width;
          const monBottom = monitorBounds.y + monitorBounds.height;

          if (Math.abs(rightEdge - monRight) <= SNAP_THRESHOLD) {
            x = monRight - width;
          }
          if (Math.abs(bottomEdge - monBottom) <= SNAP_THRESHOLD) {
            y = monBottom - height;
          }
          x = Math.max(x, monitorBounds.x);
          y = Math.max(y, monitorBounds.y);
          width = Math.min(width, monRight - x);
          height = Math.min(height, monBottom - y);
        }
      }

      return { x, y, width, height };
    },
    [monitorBounds, snapToEdge]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const x = e.clientX;
      const y = e.clientY;
      setStartPos({ x, y });
      setCurrentPos({ x, y });
      setIsDragging(true);
      setSelection(null);
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      setMagnifierPos({ x: e.clientX, y: e.clientY });
      if (!isDragging) return;

      const newPos = { x: e.clientX, y: e.clientY };
      setCurrentPos(newPos);

      const bounds = getNormalizedBounds(
        startPos.x,
        startPos.y,
        newPos.x,
        newPos.y
      );
      if (bounds.width >= MIN_SELECTION || bounds.height >= MIN_SELECTION) {
        setSelection(bounds);
      }
    },
    [isDragging, startPos, getNormalizedBounds]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setIsDragging(false);

      const finalBounds = getNormalizedBounds(
        startPos.x,
        startPos.y,
        e.clientX,
        e.clientY
      );
      if (
        finalBounds.width >= MIN_SELECTION &&
        finalBounds.height >= MIN_SELECTION
      ) {
        onSelect(finalBounds);
      }
      setSelection(null);
    },
    [isDragging, startPos, getNormalizedBounds, onSelect]
  );

  // Magnifier rendering
  useEffect(() => {
    const renderMagnifier = () => {
      const canvas = magnifierCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const MAG_SIZE = 120;
      const ZOOM = 3;
      const HALF_MAG = MAG_SIZE / 2;
      const SAMPLE_SIZE = HALF_MAG / ZOOM;

      canvas.width = MAG_SIZE;
      canvas.height = MAG_SIZE;

      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, MAG_SIZE, MAG_SIZE);

      // @ts-expect-error: experimental captureStream/capture
      if (typeof window !== "undefined" && "createImageCapture" in window) {
        // Fallback - draw grid pattern
      }

      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= MAG_SIZE; i += MAG_SIZE / ZOOM) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, MAG_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(MAG_SIZE, i);
        ctx.stroke();
      }

      // Center crosshair
      ctx.strokeStyle = "#FF453A";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(HALF_MAG - 8, HALF_MAG);
      ctx.lineTo(HALF_MAG + 8, HALF_MAG);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(HALF_MAG, HALF_MAG - 8);
      ctx.lineTo(HALF_MAG, HALF_MAG + 8);
      ctx.stroke();

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(1, 1, MAG_SIZE - 2, MAG_SIZE - 2);

      animFrameRef.current = requestAnimationFrame(renderMagnifier);
    };

    animFrameRef.current = requestAnimationFrame(renderMagnifier);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    cursor: isDragging ? "crosshair" : "crosshair",
    userSelect: "none",
  };

  const selectionStyle: React.CSSProperties = selection
    ? {
        position: "fixed",
        left: selection.x,
        top: selection.y,
        width: selection.width,
        height: selection.height,
        border: "2px dashed #4A9EFF",
        backgroundColor: "rgba(74, 158, 255, 0.15)",
        borderRadius: 0,
        transition: "none",
        pointerEvents: "none",
        zIndex: 10001,
      }
    : {};

  const magnifierStyle: React.CSSProperties = {
    position: "fixed",
    left: magnifierPos.x + 20,
    top: magnifierPos.y + 20,
    width: 120,
    height: 120,
    borderRadius: "50%",
    border: "2px solid var(--color-border, rgba(255,255,255,0.3))",
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: 10002,
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
  };

  const dimsTooltipStyle: React.CSSProperties = selection
    ? {
        position: "fixed",
        left: selection.x + selection.width / 2,
        top: selection.y + selection.height + 8,
        transform: "translateX(-50%)",
        backgroundColor: "rgba(0,0,0,0.8)",
        color: "#fff",
        padding: "4px 10px",
        borderRadius: 4,
        fontSize: 12,
        fontFamily: "monospace",
        pointerEvents: "none",
        zIndex: 10002,
        whiteSpace: "nowrap",
      }
    : {};

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {selection && <div style={selectionStyle} />}

      {selection && (
        <div style={dimsTooltipStyle}>
          {Math.round(selection.width)} × {Math.round(selection.height)}
        </div>
      )}

      <canvas
        ref={magnifierCanvasRef}
        style={magnifierStyle}
      />
    </div>
  );
};

export default React.memo(AreaSelector);
