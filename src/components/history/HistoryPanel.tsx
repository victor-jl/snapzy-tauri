import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Search, X, Trash2, Download, Eye, Camera,
  ArrowUpDown, LayoutGrid, List, ChevronDown,
} from "lucide-react";
import { useHistoryStore, HistoryItem as HistoryItemType } from "../../stores/historyStore";
import { useClipboard } from "../../hooks/useClipboard";
import { formatFileSize } from "../../utils/format";
import HistoryItem from "./HistoryItem";
import styles from "./HistoryPanel.module.css";

interface HistoryPanelProps {
  onEditCapture: (imageData: string) => void;
  onClose: () => void;
}

type FilterType = "all" | "screenshots" | "recordings" | "gifs" | "annotated";
type SortType = "newest" | "oldest" | "largest";

const ITEMS_PER_PAGE = 20;

const HistoryPanel: React.FC<HistoryPanelProps> = ({ onEditCapture, onClose }) => {
  const { t } = useTranslation();
  const { copyImage } = useClipboard();
  const items = useHistoryStore((s) => s.items);
  const removeItem = useHistoryStore((s) => s.removeItem);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("newest");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gridView, setGridView] = useState(false);
  const [previewItem, setPreviewItem] = useState<HistoryItemType | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: HistoryItemType;
  } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Filter by type
    if (activeFilter === "screenshots") {
      result = result.filter((item) => item.type === "screenshot" && !item.annotated);
    } else if (activeFilter === "recordings") {
      result = result.filter((item) => item.type === "recording");
    } else if (activeFilter === "gifs") {
      result = result.filter((item) => item.type === "gif");
    } else if (activeFilter === "annotated") {
      result = result.filter((item) => item.annotated);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const filename = `Capture_${new Date(item.timestamp).toISOString().split("T")[0]}`;
        return filename.toLowerCase().includes(q) || item.type.toLowerCase().includes(q);
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortType) {
        case "oldest":
          return a.timestamp - b.timestamp;
        case "largest":
          return (b.thumbnail?.length ?? 0) - (a.thumbnail?.length ?? 0);
        case "newest":
        default:
          return b.timestamp - a.timestamp;
      }
    });

    return result;
  }, [items, activeFilter, searchQuery, sortType]);

  const visibleItems = filteredItems.slice(0, visibleCount);
  const hasMore = visibleCount < filteredItems.length;

  // Total storage used (estimated)
  const totalStorage = useMemo(() => {
    let bytes = 0;
    for (const item of items) {
      if (item.thumbnail && item.thumbnail.startsWith("data:")) {
        bytes += Math.round(item.thumbnail.length * 0.75);
      }
    }
    return bytes;
  }, [items]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;

      if (e.key === "Escape") {
        if (previewItem) {
          setPreviewItem(null);
        } else {
          onClose();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "a" && selectMode) {
        e.preventDefault();
        setSelectedIds(new Set(filteredItems.map((item) => item.id)));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, previewItem, selectMode, filteredItems]);

  const handleItemClick = useCallback((item: HistoryItemType) => {
    if (selectMode) {
      toggleSelect(item.id);
    } else {
      setPreviewItem(item);
    }
  }, [selectMode]);

  const handleCopy = useCallback(
    async (item: HistoryItemType) => {
      if (item.thumbnail) {
        await copyImage(item.thumbnail);
      }
    },
    [copyImage]
  );

  const handleEdit = useCallback(
    (item: HistoryItemType) => {
      if (item.thumbnail) {
        onEditCapture(item.thumbnail);
        onClose();
      }
    },
    [onEditCapture, onClose]
  );

  const handleDelete = useCallback(
    (id: string) => {
      removeItem(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (previewItem?.id === id) {
        setPreviewItem(null);
      }
    },
    [removeItem, previewItem]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((item) => item.id)));
    }
  }, [selectedIds, filteredItems]);

  const handleBatchDelete = useCallback(() => {
    selectedIds.forEach((id) => removeItem(id));
    setSelectedIds(new Set());
  }, [selectedIds, removeItem]);

  const handleBatchExport = useCallback(async () => {
    // In a real implementation, this would invoke a Tauri export command
    for (const id of selectedIds) {
      const item = items.find((i) => i.id === id);
      if (item?.filePath) {
        try {
          // Would invoke save/export command
        } catch {
          // Skip failed exports
        }
      }
    }
  }, [selectedIds, items]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, item: HistoryItemType) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, item });
    },
    []
  );

  const handleFilters = [
    { key: "all" as FilterType, label: t("history:filterAll") },
    { key: "screenshots" as FilterType, label: t("history:filterScreenshots") },
    { key: "recordings" as FilterType, label: t("history:filterRecordings") },
    { key: "gifs" as FilterType, label: t("history:filterGifs") },
    { key: "annotated" as FilterType, label: t("history:filterAnnotated") },
  ];

  const sortOptions: { key: SortType; label: string }[] = [
    { key: "newest", label: t("history:sortDate") },
    { key: "oldest", label: t("history:filterAll") },
    { key: "largest", label: t("common:search") },
  ];

  return (
    <div className={styles.overlay}>
      {/* Sidebar */}
      <div className={styles.sidebar} ref={panelRef}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.headerTitle}>
            <Eye size={18} />
            {t("history:title")}
          </span>
          <div className={styles.headerActions}>
            <button
              className={styles.headerBtn}
              onClick={() => setGridView(!gridView)}
              title={gridView ? "List View" : "Grid View"}
            >
              {gridView ? <List size={16} /> : <LayoutGrid size={16} />}
            </button>
            <button
              className={styles.headerBtn}
              onClick={() => {
                setSelectMode(!selectMode);
                setSelectedIds(new Set());
              }}
              title={selectMode ? "Exit Select" : "Select"}
            >
              <ArrowUpDown size={16} />
            </button>
            <button
              className={styles.headerBtn}
              onClick={onClose}
              title={t("common:close")}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className={styles.searchContainer}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("history:search")}
          />
          {searchQuery && (
            <button
              className={styles.searchClear}
              onClick={() => setSearchQuery("")}
            >
              <X size={10} />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className={styles.filterTabs}>
          {handleFilters.map((f) => (
            <button
              key={f.key}
              className={
                activeFilter === f.key ? styles.filterTabActive : styles.filterTab
              }
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort Row */}
        <div className={styles.sortRow}>
          <div style={{ display: "flex", gap: 4 }}>
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                className={
                  sortType === opt.key ? styles.sortBtnActive : styles.sortBtn
                }
                onClick={() => setSortType(opt.key)}
              >
                {opt.label}
                {sortType === opt.key && <ChevronDown size={10} />}
              </button>
            ))}
          </div>
          <span className={styles.itemCount}>
            {t("history:itemCount", { count: filteredItems.length })}
          </span>
        </div>

        {/* Batch Toolbar */}
        {selectMode && selectedIds.size > 0 && (
          <div className={styles.batchToolbar}>
            <button
              className={styles.batchBtn}
              onClick={handleSelectAll}
            >
              {selectedIds.size === filteredItems.length
                ? t("common:deselectAll")
                : t("common:selectAll")}
            </button>
            <button
              className={styles.batchBtn}
              onClick={handleBatchExport}
              disabled={selectedIds.size === 0}
            >
              <Download size={12} />
              {t("history:exportSelected")}
            </button>
            <button
              className={styles.batchBtnDanger}
              onClick={handleBatchDelete}
              disabled={selectedIds.size === 0}
            >
              <Trash2 size={12} />
              {t("history:deleteSelected")}
            </button>
            <span className={styles.batchCount}>
              {t("history:itemCount", { count: selectedIds.size })}
            </span>
          </div>
        )}

        {/* Item List */}
        <div className={styles.itemList}>
          {visibleItems.length === 0 ? (
            <div className={styles.emptyState}>
              <Camera size={48} className={styles.emptyIcon} />
              <span className={styles.emptyTitle}>
                {searchQuery ? t("history:noResults") : t("history:noItems")}
              </span>
              <span className={styles.emptyText}>
                {t("history:noItemsHint", { key: "⌘⇧2" })}
              </span>
            </div>
          ) : (
            <>
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                >
                  <HistoryItem
                    item={item}
                    isSelected={previewItem?.id === item.id}
                    selectMode={selectMode}
                    onSelect={toggleSelect}
                    onClick={handleItemClick}
                    onCopy={handleCopy}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onCheckToggle={toggleSelect}
                    checked={selectedIds.has(item.id)}
                    gridView={gridView}
                  />
                </div>
              ))}
              {hasMore && (
                <button className={styles.loadMore} onClick={handleLoadMore}>
                  Load more...
                </button>
              )}
            </>
          )}
        </div>

        {/* Stats Bar */}
        <div className={styles.statsBar}>
          <span>
            {t("history:itemCount", { count: items.length })}
          </span>
          <span>
            {t("history:storageUsed")}:{" "}
            <span className={styles.statsValue}>
              {formatFileSize(totalStorage)}
            </span>
          </span>
        </div>
      </div>

      {/* Preview Area */}
      {previewItem && (
        <div className={styles.previewOverlay}>
          <button
            className={styles.previewClose}
            onClick={() => setPreviewItem(null)}
          >
            <X size={18} />
          </button>
          {previewItem.thumbnail ? (
            <img
              className={styles.previewImage}
              src={previewItem.thumbnail}
              alt="Preview"
            />
          ) : (
            <span style={{ color: "#fff", fontSize: 14 }}>
              {t("recording:preview")}
            </span>
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className={styles.overlay}
          style={{
            position: "fixed",
            zIndex: 10010,
            pointerEvents: "auto",
          }}
          onClick={() => setContextMenu(null)}
        >
          <div
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              backgroundColor: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
              padding: "4px",
              minWidth: 160,
              zIndex: 10011,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ContextMenuItem
              label={t("history:filterAll")}
              onClick={() => {
                handleItemClick(contextMenu.item);
                setContextMenu(null);
              }}
            />
            <ContextMenuItem
              label={t("quickAccess:copy")}
              onClick={() => {
                handleCopy(contextMenu.item);
                setContextMenu(null);
              }}
            />
            <ContextMenuItem
              label={t("quickAccess:saveAs")}
              onClick={() => {
                setContextMenu(null);
              }}
            />
            <ContextMenuItem
              label={t("quickAccess:delete")}
              danger
              onClick={() => {
                handleDelete(contextMenu.item.id);
                setContextMenu(null);
              }}
            />
            <ContextMenuItem
              label={t("quickAccess:openFolder")}
              onClick={() => {
                setContextMenu(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Simple context menu item component
const ContextMenuItem: React.FC<{
  label: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ label, onClick, danger }) => (
  <button
    style={{
      display: "block",
      width: "100%",
      padding: "6px 10px",
      border: "none",
      borderRadius: "var(--radius-sm)",
      backgroundColor: "transparent",
      color: danger ? "var(--color-danger)" : "var(--color-text-primary)",
      fontSize: 12,
      textAlign: "left",
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      transition: "background-color var(--transition-fast)",
    }}
    onClick={onClick}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = "transparent";
    }}
  >
    {label}
  </button>
);

export default React.memo(HistoryPanel);
