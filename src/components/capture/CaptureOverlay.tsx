import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X, Check, Monitor, Maximize2 } from "lucide-react";
import { useCaptureStore, type MonitorInfo, type WindowInfo } from "../../stores/captureStore";
import { useCapture } from "../../hooks/useCapture";
import AreaSelector from "./AreaSelector";
import type { SelectionBounds } from "./AreaSelector";
import CapturePreview from "./CapturePreview";

interface CaptureOverlayProps {
  mode: "fullscreen" | "area" | "window";
  onComplete?: (imageData: string) => void;
  onCancel?: () => void;
  onAnnotate?: (imageData: string) => void;
}

const CaptureOverlay: React.FC<CaptureOverlayProps> = ({
  mode,
  onComplete,
  onCancel,
  onAnnotate,
}) => {
  const { t } = useTranslation();
  const captureStore = useCaptureStore();
  const {
    captureFullscreen,
    captureArea,
    captureWindow,
    fetchMonitors,
    fetchWindows,
    cancelCapture: cancelStoreCapture,
  } = useCapture();
  const [showPreview, setShowPreview] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [hoveredWindow, setHoveredWindow] = useState<WindowInfo | null>(null);
  const [, setIsCapturing] = useState(false);
  const selectedMonitorRef = useRef<number | null>(null);

  useEffect(() => {
    fetchMonitors();
    fetchWindows();
  }, [fetchMonitors, fetchWindows]);

  useEffect(() => {
    if (mode === "fullscreen") {
      handleFullscreenCapture();
    }
  }, [mode]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelStoreCapture();
        onCancel?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelStoreCapture, onCancel]);

  const handleFullscreenCapture = useCallback(async () => {
    setIsCapturing(true);
    const result = await captureFullscreen();
    setIsCapturing(false);
    if (result) {
      setCurrentScreenshot(result);
      setShowPreview(true);
      onComplete?.(result);
    } else {
      cancelStoreCapture();
      onCancel?.();
    }
  }, [captureFullscreen, cancelStoreCapture, onCancel, onComplete]);

  const handleAreaSelect = useCallback(
    async (bounds: SelectionBounds) => {
      setIsCapturing(true);
      const result = await captureArea(
        Math.round(bounds.x),
        Math.round(bounds.y),
        Math.round(bounds.width),
        Math.round(bounds.height)
      );
      setIsCapturing(false);
      if (result) {
        setCurrentScreenshot(result);
        setShowPreview(true);
        onComplete?.(result);
      }
    },
    [captureArea, onComplete]
  );

  const handleWindowCapture = useCallback(
    async (windowInfo: WindowInfo) => {
      setIsCapturing(true);
      const result = await captureWindow(windowInfo.title);
      setIsCapturing(false);
      if (result) {
        setCurrentScreenshot(result);
        setShowPreview(true);
        onComplete?.(result);
      }
    },
    [captureWindow, onComplete]
  );

  const handlePreviewAnnotate = useCallback(
    (imageData: string) => {
      setShowPreview(false);
      onAnnotate?.(imageData);
    },
    [onAnnotate]
  );

  const handlePreviewDismiss = useCallback(() => {
    setShowPreview(false);
    setCurrentScreenshot(null);
    cancelStoreCapture();
    onCancel?.();
  }, [cancelStoreCapture, onCancel]);

  const handleNewCapture = useCallback(() => {
    setShowPreview(false);
    setCurrentScreenshot(null);
  }, []);

  const overlayStyle: React.CSSProperties = useMemo(
    () => ({
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      backgroundColor: "rgba(0,0,0,0.3)",
      backdropFilter: "blur(1px)",
      cursor: mode === "area" ? "crosshair" : "default",
      userSelect: "none",
    }),
    [mode]
  );

  if (showPreview && currentScreenshot) {
    return (
      <CapturePreview
        screenshot={currentScreenshot}
        onAnnotate={handlePreviewAnnotate}
        onDismiss={handlePreviewDismiss}
        onNewCapture={handleNewCapture}
      />
    );
  }

  if (mode === "area") {
    return (
      <>
        <div style={overlayStyle} />
        <AreaSelector
          onSelect={handleAreaSelect}
          onCancel={() => {
            cancelStoreCapture();
            onCancel?.();
          }}
        />
      </>
    );
  }

  if (mode === "window") {
    return <WindowSelector monitors={captureStore.monitors} windows={captureStore.windows} onSelectWindow={handleWindowCapture} onCancel={() => { cancelStoreCapture(); onCancel?.(); }} />;
  }

  return (
    <div
      style={{
        ...overlayStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--color-bg, #1c1c1e)",
          color: "var(--color-text, #fff)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 400,
          textAlign: "center",
          boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
        }}
      >
        <p style={{ fontSize: 16, marginBottom: 12 }}>
          {t("capture:capturing")}
        </p>
        <button
          onClick={() => {
            cancelStoreCapture();
            onCancel?.();
          }}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "none",
            backgroundColor: "var(--color-accent, #FF453A)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {t("capture:cancel")}
        </button>
      </div>
    </div>
  );
};

// Window selector sub-component
interface WindowSelectorProps {
  monitors: MonitorInfo[];
  windows: WindowInfo[];
  onSelectWindow: (win: WindowInfo) => void;
  onCancel: () => void;
}

const WindowSelector: React.FC<WindowSelectorProps> = ({
  monitors,
  windows,
  onSelectWindow,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedMonitor, setSelectedMonitor] = useState<number | null>(null);

  const filteredWindows = useMemo(() => {
    if (selectedMonitor === null) return windows;
    const mon = monitors.find((m) => m.id === selectedMonitor);
    if (!mon) return windows;
    return windows.filter((w) => {
      const wx = w.x + w.width / 2;
      const wy = w.y + w.height / 2;
      return (
        wx >= mon.x &&
        wx <= mon.x + mon.width &&
        wy >= mon.y &&
        wy <= mon.y + mon.height
      );
    });
  }, [windows, monitors, selectedMonitor]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 10020,
    padding: "6px 12px",
    backgroundColor: "rgba(0,0,0,0.85)",
    color: "#fff",
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "system-ui, sans-serif",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(0,0,0,0.3)",
      }}
    >
      {/* Monitor selector */}
      {monitors.length > 1 && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10010,
            display: "flex",
            gap: 8,
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(12px)",
            borderRadius: 10,
            padding: "6px 8px",
          }}
        >
          <button
            onClick={() => setSelectedMonitor(null)}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              backgroundColor:
                selectedMonitor === null ? "var(--color-accent, #FF453A)" : "rgba(255,255,255,0.1)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Monitor size={14} />
            {t("capture:allMonitors")}
          </button>
          {monitors.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMonitor(m.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                backgroundColor:
                  selectedMonitor === m.id ? "var(--color-accent, #FF453A)" : "rgba(255,255,255,0.1)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {m.is_primary ? `${m.name} ★` : m.name}
            </button>
          ))}
        </div>
      )}

      {/* Window thumbnails */}
      {filteredWindows
        .filter((w) => !w.is_minimized)
        .map((win) => {
          const isHovered = hoveredId === win.id;
          return (
            <div
              key={win.id}
              onClick={() => onSelectWindow(win)}
              onMouseEnter={() => setHoveredId(win.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                position: "fixed",
                left: win.x,
                top: win.y,
                width: win.width,
                height: win.height,
                border: isHovered
                  ? "2px solid var(--color-accent, #FF453A)"
                  : "2px solid rgba(255,255,255,0.3)",
                backgroundColor: isHovered
                  ? "rgba(74, 158, 255, 0.1)"
                  : "transparent",
                borderRadius: 4,
                cursor: "pointer",
                zIndex: 10005,
                transition: "border-color 0.15s ease, background-color 0.15s ease",
              }}
            >
              {isHovered && (
                <div
                  style={{
                    position: "absolute",
                    top: -28,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      backgroundColor: "rgba(0,0,0,0.85)",
                      color: "#fff",
                      padding: "3px 10px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "system-ui, sans-serif",
                      whiteSpace: "nowrap",
                      maxWidth: win.width - 20,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {win.title || win.app_name}
                  </span>
                </div>
              )}
            </div>
          );
        })}

      {/* Info hint */}
      <div
        style={{
          position: "fixed",
          bottom: 30,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10010,
          color: "rgba(255,255,255,0.6)",
          fontSize: 13,
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        {t("capture:selectWindow")} —{" "}
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
          Esc {t("capture:cancel")}
        </span>
      </div>
    </div>
  );
};

export default React.memo(CaptureOverlay);
