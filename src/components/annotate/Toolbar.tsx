import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  MousePointer2,
  ArrowRight,
  Square,
  Circle,
  Minus,
  Type,
  Droplets,
  Crop,
  Highlighter,
  PenLine,
  Grid3X3,
  Hash,
} from "lucide-react";
import { useAnnotationStore, type AnnotationTool } from "./useAnnotationStore";

interface ToolbarProps {
  onExport: () => void;
  onSave: () => void;
  onCopy: () => void;
  onClose: () => void;
}

type ToolDef = {
  id: AnnotationTool;
  icon: React.ElementType;
  labelKey: string;
};

const TOOL_GROUPS: ToolDef[][] = [
  [
    { id: "select", icon: MousePointer2, labelKey: "annotate:select" },
  ],
  [
    { id: "arrow", icon: ArrowRight, labelKey: "annotate:arrow" },
    { id: "rectangle", icon: Square, labelKey: "annotate:rectangle" },
    { id: "ellipse", icon: Circle, labelKey: "annotate:ellipse" },
    { id: "line", icon: Minus, labelKey: "annotate:line" },
    { id: "text", icon: Type, labelKey: "annotate:text" },
  ],
  [
    { id: "pen", icon: PenLine, labelKey: "annotate:pen" },
    { id: "highlighter", icon: Highlighter, labelKey: "annotate:highlighter" },
    { id: "blur", icon: Droplets, labelKey: "annotate:blur" },
    { id: "mosaic", icon: Grid3X3, labelKey: "annotate:mosaic" },
    { id: "stepCounter", icon: Hash, labelKey: "annotate:stepCounter" },
    { id: "crop", icon: Crop, labelKey: "annotate:crop" },
  ],
];

const PRESET_COLORS = [
  "#FF453A", "#FF9F0A", "#FFD60A", "#30D158",
  "#64D2FF", "#0A84FF", "#BF5AF2", "#FF375F",
  "#AC8E68", "#8E8E93", "#FF6482", "#32D74B",
  "#5E5CE6", "#00C7BE", "#FF6B35", "#FFB800",
];

const Toolbar: React.FC<ToolbarProps> = ({
  onExport,
  onSave,
  onCopy,
  onClose,
}) => {
  const { t } = useTranslation();
  const activeTool = useAnnotationStore((s) => s.activeTool);
  const setTool = useAnnotationStore((s) => s.setTool);
  const strokeColor = useAnnotationStore((s) => s.strokeColor);
  const setStrokeColor = useAnnotationStore((s) => s.setStrokeColor);
  const strokeWidth = useAnnotationStore((s) => s.strokeWidth);
  const setStrokeWidth = useAnnotationStore((s) => s.setStrokeWidth);
  const opacity = useAnnotationStore((s) => s.opacity);
  const setOpacity = useAnnotationStore((s) => s.setOpacity);
  const fontSize = useAnnotationStore((s) => s.fontSize);
  const setFontSize = useAnnotationStore((s) => s.setFontSize);
  const blurIntensity = useAnnotationStore((s) => s.blurIntensity);
  const setBlurIntensity = useAnnotationStore((s) => s.setBlurIntensity);
  const undo = useAnnotationStore((s) => s.undo);
  const redo = useAnnotationStore((s) => s.redo);
  const undoStack = useAnnotationStore((s) => s.undoStack);
  const redoStack = useAnnotationStore((s) => s.redoStack);
  const removeSelected = useAnnotationStore((s) => s.removeSelectedAnnotation);
  const clearAll = useAnnotationStore((s) => s.clearAll);
  const zoom = useAnnotationStore((s) => s.zoom);
  const setZoom = useAnnotationStore((s) => s.setZoom);

  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [customColor, setCustomColor] = React.useState("#FF453A");

  const sidebarStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 48,
      backgroundColor: "var(--color-bg, #1c1c1e)",
      borderRight: "1px solid var(--color-border, rgba(255,255,255,0.1))",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: 8,
      zIndex: 10,
      gap: 2,
    }),
    []
  );

  const topBarStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      top: 0,
      left: 48,
      right: 0,
      height: 48,
      backgroundColor: "var(--color-bg, #1c1c1e)",
      borderBottom: "1px solid var(--color-border, rgba(255,255,255,0.1))",
      display: "flex",
      alignItems: "center",
      padding: "0 12px",
      gap: 8,
      zIndex: 10,
    }),
    []
  );

  const bottomBarStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      bottom: 0,
      left: 48,
      right: 0,
      height: 48,
      backgroundColor: "var(--color-bg, #1c1c1e)",
      borderTop: "1px solid var(--color-border, rgba(255,255,255,0.1))",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 16px",
      gap: 8,
      zIndex: 10,
    }),
    []
  );

  const toolBtnStyle = (isActive: boolean): React.CSSProperties => ({
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    border: "none",
    backgroundColor: isActive ? "var(--color-accent, #FF453A)" : "transparent",
    color: isActive ? "#fff" : "var(--color-text, #aaa)",
    cursor: "pointer",
    transition: "all 0.15s ease",
    position: "relative",
  });

  const topBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 6,
    border: "none",
    backgroundColor: "transparent",
    color: "var(--color-text, #ccc)",
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  const handleColorSelect = useCallback(
    (color: string) => {
      setStrokeColor(color);
      setCustomColor(color);
      setShowColorPicker(false);
    },
    [setStrokeColor]
  );

  return (
    <>
      {/* Left Sidebar - Tools */}
      <div style={sidebarStyle}>
        {TOOL_GROUPS.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && (
              <div
                style={{
                  width: 28,
                  height: 1,
                  backgroundColor: "var(--color-border, rgba(255,255,255,0.1))",
                  margin: "4px 0",
                }}
              />
            )}
            {group.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  style={toolBtnStyle(isActive)}
                  onClick={() => setTool(tool.id)}
                  title={`${t(tool.labelKey)}`}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor =
                        "rgba(255,255,255,0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Top Bar - Undo/Redo, Zoom, Color, Stroke Width, Opacity */}
      <div style={topBarStyle}>
        {/* Undo / Redo */}
        <button
          style={{ ...topBtnStyle, opacity: undoStack.length === 0 ? 0.3 : 1 }}
          onClick={undo}
          disabled={undoStack.length === 0}
          title={`${t("annotate:undo")} (Ctrl+Z)`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <button
          style={{ ...topBtnStyle, opacity: redoStack.length === 0 ? 0.3 : 1 }}
          onClick={redo}
          disabled={redoStack.length === 0}
          title={`${t("annotate:redo")} (Ctrl+Shift+Z)`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>

        <div style={{ width: 1, height: 20, backgroundColor: "var(--color-border, rgba(255,255,255,0.15))", margin: "0 4px" }} />

        {/* Zoom controls */}
        <button
          style={topBtnStyle}
          onClick={() => setZoom(zoom - 0.1)}
          title={t("common:zoomOut")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <span style={{ color: "var(--color-text, #ccc)", fontSize: 12, minWidth: 40, textAlign: "center", fontFamily: "monospace" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          style={topBtnStyle}
          onClick={() => setZoom(zoom + 0.1)}
          title={t("common:zoomIn")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <button
          style={{ ...topBtnStyle, fontSize: 11 }}
          onClick={() => setZoom(1)}
          title={t("common:zoomToFit")}
        >
          1:1
        </button>

        <div style={{ width: 1, height: 20, backgroundColor: "var(--color-border, rgba(255,255,255,0.15))", margin: "0 4px" }} />

        {/* Color picker */}
        <div style={{ position: "relative" }}>
          <button
            style={{
              ...topBtnStyle,
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "2px solid var(--color-border, rgba(255,255,255,0.3))",
              backgroundColor: strokeColor,
            }}
            onClick={() => setShowColorPicker(!showColorPicker)}
            title={t("annotate:color")}
          />
          {showColorPicker && (
            <div
              style={{
                position: "absolute",
                top: 36,
                left: 0,
                backgroundColor: "var(--color-bg, #2c2c2e)",
                borderRadius: 10,
                padding: 10,
                boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
                zIndex: 100,
                minWidth: 200,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 6,
                }}
              >
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border:
                        strokeColor === color
                          ? "2px solid #fff"
                          : "2px solid transparent",
                      backgroundColor: color,
                      cursor: "pointer",
                      transition: "transform 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  />
                ))}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => handleColorSelect(e.target.value)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    background: "none",
                  }}
                />
                <span style={{ color: "var(--color-text, #aaa)", fontSize: 11 }}>
                  {t("annotate:color")}
                </span>
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 20, backgroundColor: "var(--color-border, rgba(255,255,255,0.15))", margin: "0 4px" }} />

        {/* Stroke Width */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--color-text, #aaa)", fontSize: 11, minWidth: 28 }}>
            {strokeWidth}px
          </span>
          <input
            type="range"
            min={1}
            max={20}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            title={t("annotate:strokeWidth")}
            style={{
              width: 80,
              accentColor: "var(--color-accent, #FF453A)",
            }}
          />
        </div>

        {/* Opacity */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--color-text, #aaa)", fontSize: 11, minWidth: 28 }}>
            {opacity}%
          </span>
          <input
            type="range"
            min={10}
            max={100}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            title={t("annotate:opacity")}
            style={{
              width: 80,
              accentColor: "var(--color-accent, #FF453A)",
            }}
          />
        </div>

        {/* Font Size */}
        {["text", "stepCounter"].includes(activeTool) && (
          <>
            <div style={{ width: 1, height: 20, backgroundColor: "var(--color-border, rgba(255,255,255,0.15))", margin: "0 4px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--color-text, #aaa)", fontSize: 11, minWidth: 28 }}>
                {fontSize}px
              </span>
              <input
                type="range"
                min={8}
                max={72}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                title={t("annotate:fontSize")}
                style={{
                  width: 80,
                  accentColor: "var(--color-accent, #FF453A)",
                }}
              />
            </div>
          </>
        )}

        {/* Blur Intensity */}
        {activeTool === "blur" && (
          <>
            <div style={{ width: 1, height: 20, backgroundColor: "var(--color-border, rgba(255,255,255,0.15))", margin: "0 4px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--color-text, #aaa)", fontSize: 11, minWidth: 28 }}>
                {blurIntensity}%
              </span>
              <input
                type="range"
                min={1}
                max={100}
                value={blurIntensity}
                onChange={(e) => setBlurIntensity(Number(e.target.value))}
                title={t("annotate:blur")}
                style={{
                  width: 80,
                  accentColor: "var(--color-accent, #FF453A)",
                }}
              />
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Delete selected / Clear all */}
        <button
          style={topBtnStyle}
          onClick={removeSelected}
          title={`${t("annotate:delete")} (Delete)`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
        <button
          style={{ ...topBtnStyle, color: "var(--color-accent, #FF453A)" }}
          onClick={clearAll}
          title={t("annotate:clearAll")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Bottom Bar - Actions */}
      <div style={bottomBarStyle}>
        <button
          onClick={onCopy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            backgroundColor: "rgba(255,255,255,0.1)",
            color: "var(--color-text, #fff)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {t("annotate:copy")} (Ctrl+C)
        </button>
        <button
          onClick={onSave}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            backgroundColor: "rgba(255,255,255,0.1)",
            color: "var(--color-text, #fff)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
          </svg>
          {t("annotate:save")} (Ctrl+S)
        </button>
        <button
          onClick={onExport}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            backgroundColor: "rgba(255,255,255,0.1)",
            color: "var(--color-text, #fff)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t("annotate:export")}
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            backgroundColor: "rgba(255,69,58,0.15)",
            color: "var(--color-accent, #FF453A)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {t("common:close")}
        </button>
      </div>
    </>
  );
};

export default React.memo(Toolbar);
