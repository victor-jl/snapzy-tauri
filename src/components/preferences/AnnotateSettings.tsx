import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  MousePointer,
  ArrowRight,
  Square,
  Circle,
  Minus,
  Type,
  EyeOff,
  Grid3X3,
  Magnet,
} from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import styles from "./AnnotateSettings.module.css";

interface AnnotateSettingsProps {
  onChange: () => void;
}

const presetColors = [
  "#FF0000", "#FF6B6B", "#FF9500", "#FFD60A",
  "#34C759", "#30D158", "#0A84FF", "#0071E3",
  "#5856D6", "#AF52DE", "#FF2D55", "#FFFFFF",
];

const fontFamilies = [
  "System Default",
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
  "Trebuchet MS",
  "Comic Sans MS",
  "Impact",
];

const AnnotateSettings: React.FC<AnnotateSettingsProps> = ({ onChange }) => {
  const { t } = useTranslation();
  const config = useSettingsStore((s) => s.config);
  const updateSection = useSettingsStore((s) => s.updateSection);

  const annotate = config.annotate;

  const [defaultTool, setDefaultTool] = useState(annotate.default_tool);
  const [defaultColor, setDefaultColor] = useState(annotate.default_color);
  const [strokeWidth, setStrokeWidth] = useState(
    () => (annotate as Record<string, unknown>).stroke_width as number ?? 3
  );
  const [opacity, setOpacity] = useState(
    () => (annotate as Record<string, unknown>).opacity as number ?? 100
  );
  const [fontSize, setFontSize] = useState(
    () => (annotate as Record<string, unknown>).font_size as number ?? 16
  );
  const [fontFamily, setFontFamily] = useState(
    () => (annotate as Record<string, unknown>).font_family as string ?? "System Default"
  );
  const [gridSize, setGridSize] = useState(
    () => (annotate as Record<string, unknown>).grid_size as number ?? 20
  );

  const tools = useMemo(
    () => [
      { id: "select", icon: <MousePointer size={18} />, label: t("annotate:select") },
      { id: "arrow", icon: <ArrowRight size={18} />, label: t("annotate:arrow") },
      { id: "rectangle", icon: <Square size={18} />, label: t("annotate:rectangle") },
      { id: "ellipse", icon: <Circle size={18} />, label: t("annotate:ellipse") },
      { id: "line", icon: <Minus size={18} />, label: t("annotate:line") },
      { id: "text", icon: <Type size={18} />, label: t("annotate:text") },
      { id: "blur", icon: <EyeOff size={18} />, label: t("annotate:blur") },
    ],
    [t]
  );

  const handleClick = useCallback(
    (key: string, value: unknown) => {
      updateSection("annotate", { [key]: value } as Record<string, unknown>);
      onChange();
    },
    [updateSection, onChange]
  );

  const handleToggle = useCallback(
    (key: string, value: boolean) => handleClick(key, value),
    [handleClick]
  );

  const handleToolChange = useCallback(
    (tool: string) => {
      setDefaultTool(tool);
      handleClick("default_tool", tool);
    },
    [handleClick]
  );

  const handleColorChange = useCallback(
    (color: string) => {
      setDefaultColor(color);
      handleClick("default_color", color);
    },
    [handleClick]
  );

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{t("preferences:annotate")}</h2>

      {/* Default Tool */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("preferences:defaultTool")}</h3>
        <div className={styles.toolGrid}>
          {tools.map((tool) => (
            <button
              key={tool.id}
              className={`${styles.toolBtn} ${defaultTool === tool.id ? styles.toolBtnActive : ""}`}
              onClick={() => handleToolChange(tool.id)}
              title={tool.label}
            >
              {tool.icon}
              <span>{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("annotate:color")}</h3>
        <div className={styles.colorSection}>
          <div className={styles.colorPickerRow}>
            <input
              type="color"
              className={styles.colorPicker}
              value={defaultColor}
              onChange={(e) => handleColorChange(e.target.value)}
            />
            <span className={styles.colorHex}>{defaultColor}</span>
          </div>
          <div className={styles.presetGrid}>
            {presetColors.map((color) => (
              <button
                key={color}
                className={`${styles.presetSwatch} ${defaultColor.toLowerCase() === color.toLowerCase() ? styles.presetSwatchActive : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorChange(color)}
                title={color}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Stroke Width */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("annotate:strokeWidth")}</h3>
        <div className={styles.sliderField}>
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={1}
              max={20}
              step={1}
              value={strokeWidth}
              onChange={(e) => {
                setStrokeWidth(Number(e.target.value));
                handleClick("stroke_width", Number(e.target.value));
              }}
            />
            <span className={styles.sliderValue}>{strokeWidth}px</span>
          </div>
        </div>
      </div>

      {/* Opacity */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("annotate:opacity")}</h3>
        <div className={styles.sliderField}>
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={10}
              max={100}
              step={5}
              value={opacity}
              onChange={(e) => {
                setOpacity(Number(e.target.value));
                handleClick("opacity", Number(e.target.value));
              }}
            />
            <span className={styles.sliderValue}>{opacity}%</span>
          </div>
        </div>
      </div>

      {/* Font Settings */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("annotate:fontSize")}</h3>
        <div className={styles.fieldRow}>
          <div className={styles.sliderField}>
            <div className={styles.sliderRow}>
              <input
                type="range"
                className={styles.slider}
                min={8}
                max={72}
                step={1}
                value={fontSize}
                onChange={(e) => {
                  setFontSize(Number(e.target.value));
                  handleClick("font_size", Number(e.target.value));
                }}
              />
              <span className={styles.sliderValue}>{fontSize}px</span>
            </div>
          </div>
          <select
            className={styles.select}
            value={fontFamily}
            onChange={(e) => {
              setFontFamily(e.target.value);
              handleClick("font_family", e.target.value);
            }}
          >
            {fontFamilies.map((ff) => (
              <option key={ff} value={ff}>
                {ff}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid & Snap */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("preferences:gridSnap", "Grid & Snap")}</h3>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <Grid3X3 size={16} />
            <span>{t("preferences:showGridByDefault", "Show Grid by Default")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={(annotate as Record<string, unknown>).show_grid as boolean ?? false}
            onChange={(e) => handleToggle("show_grid", e.target.checked)}
          />
        </label>

        <div className={styles.sliderField}>
          <label className={styles.sliderLabel}>
            {t("preferences:gridSize", "Grid Size")}
          </label>
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={10}
              max={100}
              step={5}
              value={gridSize}
              onChange={(e) => {
                setGridSize(Number(e.target.value));
                handleClick("grid_size", Number(e.target.value));
              }}
            />
            <span className={styles.sliderValue}>{gridSize}px</span>
          </div>
        </div>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <Magnet size={16} />
            <span>{t("preferences:snapToGrid", "Snap to Grid")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={(annotate as Record<string, unknown>).snap_to_grid as boolean ?? true}
            onChange={(e) => handleToggle("snap_to_grid", e.target.checked)}
          />
        </label>
      </div>

      {/* Other */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("preferences:other", "Other")}</h3>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <span>{t("preferences:autoSaveAnnotations", "Auto-Save Annotations")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={annotate.auto_open}
            onChange={(e) => handleToggle("auto_open", e.target.checked)}
          />
        </label>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <span>{t("preferences:rememberLastTools", "Remember Last Used Tools")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={(annotate as Record<string, unknown>).remember_tools as boolean ?? true}
            onChange={(e) => handleToggle("remember_tools", e.target.checked)}
          />
        </label>
      </div>
    </div>
  );
};

export default React.memo(AnnotateSettings);
