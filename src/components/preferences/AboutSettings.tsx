import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Camera,
  Globe,
  Github,
  BookOpen,
  Bug,
  RefreshCw,
  Loader,
  CheckCircle,
  ChevronDown,
  Cpu,
  Monitor,
  HardDrive,
} from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { getPlatformName } from "../../utils/platform";
import { invoke } from "@tauri-apps/api/core";
import styles from "./AboutSettings.module.css";

interface AboutSettingsProps {
  onChange: () => void;
}

const AboutSettings: React.FC<AboutSettingsProps> = ({ onChange }) => {
  const { t } = useTranslation();
  const config = useSettingsStore((s) => s.config);
  const updateSection = useSettingsStore((s) => s.updateSection);

  const [checking, setChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<"idle" | "available" | "none">("idle");
  const [updateChannel, setUpdateChannel] = useState(
    () => (config.general as Record<string, unknown>).update_channel as string || "stable"
  );
  const [autoCheck, setAutoCheck] = useState(
    () => (config.general as Record<string, unknown>).auto_check_update as boolean ?? true
  );
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  const [appVersion, setAppVersion] = useState("1.0.0");

  const platform = getPlatformName();

  // Try to get real version
  React.useEffect(() => {
    invoke<string>("get_app_version")
      .then((v) => setAppVersion(v))
      .catch(() => {
        // Use default
      });
  }, []);

  const handleCheckUpdates = useCallback(async () => {
    setChecking(true);
    setUpdateResult("idle");
    try {
      const hasUpdate = await invoke<boolean>("check_update");
      setUpdateResult(hasUpdate ? "available" : "none");
    } catch {
      setUpdateResult("idle");
    }
    setChecking(false);
  }, []);

  const handleChannelChange = useCallback(
    (channel: string) => {
      setUpdateChannel(channel);
      updateSection("general", { update_channel: channel } as Record<string, unknown>);
      onChange();
    },
    [updateSection, onChange]
  );

  const handleAutoCheckChange = useCallback(
    (checked: boolean) => {
      setAutoCheck(checked);
      updateSection("general", { auto_check_update: checked } as Record<string, unknown>);
      onChange();
    },
    [updateSection, onChange]
  );

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{t("preferences:about")}</h2>

      {/* Logo & App Info */}
      <div className={styles.hero}>
        <div className={styles.logo}>
          <Camera size={36} />
        </div>
        <h1 className={styles.appName}>{t("app:name")}</h1>
        <div className={styles.version}>
          v{appVersion}
        </div>
        <p className={styles.tagline}>
          Cross-platform screenshot & recording tool
        </p>
      </div>

      {/* Links */}
      <div className={styles.links}>
        <a
          className={styles.link}
          href="https://snapzy.app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Globe size={16} />
          Website
        </a>
        <a
          className={styles.link}
          href="https://github.com/snapzy/snapzy"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github size={16} />
          GitHub
        </a>
        <a
          className={styles.link}
          href="https://docs.snapzy.app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <BookOpen size={16} />
          {t("preferences:documentation")}
        </a>
        <a
          className={styles.link}
          href="https://github.com/snapzy/snapzy/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Bug size={16} />
          {t("preferences:reportBug")}
        </a>
      </div>

      {/* Updates */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("preferences:checkForUpdates")}</h3>

        <button
          className={styles.updateBtn}
          onClick={handleCheckUpdates}
          disabled={checking}
        >
          {checking ? (
            <Loader size={16} className={styles.spin} />
          ) : updateResult === "available" ? (
            <RefreshCw size={16} />
          ) : updateResult === "none" ? (
            <CheckCircle size={16} />
          ) : (
            <RefreshCw size={16} />
          )}
          {checking
            ? t("common:loading")
            : updateResult === "available"
              ? t("preferences:updateAvailable")
              : updateResult === "none"
                ? t("preferences:upToDate")
                : t("preferences:checkForUpdates")}
        </button>

        <label className={styles.toggle}>
          <span>{t("preferences:autoCheckUpdates", "Auto-check for Updates")}</span>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={autoCheck}
            onChange={(e) => handleAutoCheckChange(e.target.checked)}
          />
        </label>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>
            {t("preferences:updateChannel", "Update Channel")}
          </label>
          <div className={styles.radioInline}>
            <label className={styles.radio}>
              <input
                type="radio"
                name="updateChannel"
                checked={updateChannel === "stable"}
                onChange={() => handleChannelChange("stable")}
              />
              <span>Stable</span>
            </label>
            <label className={styles.radio}>
              <input
                type="radio"
                name="updateChannel"
                checked={updateChannel === "beta"}
                onChange={() => handleChannelChange("beta")}
              />
              <span>Beta</span>
            </label>
          </div>
        </div>
      </div>

      {/* License & Credits */}
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{t("preferences:licenses")}</h3>
        <p className={styles.license}>
          MIT License — Copyright (c) 2026 Snapzy
        </p>
        <p className={styles.credits}>
          Built with Tauri, React, TypeScript, and Rust.
          <br />
          Icons by Lucide. Fonts by your operating system.
        </p>
      </div>

      {/* System Information */}
      <div className={styles.group}>
        <button
          className={styles.collapseHeader}
          onClick={() => setShowSystemInfo(!showSystemInfo)}
        >
          <ChevronDown
            size={14}
            className={`${styles.collapseIcon} ${showSystemInfo ? styles.collapseIconOpen : ""}`}
          />
          <span>{t("preferences:systemInfo", "System Information")}</span>
        </button>
        {showSystemInfo && (
          <div className={styles.systemInfo}>
            <div className={styles.infoRow}>
              <Monitor size={14} />
              <span className={styles.infoLabel}>OS</span>
              <span className={styles.infoValue}>{platform}</span>
            </div>
            <div className={styles.infoRow}>
              <Cpu size={14} />
              <span className={styles.infoLabel}>Arch</span>
              <span className={styles.infoValue}>
                {navigator.userAgent.includes("ARM") || navigator.userAgent.includes("arm64")
                  ? "ARM64"
                  : "x86_64"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <HardDrive size={14} />
              <span className={styles.infoLabel}>App Version</span>
              <span className={styles.infoValue}>v{appVersion}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>User Agent</span>
              <span className={`${styles.infoValue} ${styles.infoMono}`}>
                {navigator.userAgent.substring(0, 60)}...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(AboutSettings);
