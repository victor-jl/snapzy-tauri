import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Trash2, Edit3, Video, Play } from "lucide-react";
import { formatTimeAgo, formatFileSize } from "../../utils/format";
import type { HistoryItem as HistoryItemType } from "../../stores/historyStore";
import styles from "./HistoryItem.module.css";

interface HistoryItemProps {
  item: HistoryItemType;
  isSelected: boolean;
  selectMode: boolean;
  onSelect: (id: string) => void;
  onClick: (item: HistoryItemType) => void;
  onCopy: (item: HistoryItemType) => void;
  onEdit: (item: HistoryItemType) => void;
  onDelete: (id: string) => void;
  onCheckToggle: (id: string) => void;
  checked: boolean;
  gridView?: boolean;
}

// Generate a friendly file size since HistoryItem doesn't store it
function getEstimatedSize(item: HistoryItemType): number {
  if (item.thumbnail && item.thumbnail.startsWith("data:")) {
    // Rough estimate: base64 string length * 0.75
    return Math.round(item.thumbnail.length * 0.75);
  }
  return 0;
}

function getFilename(item: HistoryItemType): string {
  const ext = item.type === "recording" ? "mp4" : item.type === "gif" ? "gif" : "png";
  const date = new Date(item.timestamp);
  const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
  return `Capture_${dateStr}.${ext}`;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
  item,
  isSelected,
  selectMode,
  onSelect,
  onClick,
  onCopy,
  onEdit,
  onDelete,
  onCheckToggle,
  checked,
  gridView,
}) => {
  const { t } = useTranslation();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest('input[type="checkbox"]')) {
        return;
      }
      if (selectMode) {
        onCheckToggle(item.id);
      } else {
        onClick(item);
      }
    },
    [selectMode, item, onCheckToggle, onClick]
  );

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCopy(item);
    },
    [item, onCopy]
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit(item);
    },
    [item, onEdit]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(item.id);
    },
    [item.id, onDelete]
  );

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onCheckToggle(item.id);
    },
    [item.id, onCheckToggle]
  );

  const typeLabel = item.annotated
    ? t("history:filterAnnotated")
    : item.type === "recording"
      ? t("history:typeRecording")
      : item.type === "gif"
        ? t("history:typeGif")
        : t("history:typeScreenshot");

  const typeBadgeClass =
    item.annotated
      ? styles.typeBadgeAnnotated
      : item.type === "recording"
        ? styles.typeBadgeRecording
        : item.type === "gif"
          ? styles.typeBadgeGif
          : styles.typeBadgeScreenshot;

  const estimatedSize = getEstimatedSize(item);

  const itemClass = isSelected ? styles.itemSelected : styles.item;
  const thumbClass = gridView ? styles.thumbnailGrid : styles.thumbnail;

  return (
    <div className={itemClass} onClick={handleClick}>
      {selectMode && (
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={checked}
          onChange={handleCheckboxChange}
        />
      )}

      <div className={thumbClass}>
        {item.thumbnail ? (
          <img
            className={styles.thumbnailImg}
            src={item.thumbnail}
            alt={getFilename(item)}
            loading="lazy"
          />
        ) : (
          <div className={styles.recordingIcon}>
            <Video size={24} />
          </div>
        )}
        <span className={typeBadgeClass}>{typeLabel}</span>
        {item.type === "recording" && !item.thumbnail && (
          <div className={styles.recordingIcon}>
            <Play size={20} />
          </div>
        )}
      </div>

      <div className={styles.info}>
        <span className={styles.title} title={getFilename(item)}>
          {getFilename(item)}
        </span>
        <div className={styles.meta}>
          <span className={styles.date}>
            {formatTimeAgo(item.timestamp)}
          </span>
          {estimatedSize > 0 && (
            <span className={styles.fileSize}>
              {formatFileSize(estimatedSize)}
            </span>
          )}
        </div>
      </div>

      <div className={styles.hoverActions}>
        <button
          className={styles.hoverBtn}
          onClick={handleCopy}
          title={t("quickAccess:copy")}
        >
          <Copy size={13} />
        </button>
        <button
          className={styles.hoverBtn}
          onClick={handleEdit}
          title={t("quickAccess:openInEditor")}
        >
          <Edit3 size={13} />
        </button>
        <button
          className={`${styles.hoverBtn} ${styles.hoverBtnDelete}`}
          onClick={handleDelete}
          title={t("quickAccess:delete")}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(HistoryItem);
