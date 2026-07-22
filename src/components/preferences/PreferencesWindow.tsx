import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Settings,
  Camera,
  PenTool,
  Video,
  Cloud,
  Command,
  Info,
  X,
  Check,
  RotateCcw,
} from "lucide-react";
import { useSettingsStore, ConfigSection } from "../../stores/settingsStore";
import GeneralSettings from "./GeneralSettings";
import CaptureSettings from "./CaptureSettings";
import AnnotateSettings from "./AnnotateSettings";
import CloudSettings from "./CloudSettings";
import ShortcutsSettings from "./ShortcutsSettings";
import AboutSettings from "./AboutSettings";
import styles from "./PreferencesWindow.module.css";

interface PreferencesWindowProps {
  onClose: () => void;
}

interface NavSection {
  id: string;
  icon: React.ReactNode;
  label: string;
  component: React.ComponentType<{ onChange: () => void }>;
  storeSection: ConfigSection;
}

const PreferencesWindow: React.FC<PreferencesWindowProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const config = useSettingsStore((s) => s.config);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const [activeSection, setActiveSection] = useState("general");
  const [hasChanges, setHasChanges] = useState(false);
  const [unsavedSections, setUnsavedSections] = useState<Set<string>>(
    new Set()
  );
  const [saving, setSaving] = useState(false);

  const sections: NavSection[] = useMemo(
    () => [
      {
        id: "general",
        icon: <Settings size={18} />,
        label: t("preferences:general"),
        component: GeneralSettings,
        storeSection: "general",
      },
      {
        id: "capture",
        icon: <Camera size={18} />,
        label: t("preferences:capture"),
        component: CaptureSettings,
        storeSection: "capture",
      },
      {
        id: "annotate",
        icon: <PenTool size={18} />,
        label: t("preferences:annotate"),
        component: AnnotateSettings,
        storeSection: "annotate",
      },
      {
        id: "recording",
        icon: <Video size={18} />,
        label: t("preferences:recording"),
        component: AnnotateSettings,
        storeSection: "recording",
      },
      {
        id: "cloud",
        icon: <Cloud size={18} />,
        label: t("preferences:cloud"),
        component: CloudSettings,
        storeSection: "cloud",
      },
      {
        id: "shortcuts",
        icon: <Command size={18} />,
        label: t("preferences:shortcuts"),
        component: ShortcutsSettings,
        storeSection: "shortcuts",
      },
      {
        id: "about",
        icon: <Info size={18} />,
        label: t("preferences:about"),
        component: AboutSettings,
        storeSection: "general",
      },
    ],
    [t]
  );

  const activeSectionData = useMemo(
    () => sections.find((s) => s.id === activeSection),
    [sections, activeSection]
  );

  const handleSectionChange = useCallback(() => {
    setHasChanges(true);
    setUnsavedSections((prev) => new Set(prev).add(activeSection));
  }, [activeSection]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await saveSettings();
    setSaving(false);
    setHasChanges(false);
    setUnsavedSections(new Set());
  }, [saveSettings]);

  const handleReset = useCallback(async () => {
    await loadSettings();
    setHasChanges(false);
    setUnsavedSections(new Set());
  }, [loadSettings]);

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const ActiveComponent = activeSectionData?.component;

  return (
    <div className={styles.overlay}>
      <div className={styles.window}>
        {/* Title Bar */}
        <div className={styles.titleBar}>
          <div className={styles.titleLeft}>
            <Settings size={16} />
            <span className={styles.titleText}>
              {t("preferences:title")}
            </span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Sidebar */}
          <nav className={styles.sidebar}>
            {sections.map((item) => (
              <button
                key={item.id}
                className={`${styles.navItem} ${
                  activeSection === item.id ? styles.navItemActive : ""
                }`}
                onClick={() => setActiveSection(item.id)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {unsavedSections.has(item.id) && (
                  <span className={styles.unsavedDot} />
                )}
              </button>
            ))}
          </nav>

          {/* Content */}
          <main className={styles.content}>
            <div className={styles.contentInner} key={activeSection}>
              {ActiveComponent && (
                <ActiveComponent onChange={handleSectionChange} />
              )}
            </div>
          </main>
        </div>

        {/* Bottom actions */}
        <div className={styles.actions}>
          <button
            className={styles.resetBtn}
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            <RotateCcw size={14} />
            {t("common:reset")}
          </button>
          <div className={styles.actionsRight}>
            <button className={styles.cancelBtn} onClick={onClose}>
              {t("common:cancel")}
            </button>
            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              <Check size={16} />
              {saving ? t("common:loading") : t("common:save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PreferencesWindow);
