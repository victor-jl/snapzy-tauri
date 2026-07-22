import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Save, PenLine, Trash2, UploadCloud, X } from "lucide-react";
import { useCaptureStore } from "../../stores/captureStore";
import { useClipboard } from "../../hooks/useClipboard";
import { invoke } from "@tauri-apps/api/core";

interface CapturePreviewProps {
  screenshot: string;
  onAnnotate: (imageData: string) => void;
  onDismiss: () => void;
  onNewCapture: () => void;
  autoDismissMs?: number;
}

const CapturePreview: React.FC<CapturePreviewProps> = ({
  screenshot,
  onAnnotate,
  onDismiss,
  onNewCapture,
  autoDismissMs = 5000,
}) => {
  const { t } = useTranslation();
  const { copyImage } = useClipboard();
  const cancelCapture = useCaptureStore((s) => s.cancelCapture);
  const [isVisible, setIsVisible] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionRef = useRef(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const clearAutoDismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startAutoDismiss = useCallback(() => {
    if (!interactionRef.current) {
      clearAutoDismiss();
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, autoDismissMs);
    }
  }, [autoDismissMs, clearAutoDismiss]);

  useEffect(() => {
    startAutoDismiss();
    return clearAutoDismiss;
  }, []);

  const markInteraction = useCallback(() => {
    interactionRef.current = true;
    clearAutoDismiss();
  }, [clearAutoDismiss]);

  const handleCopy = useCallback(async () => {
    markInteraction();
    setIsCopying(true);
    try {
      const success = await copyImage(screenshot);
      if (success) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    } finally {
      setIsCopying(false);
    }
  }, [screenshot, copyImage, markInteraction]);

  const handleSave = useCallback(async () => {
    markInteraction();
    setIsSaving(true);
    try {
      await invoke("save_capture", { dataUrl: screenshot });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // Save failed - silently ignore in preview
    } finally {
      setIsSaving(false);
    }
  }, [screenshot, markInteraction]);

  const handleAnnotate = useCallback(() => {
    markInteraction();
    onAnnotate(screenshot);
  }, [screenshot, onAnnotate, markInteraction]);

  const handleUpload = useCallback(async () => {
    markInteraction();
    try {
      await invoke("upload_capture", { dataUrl: screenshot });
    } catch {
      // Upload failed
    }
  }, [screenshot, markInteraction]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      cancelCapture();
      onDismiss();
    }, 200);
  }, [cancelCapture, onDismiss]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      switch (e.key) {
        case "Escape":
          handleDismiss();
          break;
        case "c":
        case "C":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handleCopy();
          }
          break;
        case "s":
        case "S":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handleSave();
          }
          break;
        case "e":
        case "E":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handleAnnotate();
          }
          break;
        case "Backspace":
        case "Delete":
          handleDismiss();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCopy, handleSave, handleAnnotate, handleDismiss]);

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9998,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(4px)",
    opacity: isVisible ? 1 : 0,
    transition: "opacity 0.2s ease-in-out",
  };

  const imageContainerStyle: React.CSSProperties = {
    position: "relative",
    maxWidth: "90vw",
    maxHeight: "80vh",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
    transform: isVisible ? "scale(1) translateY(0)" : "scale(0.95) translateY(10px)",
    transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
  };

  const imageStyle: React.CSSProperties = {
    display: "block",
    maxWidth: "90vw",
    maxHeight: "calc(80vh - 56px)",
    objectFit: "contain",
  };

  const toolbarStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    gap: 4,
    padding: "8px 12px",
    backgroundColor: "rgba(0,0,0,0.85)",
    backdropFilter: "blur(12px)",
  };

  const btnBaseStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    color: "#fff",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
    backgroundColor: "rgba(255,255,255,0.1)",
  };

  const buttons = [
    {
      icon: Copy,
      label: copySuccess ? t("common:success") : t("capture:copyToClipboard"),
      onClick: handleCopy,
      loading: isCopying,
      success: copySuccess,
    },
    {
      icon: Save,
      label: saveSuccess ? t("common:success") : t("capture:saveToDisk"),
      onClick: handleSave,
      loading: isSaving,
      success: saveSuccess,
    },
    {
      icon: PenLine,
      label: t("capture:openInEditor"),
      onClick: handleAnnotate,
    },
    {
      icon: UploadCloud,
      label: t("capture:uploadToCloud"),
      onClick: handleUpload,
    },
  ];

  return (
    <div style={containerStyle} onClick={handleDismiss}>
      <div
        style={imageContainerStyle}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={markInteraction}
      >
        <img src={screenshot} alt="Captured" style={imageStyle} />
        <div style={toolbarStyle}>
          {buttons.map((btn, i) => (
            <button
              key={i}
              style={{
                ...btnBaseStyle,
                backgroundColor: btn.success
                  ? "rgba(52, 199, 89, 0.3)"
                  : btnBaseStyle.backgroundColor,
              }}
              onClick={btn.onClick}
              disabled={"loading" in btn ? btn.loading : false}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "rgba(255,255,255,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = btn.success
                  ? "rgba(52, 199, 89, 0.3)"
                  : "rgba(255,255,255,0.1)";
              }}
            >
              <btn.icon size={16} />
              {btn.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            style={{
              ...btnBaseStyle,
              backgroundColor: "rgba(255,69,58,0.2)",
              padding: "8px 12px",
            }}
            onClick={handleDismiss}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,69,58,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,69,58,0.2)";
            }}
          >
            <Trash2 size={16} />
            {t("capture:discard")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(CapturePreview);
