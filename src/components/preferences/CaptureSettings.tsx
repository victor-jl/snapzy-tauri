import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Monitor,
  Maximize2,
  Layout,
  MousePointer,
  Copy,
  Camera,
  Volume2,
  Image,
  Timer,
  Eye,
} from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { isMac } from "../../utils/platform";
import styles from "./CaptureSettings.module.css";

interface CaptureSettingsProps {
  onChange: () => void;
}

const fileFormats = [
  { id: "png", label: "PNG", desc: "Lossless · Large files" },
  { id: "jpg", label: "JPEG", desc: "Lossy · Small files" },
  { id: "webp", label: "WebP", desc: "Modern · Good balance" },
];

const CaptureSettings: React.FC<CaptureSettingsProps> = ({ onChange }) => {
  const { t } = useTranslation();
  const config = useSettingsStore((s) => s.config);
  const updateSection = useSettingsStore((s) => s.updateSection);

  const capture = config.capture;

  const [defaultAction, setDefaultAction] = useState(
    () => (capture as Record<string, unknown>).default_capture_action as string || capture.default_action
  );
  const [fileFormat, setFileFormat] = useState(capture.file_format);
  const [jpgQuality, setJpgQuality] = useState(
    () => (capture as Record<string, unknown>).jpg_quality as number || 80
  );
  const [delay, setDelay] = useState(
    () => (capture as Record<string, unknown>).capture_delay as number || 0
  );
  const [thumbnailTimeout, setThumbnailTimeout] = useState(
    () => (capture as Record<string, unknown>).thumbnail_timeout as string || "10s"
  );

  const handleToggle = useCallback(
    (key: string, value: boolean) => {
      updateSection("capture", { [key]: value });
      onChange();
    },
    [updateSection, onChange]
  );

  const handleCaptureActionChange = useCallback(
    (action: string) => {
      setDefaultAction(action);
      updateSection("capture", { default_capture_action: action } as Record<string, unknown>);
      onChange();
    },
    [updateSection, onChange]
  );

  const handleFormatChange = useCallback(
    (format: string) => {
      setFileFormat(format);
      updateSection("capture", { file_format: format });
      onChange();
    },
    [updateSection, onChange]
  );

  const handleJpgQualityChange = useCallback(
    (quality: number) => {
      setJpgQuality(quality);
      updateSection("capture", { jpg_quality: quality } as Record<string, unknown>);
      onChange();
    },
    [updateSection, onChange]
  );

  const handleDelayChange = useCallback(
    (d: number) => {
      setDelay(d);
      updateSection("capture", { capture_delay: d } as Record<string, unknown>);
      onChange();
    },
    [updateSection, onChange]
  );

  const handleThumbnailTimeoutChange = useCallback(
    (timeout: string) => {
      setThumbnailTimeout(timeout);
      updateSection("capture", { thumbnail_timeout: timeout } as Record<string, unknown>);
      onChange();
    },
    [updateSection, onChange]
  );

  const isMacOS = isMac();

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{t("preferences:capture")}</h2>

      {/* Default Capture Action */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("preferences:defaultAction")}</h3>
        <div className={styles.radioGroup}>
          {[
            { id: "fullscreen", icon: <Maximize2 size={18} />, label: t("capture:fullscreen") },
            { id: "area", icon: <Layout size={18} />, label: t("capture:area") },
            { id: "window", icon: <Monitor size={18} />, label: t("capture:window") },
            { id: "last_used", icon: <Image size={18} />, label: t("preferences:lastUsed", "Last Used") },
          ].map((action) => (
            <label key={action.id} className={styles.radio}>
              <input
                type="radio"
                name="captureAction"
                checked={defaultAction === action.id}
                onChange={() => handleCaptureActionChange(action.id)}
              />
              <span className={styles.radioIcon}>{action.icon}</span>
              <span>{action.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Display Options */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("preferences:displayOptions", "Display Options")}</h3>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <MousePointer size={16} />
            <span>{t("preferences:showMouse")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={capture.show_mouse}
            onChange={(e) => handleToggle("show_mouse", e.target.checked)}
          />
        </label>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <Monitor size={16} />
            <span>{t("preferences:includeShadow")}</span>
            {isMacOS && (
              <span className={styles.platformLabel}>macOS</span>
            )}
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={capture.include_shadow}
            onChange={(e) => handleToggle("include_shadow", e.target.checked)}
          />
        </label>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <Volume2 size={16} />
            <span>{t("preferences:playSound")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={capture.play_sound}
            onChange={(e) => handleToggle("play_sound", e.target.checked)}
          />
        </label>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <Copy size={16} />
            <span>{t("preferences:copyToClipboardAfter", "Copy to Clipboard After Capture")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={(capture as Record<string, unknown>).copy_to_clipboard as boolean ?? true}
            onChange={(e) => handleToggle("copy_to_clipboard", e.target.checked)}
          />
        </label>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <Camera size={16} />
            <span>{t("preferences:autoOpenEditor")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={(capture as Record<string, unknown>).auto_open as boolean ?? false}
            onChange={(e) => handleToggle("auto_open", e.target.checked)}
          />
        </label>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <Eye size={16} />
            <span>{t("preferences:showCapturePreview", "Show Capture Preview")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={(capture as Record<string, unknown>).show_preview as boolean ?? true}
            onChange={(e) => handleToggle("show_preview", e.target.checked)}
          />
        </label>
      </div>

      {/* File Format */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("preferences:fileFormat")}</h3>
        <div className={styles.formatGrid}>
          {fileFormats.map((fmt) => (
            <button
              key={fmt.id}
              className={`${styles.formatCard} ${fileFormat === fmt.id ? styles.formatCardActive : ""}`}
              onClick={() => handleFormatChange(fmt.id)}
            >
              <div className={styles.formatName}>{fmt.label}</div>
              <div className={styles.formatDesc}>{fmt.desc}</div>
            </button>
          ))}
        </div>

        {fileFormat === "jpg" && (
          <div className={styles.sliderField}>
            <label className={styles.sliderLabel}>
              {t("preferences:jpgQuality", "JPEG Quality")}: {jpgQuality}%
            </label>
            <div className={styles.sliderRow}>
              <span className={styles.sliderMin}>60</span>
              <input
                type="range"
                className={styles.slider}
                min={60}
                max={100}
                step={5}
                value={jpgQuality}
                onChange={(e) => handleJpgQualityChange(Number(e.target.value))}
              />
              <span className={styles.sliderMax}>100</span>
            </div>
          </div>
        )}
      </div>

      {/* Timing */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("preferences:timing", "Timing")}</h3>

        {/* Delay */}
        <div className={styles.sliderField}>
          <label className={styles.sliderLabel}>
            <Timer size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            {t("preferences:screenshotDelay", "Screenshot Delay")}: {delay}s
          </label>
          <div className={styles.sliderRow}>
            <span className={styles.sliderMin}>0</span>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={10}
              step={1}
              value={delay}
              onChange={(e) => handleDelayChange(Number(e.target.value))}
            />
            <span className={styles.sliderMax}>10</span>
            <input
              type="number"
              className={styles.numInput}
              min={0}
              max={10}
              value={delay}
              onChange={(e) => handleDelayChange(Math.min(10, Math.max(0, Number(e.target.value))))}
            />
          </div>
        </div>

        {/* Thumbnail Timeout */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>
            {t("preferences:floatingThumbnailTimeout", "Floating Thumbnail Timeout")}
          </label>
          <select
            className={styles.select}
            value={thumbnailTimeout}
            onChange={(e) => handleThumbnailTimeoutChange(e.target.value)}
          >
            <option value="disable">{t("common:disable", "Disable")}</option>
            <option value="5s">5s</option>
            <option value="10s">10s</option>
            <option value="30s">30s</option>
            <option value="60s">60s</option>
          </select>
        </div>
      </div>

      {/* Scrolling Capture */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("preferences:scrollingCapture", "Scrolling Capture")}</h3>

        <div className={styles.sliderField}>
          <label className={styles.sliderLabel}>
            {t("preferences:overlapPercentage", "Overlap Percentage")}:{" "}
            {(capture as Record<string, unknown>).scroll_overlap as number ?? 30}%
          </label>
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={50}
              step={5}
              value={(capture as Record<string, unknown>).scroll_overlap as number ?? 30}
              onChange={(e) => {
                updateSection("capture", { scroll_overlap: Number(e.target.value) } as Record<string, unknown>);
                onChange();
              }}
            />
            <span className={styles.sliderValue}>{(capture as Record<string, unknown>).scroll_overlap as number ?? 30}%</span>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>
            {t("preferences:maxScrollHeight", "Max Scroll Height")} (px)
          </label>
          <input
            type="number"
            className={styles.textInput}
            min={500}
            max={50000}
            step={500}
            value={(capture as Record<string, unknown>).max_scroll_height as number ?? 20000}
            onChange={(e) => {
              updateSection("capture", { max_scroll_height: Number(e.target.value) } as Record<string, unknown>);
              onChange();
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(CaptureSettings);
