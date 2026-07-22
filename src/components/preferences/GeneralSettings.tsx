import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Languages,
  Palette,
  FolderOpen,
  Power,
  Bell,
  Volume2,
  FileText,
  Trash2,
  RotateCcw,
  Monitor,
  Dock,
  Menu,
} from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { availableLanguages } from "../../i18n";
import { getPlatformName } from "../../utils/platform";
import { invoke } from "@tauri-apps/api/core";
import styles from "./GeneralSettings.module.css";

interface GeneralSettingsProps {
  onChange: () => void;
}

const languageNames: Record<string, string> = {
  en: "English",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  pt: "Português",
  ru: "Русский",
  vi: "Tiếng Việt",
};

const fileNamingPreview = (pattern: string): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");

  return pattern
    .replace(/\{date\}/g, `${y}-${m}-${d}`)
    .replace(/\{time\}/g, `${h}-${min}-${s}`)
    .replace(/\{yyyy\}/g, String(y))
    .replace(/\{mm\}/g, m)
    .replace(/\{dd\}/g, d)
    .replace(/\{HH\}/g, h)
    .replace(/\{MM\}/g, min)
    .replace(/\{SS\}/g, s);
};

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ onChange }) => {
  const { t, i18n } = useTranslation();
  const config = useSettingsStore((s) => s.config);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const saveSettings = useSettingsStore((s) => s.saveSettings);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const platform = getPlatformName();

  const general = config.general;
  const capture = config.capture;

  const [filePattern, setFilePattern] = useState(
    () => (capture as Record<string, unknown>).file_naming_pattern as string || "Snapzy_{date}_{time}"
  );

  const handleToggle = useCallback(
    (key: string, value: boolean) => {
      updateSection("general", { [key]: value });
      onChange();
    },
    [updateSection, onChange]
  );

  const handleLanguageChange = useCallback(
    (lang: string) => {
      updateSection("general", { language: lang });
      i18n.changeLanguage(lang);
      try {
        localStorage.setItem("snapzy-language", lang);
      } catch {
        // Storage unavailable
      }
      onChange();
    },
    [updateSection, i18n, onChange]
  );

  const handleThemeChange = useCallback(
    (theme: string) => {
      setTheme(theme as "light" | "dark" | "system");
      onChange();
    },
    [setTheme, onChange]
  );

  const handleSaveLocationChange = useCallback(
    (location: string) => {
      updateSection("capture", { save_location: location });
      onChange();
    },
    [updateSection, onChange]
  );

  const handleBrowse = useCallback(async () => {
    try {
      const selected = await invoke<string>("pick_folder");
      if (selected) {
        handleSaveLocationChange(selected);
      }
    } catch {
      // Dialog cancelled
    }
  }, [handleSaveLocationChange]);

  const handleFilePatternChange = useCallback(
    (pattern: string) => {
      setFilePattern(pattern);
      updateSection("capture", { file_naming_pattern: pattern } as Record<string, unknown>);
      onChange();
    },
    [updateSection, onChange]
  );

  const handleFactoryReset = useCallback(async () => {
    try {
      await invoke("reset_all_settings");
      setShowResetConfirm(false);
      onChange();
    } catch {
      // Reset failed
    }
  }, [onChange]);

  const preview = useMemo(
    () => fileNamingPreview(filePattern + ".png"),
    [filePattern]
  );

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{t("preferences:general")}</h2>

      {/* Startup */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("common:startup", "Startup")}</h3>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <Power size={16} />
            <span>{t("preferences:launchAtLogin")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={general.launch_at_login}
            onChange={(e) => handleToggle("launch_at_login", e.target.checked)}
          />
        </label>

        <div className={styles.platformNote}>
          {platform === "macOS"
            ? "System Settings → General → Login Items"
            : platform === "Windows"
              ? "Task Manager → Startup"
              : "~/.config/autostart"}
        </div>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <Menu size={16} />
            <span>{t("preferences:showInMenuBar")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={general.show_in_menu_bar}
            onChange={(e) => handleToggle("show_in_menu_bar", e.target.checked)}
          />
        </label>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <Dock size={16} />
            <span>{t("preferences:showInDock", "Show in Dock/Taskbar")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={(general as Record<string, unknown>).show_in_dock as boolean ?? true}
            onChange={(e) =>
              handleToggle("show_in_dock", e.target.checked)
            }
          />
        </label>
      </div>

      {/* Language & Theme */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("preferences:language")} & {t("preferences:theme")}</h3>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>
            <Languages size={14} />
            {t("preferences:language")}
          </label>
          <select
            className={styles.select}
            value={general.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
          >
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {languageNames[lang] || lang}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>
            <Palette size={14} />
            {t("preferences:theme")}
          </label>
          <div className={styles.themeSelector}>
            {(["system", "light", "dark"] as const).map((th) => (
              <button
                key={th}
                className={`${styles.themeOption} ${
                  general.theme === th ? styles.themeOptionActive : ""
                }`}
                onClick={() => handleThemeChange(th)}
              >
                <div
                  className={`${styles.themeSwatch} ${styles[`swatch${th.charAt(0).toUpperCase() + th.slice(1)}`]}`}
                />
                <span>
                  {th === "system"
                    ? t("preferences:themeSystem")
                    : th === "light"
                      ? t("preferences:themeLight")
                      : t("preferences:themeDark")}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("common:notifications", "Notifications")}</h3>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <Volume2 size={16} />
            <span>{t("preferences:playSound")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={(general as Record<string, unknown>).play_capture_sound as boolean ?? true}
            onChange={(e) =>
              handleToggle("play_capture_sound", e.target.checked)
            }
          />
        </label>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <Bell size={16} />
            <span>{t("preferences:showNotifications", "Show Notifications")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={(general as Record<string, unknown>).show_notifications as boolean ?? true}
            onChange={(e) =>
              handleToggle("show_notifications", e.target.checked)
            }
          />
        </label>
      </div>

      {/* File Management */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("preferences:fileManagement", "File Management")}</h3>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>
            <FolderOpen size={14} />
            {t("preferences:saveLocation")}
          </label>
          <div className={styles.pathRow}>
            <input
              className={styles.textInput}
              type="text"
              value={capture.save_location}
              onChange={(e) => handleSaveLocationChange(e.target.value)}
              placeholder="~/Desktop"
            />
            <button className={styles.browseBtn} onClick={handleBrowse}>
              {t("common:browse", "Browse")}
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>
            <FileText size={14} />
            {t("preferences:fileNamingPattern", "File Naming Pattern")}
          </label>
          <input
            className={styles.textInput}
            type="text"
            value={filePattern}
            onChange={(e) => handleFilePatternChange(e.target.value)}
            placeholder="Snapzy_{date}_{time}"
          />
          <div className={styles.preview}>
            {t("common:preview", "Preview")}: {preview}
          </div>
          <div className={styles.hint}>
            {"{date}"}, {"{time}"}, {"{yyyy}"}, {"{mm}"}, {"{dd}"}, {"{HH}"}, {"{MM}"}, {"{SS}"}
          </div>
        </div>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <span>{t("preferences:deleteConfirmation", "Delete Confirmation Dialog")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={(general as Record<string, unknown>).delete_confirmation as boolean ?? true}
            onChange={(e) =>
              handleToggle("delete_confirmation", e.target.checked)
            }
          />
        </label>

        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <span>{t("preferences:autoStartRecording", "Auto-start Recording Option")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={(general as Record<string, unknown>).auto_start_recording as boolean ?? false}
            onChange={(e) =>
              handleToggle("auto_start_recording", e.target.checked)
            }
          />
        </label>
      </div>

      {/* Factory Reset */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("preferences:dangerZone", "Danger Zone")}</h3>

        {showResetConfirm ? (
          <div className={styles.resetConfirm}>
            <p className={styles.resetConfirmText}>
              {t("preferences:resetConfirm", "This will reset ALL settings to their defaults. This action cannot be undone.")}
            </p>
            <div className={styles.resetConfirmActions}>
              <button
                className={styles.resetConfirmYes}
                onClick={handleFactoryReset}
              >
                {t("common:yes")}
              </button>
              <button
                className={styles.resetConfirmNo}
                onClick={() => setShowResetConfirm(false)}
              >
                {t("common:no")}
              </button>
            </div>
          </div>
        ) : (
          <button
            className={styles.dangerBtn}
            onClick={() => setShowResetConfirm(true)}
          >
            <RotateCcw size={14} />
            {t("preferences:factoryReset", "Factory Reset")}
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(GeneralSettings);
