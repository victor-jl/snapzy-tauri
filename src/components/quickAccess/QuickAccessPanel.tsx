import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Copy, Edit3, Download, Cloud, Trash2, Share2,
  Pin, Camera, Image, Video, FileImage,
} from "lucide-react";
import { useCaptureStore } from "../../stores/captureStore";
import { useHistoryStore, HistoryItem } from "../../stores/historyStore";
import { useClipboard } from "../../hooks/useClipboard";
import { useUIStore } from "../../stores/uiStore";
import { invoke } from "@tauri-apps/api/core";
import styles from "./QuickAccessPanel.module.css";

interface QuickAccessPanelProps {
  onEditCapture: (imageData: string) => void;
  onClose: () => void;
}

const AUTO_HIDE_MS = 30000;

const QuickAccessPanel: React.FC<QuickAccessPanelProps> = ({
  onEditCapture,
  onClose,
}) => {
  const { t } = useTranslation();
  const { copyImage } = useClipboard();
  const currentScreenshot = useCaptureStore((s) => s.currentScreenshot);
  const cancelCapture = useCaptureStore((s) => s.cancelCapture);
  const openCapture = useUIStore((s) => s.openCapture);
  const historyItems = useHistoryStore((s) => s.items);
  const addItem = useHistoryStore((s) => s.addItem);
  const removeItem = useHistoryStore((s) => s.removeItem);

  const [isPinned, setIsPinned] = useState(false);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionRef = useRef(false);

  const recentItems = historyItems.slice(0, 5);

  // Active preview is current screenshot or selected recent item
  const activePreview = activePreviewId
    ? historyItems.find((item) => item.id === activePreviewId)
    : null;

  const displayImage = activePreview
    ? activePreview.thumbnail
    : currentScreenshot;

  const resetAutoHide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isPinned) {
      timerRef.current = setTimeout(() => {
        if (!interactionRef.current) {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }
      }, AUTO_HIDE_MS);
    }
  }, [isPinned, onClose]);

  useEffect(() => {
    resetAutoHide();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetAutoHide]);

  const markInteraction = useCallback(() => {
    interactionRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const togglePin = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      if (next) {
        markInteraction();
      } else {
        interactionRef.current = false;
        resetAutoHide();
      }
      return next;
    });
  }, [markInteraction, resetAutoHide]);

  const handleCopy = useCallback(async () => {
    markInteraction();
    if (displayImage) {
      await copyImage(displayImage);
    }
  }, [displayImage, copyImage, markInteraction]);

  const handleEdit = useCallback(() => {
    markInteraction();
    if (displayImage) {
      onEditCapture(displayImage);
    }
  }, [displayImage, onEditCapture, markInteraction]);

  const handleSave = useCallback(async () => {
    markInteraction();
    if (displayImage) {
      try {
        await invoke("save_capture", { dataUrl: displayImage });
      } catch {
        // Save failed
      }
    }
  }, [displayImage, markInteraction]);

  const handleUpload = useCallback(async () => {
    markInteraction();
    if (displayImage) {
      try {
        await invoke("upload_capture", { dataUrl: displayImage });
      } catch {
        // Upload failed
      }
    }
  }, [displayImage, markInteraction]);

  const handleDelete = useCallback(() => {
    markInteraction();
    if (activePreviewId) {
      removeItem(activePreviewId);
      setActivePreviewId(null);
    }
    if (!activePreviewId && currentScreenshot) {
      cancelCapture();
      onClose();
    }
  }, [activePreviewId, currentScreenshot, removeItem, cancelCapture, onClose, markInteraction]);

  const handleShare = useCallback(async () => {
    markInteraction();
    // Share functionality would use the OS share sheet
    if (displayImage) {
      try {
        await invoke("share_capture", { dataUrl: displayImage });
      } catch {
        // Share failed or cancelled
      }
    }
  }, [displayImage, markInteraction]);

  const handleQuickCapture = useCallback(() => {
    markInteraction();
    openCapture();
    onClose();
  }, [markInteraction, openCapture, onClose]);

  const handleSelectRecent = useCallback((item: HistoryItem) => {
    markInteraction();
    setActivePreviewId(item.id);
  }, [markInteraction]);

  const getTypeIcon = (type: HistoryItem["type"]) => {
    switch (type) {
      case "recording":
        return <Video size={10} />;
      case "gif":
        return <FileImage size={10} />;
      default:
        return <Image size={10} />;
    }
  };

  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      <div
        className={styles.panel}
        onMouseEnter={markInteraction}
        onMouseLeave={() => {
          interactionRef.current = false;
          resetAutoHide();
        }}
      >
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.headerTitle}>
            {t("quickAccess:recentCaptures")}
          </span>
          <div className={styles.headerActions}>
            <button
              className={isPinned ? styles.headerBtnPinned : styles.headerBtn}
              onClick={togglePin}
              title={isPinned ? "Unpin" : "Pin"}
            >
              <Pin size={14} />
            </button>
            <button
              className={styles.headerBtn}
              onClick={() => {
                setIsVisible(false);
                setTimeout(onClose, 300);
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className={styles.previewContainer}>
          {displayImage ? (
            <img
              className={styles.previewImage}
              src={displayImage}
              alt="Preview"
              onClick={handleEdit}
            />
          ) : (
            <span className={styles.previewPlaceholder}>
              {t("history:noItems")}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={handleCopy}>
            <span className={styles.actionIcon}>
              <Copy size={16} />
            </span>
            <span className={styles.actionLabel}>
              {t("quickAccess:copy")}
            </span>
          </button>
          <button className={styles.actionBtn} onClick={handleEdit}>
            <span className={styles.actionIcon}>
              <Edit3 size={16} />
            </span>
            <span className={styles.actionLabel}>
              {t("quickAccess:openInEditor")}
            </span>
          </button>
          <button className={styles.actionBtn} onClick={handleSave}>
            <span className={styles.actionIcon}>
              <Download size={16} />
            </span>
            <span className={styles.actionLabel}>
              {t("quickAccess:saveAs")}
            </span>
          </button>
          <button className={styles.actionBtn} onClick={handleUpload}>
            <span className={styles.actionIcon}>
              <Cloud size={16} />
            </span>
            <span className={styles.actionLabel}>
              {t("quickAccess:uploadCloud")}
            </span>
          </button>
          <button className={styles.actionBtn} onClick={handleDelete}>
            <span className={styles.actionIcon}>
              <Trash2 size={16} />
            </span>
            <span className={styles.actionLabel}>
              {t("quickAccess:delete")}
            </span>
          </button>
          <button className={styles.actionBtn} onClick={handleShare}>
            <span className={styles.actionIcon}>
              <Share2 size={16} />
            </span>
            <span className={styles.actionLabel}>
              {t("quickAccess:share")}
            </span>
          </button>
        </div>

        {/* Recent Captures */}
        <div className={styles.recentSection}>
          {recentItems.length > 0 ? (
            <>
              <div className={styles.recentTitle}>
                {t("quickAccess:recentCaptures")}
              </div>
              <div className={styles.recentList}>
                {recentItems.map((item) => (
                  <div
                    key={item.id}
                    className={
                      activePreviewId === item.id
                        ? styles.recentItemActive
                        : styles.recentItem
                    }
                    onClick={() => handleSelectRecent(item)}
                  >
                    <img
                      className={styles.recentThumb}
                      src={item.thumbnail}
                      alt={item.id}
                    />
                    <span className={styles.recentTypeIcon}>
                      {getTypeIcon(item.type)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <Camera size={24} className={styles.emptyIcon} />
              <span className={styles.emptyText}>
                {t("history:noItems")}
              </span>
            </div>
          )}
        </div>

        {/* Quick Capture Button */}
        <button className={styles.quickCapture} onClick={handleQuickCapture}>
          <Camera size={14} />
          {t("capture:area")}
        </button>
      </div>
    </div>
  );
};

export default React.memo(QuickAccessPanel);
