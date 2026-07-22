import React, { useEffect, useCallback, useMemo } from "react";
import { useClipboard } from "../../hooks/useClipboard";
import { invoke } from "@tauri-apps/api/core";
import Canvas from "./Canvas";
import Toolbar from "./Toolbar";
import { useAnnotationStore } from "./useAnnotationStore";

interface AnnotationEditorProps {
  imageData: string;
  onClose: () => void;
  onSaved?: (imageData: string) => void;
}

const AnnotationEditor: React.FC<AnnotationEditorProps> = ({
  imageData,
  onClose,
  onSaved,
}) => {
  const { copyImage } = useClipboard();
  const clearAll = useAnnotationStore((s) => s.clearAll);
  const undo = useAnnotationStore((s) => s.undo);
  const redo = useAnnotationStore((s) => s.redo);
  const removeSelected = useAnnotationStore((s) => s.removeSelectedAnnotation);
  const activeTool = useAnnotationStore((s) => s.activeTool);
  const setTool = useAnnotationStore((s) => s.setTool);
  const setZoom = useAnnotationStore((s) => s.setZoom);
  const zoom = useAnnotationStore((s) => s.zoom);

  const [imageSize, setImageSize] = React.useState({ width: 0, height: 0 });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAll();
    };
  }, [clearAll]);

  const handleImageSizeChange = useCallback((w: number, h: number) => {
    setImageSize({ width: w, height: h });
  }, []);

  const exportAnnotatedImage = useCallback((): string | null => {
    const svgEl = document.querySelector("svg");
    if (!svgEl || !imageSize.width) return null;

    const canvas = document.createElement("canvas");
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Draw base image
    const img = new Image();
    img.src = imageData;

    // We need to synchronously draw -- use an existing loaded image
    const baseImg = document.querySelector('img[alt="annotated"]') as HTMLImageElement;
    if (baseImg) {
      ctx.drawImage(baseImg, 0, 0, imageSize.width, imageSize.height);
    }

    // Serialize SVG to data URL and draw as overlay
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const overlayImg = new Image();
    overlayImg.onload = () => {
      ctx.drawImage(overlayImg, 0, 0, imageSize.width, imageSize.height);
      const result = canvas.toDataURL("image/png");
      onSaved?.(result);
      URL.revokeObjectURL(url);
    };
    overlayImg.src = url;

    return canvas.toDataURL("image/png");
  }, [imageData, imageSize, onSaved]);

  const handleCopy = useCallback(async () => {
    const exported = exportAnnotatedImage();
    if (exported) {
      await copyImage(exported);
    }
  }, [exportAnnotatedImage, copyImage]);

  const handleSave = useCallback(async () => {
    const exported = exportAnnotatedImage();
    if (exported) {
      try {
        await invoke("save_capture", { dataUrl: exported });
        onSaved?.(exported);
      } catch {
        // Save failed
      }
    }
  }, [exportAnnotatedImage, onSaved]);

  const handleExport = useCallback(() => {
    exportAnnotatedImage();
  }, [exportAnnotatedImage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const ctrl = e.metaKey || e.ctrlKey;

      if (ctrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (ctrl && e.key === "Z") {
        e.preventDefault();
        redo();
      } else if (ctrl && e.key === "c") {
        e.preventDefault();
        handleCopy();
      } else if (ctrl && e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        removeSelected();
      } else if (e.key === "Escape") {
        if (activeTool !== "select") {
          setTool("select");
        } else {
          onClose();
        }
      } else if (e.key === "v" || e.key === "V") {
        setTool("select");
      } else if (e.key === "a" || e.key === "A") {
        setTool("arrow");
      } else if (e.key === "r" || e.key === "R") {
        setTool("rectangle");
      } else if (e.key === "e" || e.key === "E") {
        setTool("ellipse");
      } else if (e.key === "l" || e.key === "L") {
        setTool("line");
      } else if (e.key === "t" || e.key === "T") {
        setTool("text");
      } else if (e.key === "b" || e.key === "B") {
        setTool("blur");
      } else if (e.key === "c" || e.key === "C") {
        setTool("crop");
      } else if (e.key === "h" || e.key === "H") {
        setTool("highlighter");
      } else if (e.key === "0") {
        setZoom(1);
      } else if (e.key === "=" || e.key === "+") {
        setZoom(zoom + 0.1);
      } else if (e.key === "-") {
        setZoom(zoom - 0.1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, handleCopy, handleSave, removeSelected, activeTool, setTool, onClose, zoom, setZoom]);

  const containerStyle: React.CSSProperties = useMemo(
    () => ({
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      backgroundColor: "var(--color-bg, #1a1a1a)",
      display: "flex",
      flexDirection: "column",
      animation: "fadeIn 0.2s ease-in-out",
    }),
    []
  );

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <Toolbar
        onExport={handleExport}
        onSave={handleSave}
        onCopy={handleCopy}
        onClose={onClose}
      />
      <Canvas imageData={imageData} onImageSizeChange={handleImageSizeChange} />
    </div>
  );
};

export default React.memo(AnnotationEditor);
