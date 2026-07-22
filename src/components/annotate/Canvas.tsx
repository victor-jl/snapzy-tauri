import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { useAnnotationStore, type Annotation } from "./useAnnotationStore";
import Arrow from "./shapes/Arrow";
import Rectangle from "./shapes/Rectangle";
import Ellipse from "./shapes/Ellipse";
import Line from "./shapes/Line";
import Text from "./shapes/Text";
import BlurTool from "./tools/BlurTool";
import CropTool from "./tools/CropTool";

interface CanvasProps {
  imageData: string;
  onImageSizeChange?: (width: number, height: number) => void;
}

const Canvas: React.FC<CanvasProps> = ({ imageData, onImageSizeChange }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isGridVisible, setGridVisible] = useState(false);

  const annotations = useAnnotationStore((s) => s.annotations);
  const activeTool = useAnnotationStore((s) => s.activeTool);
  const selectedAnnotationId = useAnnotationStore((s) => s.selectedAnnotationId);
  const selectAnnotation = useAnnotationStore((s) => s.selectAnnotation);
  const addAnnotation = useAnnotationStore((s) => s.addAnnotation);
  const saveHistorySnapshot = useAnnotationStore((s) => s.saveHistorySnapshot);
  const createAnnotation = useAnnotationStore((s) => s.createAnnotation);
  const zoom = useAnnotationStore((s) => s.zoom);
  const setZoom = useAnnotationStore((s) => s.setZoom);
  const panOffset = useAnnotationStore((s) => s.panOffset);
  const setPan = useAnnotationStore((s) => s.setPan);
  const strokeColor = useAnnotationStore((s) => s.strokeColor);
  const strokeWidth = useAnnotationStore((s) => s.strokeWidth);
  const opacity = useAnnotationStore((s) => s.opacity);
  const blurIntensity = useAnnotationStore((s) => s.blurIntensity);

  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);

  // Load image dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      onImageSizeChange?.(img.naturalWidth, img.naturalHeight);
    };
    img.src = imageData;
  }, [imageData, onImageSizeChange]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpaceDown(true);
      }
      if (e.key === "g" || e.key === "G") {
        setGridVisible((v) => !v);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceDown(false);
        setIsPanning(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Mouse wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom(zoom + delta);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [zoom, setZoom]);

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const x = (clientX - rect.left - panOffset.x) / zoom;
      const y = (clientY - rect.top - panOffset.y) / zoom;
      return { x, y };
    },
    [zoom, panOffset]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && spaceDown)) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        return;
      }
      if (e.button !== 0) return;

      const pt = screenToCanvas(e.clientX, e.clientY);

      if (activeTool === "select") {
        selectAnnotation(null);
        return;
      }

      setDrawStart(pt);
      setDrawCurrent(pt);

      const annotation = createAnnotation(activeTool, {
        x: pt.x,
        y: pt.y,
        width: 0,
        height: 0,
        points: [
          { x: pt.x, y: pt.y },
          { x: pt.x, y: pt.y },
        ],
      });
      // Store as drawing annotation
      useAnnotationStore.setState({ isDrawing: true, drawingAnnotation: annotation });
    },
    [activeTool, screenToCanvas, spaceDown, panOffset, selectAnnotation, createAnnotation]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
        return;
      }

      if (!drawStart || activeTool === "select") return;

      const pt = screenToCanvas(e.clientX, e.clientY);
      setDrawCurrent(pt);

      const drawingAnn = useAnnotationStore.getState().drawingAnnotation;
      if (!drawingAnn) return;

      const nx = Math.min(drawStart.x, pt.x);
      const ny = Math.min(drawStart.y, pt.y);
      const nw = Math.abs(pt.x - drawStart.x);
      const nh = Math.abs(pt.y - drawStart.y);

      useAnnotationStore.setState({
        drawingAnnotation: {
          ...drawingAnn,
          x: nx,
          y: ny,
          width: nw,
          height: nh,
          points: [
            { x: drawStart.x, y: drawStart.y },
            { x: pt.x, y: pt.y },
          ],
        },
      });
    },
    [isPanning, drawStart, activeTool, screenToCanvas, panStart, setPan]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setIsPanning(false);
        return;
      }

      if (activeTool === "select") return;

      const drawingAnn = useAnnotationStore.getState().drawingAnnotation;
      if (!drawingAnn || !drawStart) {
        setDrawStart(null);
        setDrawCurrent(null);
        return;
      }

      const pt = screenToCanvas(e.clientX, e.clientY);
      const nx = Math.min(drawStart.x, pt.x);
      const ny = Math.min(drawStart.y, pt.y);
      const nw = Math.abs(pt.x - drawStart.x);
      const nh = Math.abs(pt.y - drawStart.y);

      if (nw > 3 || nh > 3 || activeTool === "text" || activeTool === "stepCounter") {
        saveHistorySnapshot();
        addAnnotation({
          ...drawingAnn,
          x: nx,
          y: ny,
          width: nw,
          height: nh,
          points: [
            { x: drawStart.x, y: drawStart.y },
            { x: pt.x, y: pt.y },
          ],
        });
      }

      setDrawStart(null);
      setDrawCurrent(null);
      useAnnotationStore.setState({ isDrawing: false, drawingAnnotation: null });
    },
    [isPanning, activeTool, drawStart, screenToCanvas, saveHistorySnapshot, addAnnotation]
  );

  const handleSVGClick = useCallback(() => {
    if (activeTool === "select") {
      selectAnnotation(null);
    }
  }, [activeTool, selectAnnotation]);

  const drawingAnn = useAnnotationStore((s) => s.drawingAnnotation);

  const cursorStyle = useMemo(() => {
    if (spaceDown) return "grab";
    if (isPanning) return "grabbing";
    if (activeTool === "select") return "default";
    return "crosshair";
  }, [spaceDown, isPanning, activeTool]);

  const renderDrawingPreview = () => {
    if (!drawingAnn || !drawCurrent || activeTool === "select") return null;
    const { x, y, width, height } = drawingAnn;

    if (width <= 0 && height <= 0) return null;

    const previewStyle = {
      pointerEvents: "none" as const,
    };

    switch (activeTool) {
      case "arrow":
        return (
          <g style={previewStyle}>
            <line
              x1={x}
              y1={y}
              x2={x + width}
              y2={y + height}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              opacity={opacity / 100}
              strokeDasharray="6 3"
            />
          </g>
        );
      case "rectangle":
      case "highlighter":
        return (
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={activeTool === "highlighter" ? "rgba(255, 255, 0, 0.3)" : "rgba(74, 158, 255, 0.1)"}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity / 100}
            strokeDasharray="6 3"
            style={previewStyle}
          />
        );
      case "ellipse":
        return (
          <ellipse
            cx={x + width / 2}
            cy={y + height / 2}
            rx={Math.abs(width) / 2}
            ry={Math.abs(height) / 2}
            fill="rgba(74, 158, 255, 0.1)"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity / 100}
            strokeDasharray="6 3"
            style={previewStyle}
          />
        );
      case "line":
        return (
          <line
            x1={x}
            y1={y}
            x2={x + width}
            y2={y + height}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity / 100}
            strokeDasharray="6 3"
            style={previewStyle}
          />
        );
      case "text":
      case "stepCounter":
        return (
          <rect
            x={x}
            y={y}
            width={Math.max(width || 100, 100)}
            height={Math.max(height || 30, 30)}
            fill="rgba(255,255,255,0.1)"
            stroke={strokeColor}
            strokeWidth={1}
            strokeDasharray="6 3"
            style={previewStyle}
          />
        );
      case "blur":
        return (
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill="rgba(128, 128, 128, 0.2)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1}
            strokeDasharray="6 3"
            rx={4}
            style={previewStyle}
          />
        );
      case "crop":
        return (
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill="none"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={1}
            strokeDasharray="6 3"
            style={previewStyle}
          />
        );
      default:
        return null;
    }
  };

  const renderAnnotation = (ann: Annotation) => {
    const isSelected = ann.id === selectedAnnotationId;

    switch (ann.type) {
      case "arrow":
        return (
          <Arrow key={ann.id} annotation={ann} isSelected={isSelected} onSelect={selectAnnotation} />
        );
      case "rectangle":
      case "highlighter":
        return (
          <Rectangle key={ann.id} annotation={ann} isSelected={isSelected} onSelect={selectAnnotation} />
        );
      case "ellipse":
        return (
          <Ellipse key={ann.id} annotation={ann} isSelected={isSelected} onSelect={selectAnnotation} />
        );
      case "line":
        return (
          <Line key={ann.id} annotation={ann} isSelected={isSelected} onSelect={selectAnnotation} />
        );
      case "text":
      case "stepCounter":
        return (
          <Text key={ann.id} annotation={ann} isSelected={isSelected} onSelect={selectAnnotation} />
        );
      case "blur":
        return (
          <BlurTool
            key={ann.id}
            annotation={{ ...ann, data: { ...ann.data, imageHref: imageData } }}
            isSelected={isSelected}
            onSelect={selectAnnotation}
            blurIntensity={blurIntensity}
          />
        );
      case "crop":
        return (
          <CropTool key={ann.id} annotation={ann} isSelected={isSelected} onSelect={selectAnnotation} />
        );
      default:
        return null;
    }
  };

  const { width: imgW, height: imgH } = imageSize;

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "var(--color-bg, #1a1a1a)",
        cursor: cursorStyle,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        }}
      >
        {/* Image and SVG layer */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: "center center",
          }}
        >
          <img
            src={imageData}
            alt="annotated"
            style={{ display: "block", pointerEvents: "none" }}
            draggable={false}
          />

          <svg
            ref={svgRef}
            width={imgW}
            height={imgH}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              overflow: "visible",
            }}
            onClick={handleSVGClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {/* Grid overlay */}
            {isGridVisible && imgW > 0 && (
              <g opacity={0.12} pointerEvents="none">
                {Array.from({ length: Math.ceil(imgW / 20) }).map((_, i) => (
                  <line key={`vg-${i}`} x1={i * 20} y1={0} x2={i * 20} y2={imgH} stroke="#fff" strokeWidth={0.5} />
                ))}
                {Array.from({ length: Math.ceil(imgH / 20) }).map((_, i) => (
                  <line key={`hg-${i}`} x1={0} y1={i * 20} x2={imgW} y2={i * 20} stroke="#fff" strokeWidth={0.5} />
                ))}
              </g>
            )}

            {/* Rendered annotations */}
            {annotations.map(renderAnnotation)}

            {/* Drawing preview */}
            {renderDrawingPreview()}
          </svg>
        </div>
      </div>

      {/* Ruler guides on edges */}
      {imgW > 0 && (
        <>
          {/* Top ruler */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 48,
              right: 0,
              height: 0,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              pointerEvents: "none",
            }}
          />
          {/* Left ruler */}
          <div
            style={{
              position: "absolute",
              left: 48,
              top: 0,
              bottom: 0,
              width: 0,
              borderLeft: "1px solid rgba(255,255,255,0.06)",
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* Zoom indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 56,
          right: 16,
          backgroundColor: "rgba(0,0,0,0.7)",
          color: "#fff",
          padding: "3px 8px",
          borderRadius: 4,
          fontSize: 11,
          fontFamily: "monospace",
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
};

export default React.memo(Canvas);
