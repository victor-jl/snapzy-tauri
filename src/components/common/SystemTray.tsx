import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Camera,
  Video,
  Clock,
  Settings,
  Info,
  X,
  RefreshCw,
  ChevronRight,
  Image,
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useHistoryStore } from "../../stores/historyStore";
import { invoke } from "@tauri-apps/api/core";
import styles from "./SystemTray.module.css";

interface SystemTrayProps {
  onClose?: () => void;
}

interface MenuItemData {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  action: () => void;
  danger?: boolean;
}

const SystemTray: React.FC<SystemTrayProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const setView = useUIStore((s) => s.setView);
  const historyItems = useHistoryStore((s) => s.items);

  const recentItems = historyItems.slice(0, 5);

  const handleCapture = useCallback(() => {
    setView("capture");
    onClose?.();
  }, [setView, onClose]);

  const handleRecord = useCallback(() => {
    setView("capture");
    onClose?.();
  }, [setView, onClose]);

  const handleHistory = useCallback(() => {
    setView("history");
    onClose?.();
  }, [setView, onClose]);

  const handlePreferences = useCallback(() => {
    setView("preferences");
    onClose?.();
  }, [setView, onClose]);

  const handleAbout = useCallback(() => {
    setView("preferences");
    onClose?.();
  }, [setView, onClose]);

  const handleQuit = useCallback(async () => {
    try {
      await invoke("quit_app");
    } catch {
      // Quit failed
    }
    onClose?.();
  }, [onClose]);

  const handleCheckUpdates = useCallback(async () => {
    try {
      await invoke("check_update");
    } catch {
      // Check failed
    }
    onClose?.();
  }, [onClose]);

  const handleOpenRecent = useCallback(
    (id: string) => {
      setView("history");
      onClose?.();
    },
    [setView, onClose]
  );

  const mainItems: MenuItemData[] = [
    {
      id: "capture",
      icon: <Camera size={16} />,
      label: t("capture:area"),
      shortcut: "⇧⌘2",
      action: handleCapture,
    },
    {
      id: "record",
      icon: <Video size={16} />,
      label: t("recording:start"),
      shortcut: "⇧⌘R",
      action: handleRecord,
    },
    {
      id: "history",
      icon: <Clock size={16} />,
      label: t("history:title"),
      shortcut: "⇧⌘H",
      action: handleHistory,
    },
  ];

  const secondaryItems: MenuItemData[] = [
    {
      id: "preferences",
      icon: <Settings size={16} />,
      label: t("common:preferences"),
      shortcut: "⌘,",
      action: handlePreferences,
    },
    {
      id: "updates",
      icon: <RefreshCw size={16} />,
      label: t("common:checkForUpdates"),
      action: handleCheckUpdates,
    },
    {
      id: "about",
      icon: <Info size={16} />,
      label: t("common:about"),
      action: handleAbout,
    },
    {
      id: "quit",
      icon: <X size={16} />,
      label: t("common:quit"),
      shortcut: "⌘Q",
      action: handleQuit,
      danger: true,
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.menu}>
        {/* Main actions */}
        <div className={styles.section}>
          {mainItems.map((item) => (
            <button
              key={item.id}
              className={styles.menuItem}
              onClick={item.action}
            >
              <span className={styles.menuIcon}>{item.icon}</span>
              <span className={styles.menuLabel}>{item.label}</span>
              {item.shortcut && (
                <span className={styles.menuShortcut}>{item.shortcut}</span>
              )}
            </button>
          ))}
        </div>

        {/* Recent captures submenu */}
        {recentItems.length > 0 && (
          <>
            <div className={styles.separator} />
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                {t("quickAccess:recentCaptures")}
              </div>
              {recentItems.map((item) => (
                <button
                  key={item.id}
                  className={styles.menuItem}
                  onClick={() => handleOpenRecent(item.id)}
                >
                  <span className={styles.recentThumb}>
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt=""
                        className={styles.thumbImg}
                      />
                    ) : (
                      <Image size={14} />
                    )}
                  </span>
                  <span className={styles.recentLabel}>
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className={styles.recentType}>
                    {item.type === "recording"
                      ? t("history:typeRecording")
                      : item.type === "gif"
                        ? t("history:typeGif")
                        : t("history:typeScreenshot")}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Secondary actions */}
        <div className={styles.separator} />
        <div className={styles.section}>
          {secondaryItems.map((item) => (
            <button
              key={item.id}
              className={`${styles.menuItem} ${item.danger ? styles.menuItemDanger : ""}`}
              onClick={item.action}
            >
              <span className={styles.menuIcon}>{item.icon}</span>
              <span className={styles.menuLabel}>{item.label}</span>
              {item.shortcut && (
                <span className={styles.menuShortcut}>{item.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(SystemTray);
