import React, { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Camera,
  Monitor,
  Mic,
  Keyboard,
  Languages,
  Palette,
  FolderOpen,
  Power,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Shield,
  MousePointer,
  Accessibility,
  Zap,
} from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUIStore } from "../../stores/uiStore";
import { getPlatformName, isMac } from "../../utils/platform";
import { availableLanguages } from "../../i18n";
import { invoke } from "@tauri-apps/api/core";
import styles from "./OnboardingWizard.module.css";

interface OnboardingWizardProps {
  onComplete: () => void;
}

interface StepConfig {
  id: string;
  title: string;
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

const quickTips = [
  "quickAccess:copy",
  "quickAccess:pinToScreen",
  "preferences:shortcuts",
  "capture:scrolling",
  "history:filterAnnotated",
];

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const { t, i18n } = useTranslation();
  const config = useSettingsStore((s) => s.config);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setView = useUIStore((s) => s.setView);
  const theme = useSettingsStore((s) => s.theme);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [animating, setAnimating] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState({
    screen: false,
    accessibility: false,
    microphone: false,
  });
  const [localSettings, setLocalSettings] = useState({
    language: config.general.language,
    theme: config.general.theme as string,
    saveLocation: config.capture.save_location,
    autoStart: config.general.launch_at_login,
  });

  const platform = getPlatformName();
  const isMacOS = isMac();
  const totalSteps = 5;

  const steps: StepConfig[] = [
    { id: "welcome", title: t("onboarding:welcome") },
    { id: "permissions", title: t("onboarding:permissions") },
    { id: "shortcuts", title: t("onboarding:setupShortcuts") },
    { id: "preferences", title: t("common:preferences") },
    { id: "done", title: t("onboarding:finish") },
  ];

  // Auto-rotate tips
  useEffect(() => {
    if (step !== 4) return;
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % quickTips.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [step]);

  const goNext = useCallback(() => {
    if (animating) return;
    setDirection("forward");
    setAnimating(true);
    setStep((prev) => Math.min(prev + 1, totalSteps - 1));
    setTimeout(() => setAnimating(false), 350);
  }, [animating, totalSteps]);

  const goBack = useCallback(() => {
    if (animating) return;
    setDirection("backward");
    setAnimating(true);
    setStep((prev) => Math.max(prev - 1, 0));
    setTimeout(() => setAnimating(false), 350);
  }, [animating]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handleFinish = useCallback(() => {
    // Apply all settings
    updateSection("general", {
      language: localSettings.language,
      theme: localSettings.theme,
      launch_at_login: localSettings.autoStart,
    });
    updateSection("capture", {
      save_location: localSettings.saveLocation,
    });
    setTheme(localSettings.theme as "light" | "dark" | "system");
    i18n.changeLanguage(localSettings.language);

    // Store completion
    try {
      localStorage.setItem("snapzy-onboarding-complete", "true");
    } catch {
      // Storage unavailable
    }

    onComplete();
  }, [localSettings, updateSection, setTheme, i18n, onComplete]);

  const requestScreenPermission = useCallback(async () => {
    try {
      await invoke("request_screen_permission");
      setPermissionStatus((prev) => ({ ...prev, screen: true }));
    } catch {
      // Permission denied
    }
  }, []);

  const requestAccessibilityPermission = useCallback(async () => {
    try {
      await invoke("request_accessibility_permission");
      setPermissionStatus((prev) => ({ ...prev, accessibility: true }));
    } catch {
      // Permission denied
    }
  }, []);

  const requestMicPermission = useCallback(async () => {
    try {
      await invoke("request_microphone_permission");
      setPermissionStatus((prev) => ({ ...prev, microphone: true }));
    } catch {
      // Permission denied
    }
  }, []);

  const handleBrowseLocation = useCallback(async () => {
    try {
      const selected = await invoke<string>("pick_folder");
      if (selected) {
        setLocalSettings((prev) => ({ ...prev, saveLocation: selected }));
      }
    } catch {
      // Dialog cancelled
    }
  }, []);

  const selectTheme = useCallback((newTheme: string) => {
    setLocalSettings((prev) => ({ ...prev, theme: newTheme }));
  }, []);

  const selectLanguage = useCallback((lang: string) => {
    setLocalSettings((prev) => ({ ...prev, language: lang }));
  }, []);

  const animationClass = animating
    ? direction === "forward"
      ? styles.slideLeft
      : styles.slideRight
    : "";

  return (
    <div className={styles.overlay}>
      <div className={styles.window}>
        {/* Skip button */}
        {step < totalSteps - 1 && (
          <button className={styles.skipBtn} onClick={handleSkip}>
            {t("onboarding:skip")}
          </button>
        )}

        {/* Progress dots */}
        <div className={styles.progress}>
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`${styles.dot} ${i === step ? styles.dotActive : ""} ${i < step ? styles.dotDone : ""}`}
            />
          ))}
        </div>

        {/* Step indicator */}
        <div className={styles.stepLabel}>
          {t("onboarding:step", { current: step + 1, total: totalSteps })}
        </div>

        {/* Content area */}
        <div className={styles.content}>
          <div className={`${styles.slide} ${animationClass}`} key={step}>
            {/* Step 1: Welcome */}
            {step === 0 && (
              <div className={styles.welcomeStep}>
                <div className={styles.logoContainer}>
                  <div className={styles.logo}>
                    <Camera size={48} />
                  </div>
                </div>
                <h1 className={styles.appName}>{t("app:name")}</h1>
                <p className={styles.tagline}>
                  {t("onboarding:welcomeSubtitle")}
                </p>
                <div className={styles.features}>
                  <div className={styles.featureItem}>
                    <Monitor size={20} />
                    <span>{t("onboarding:featuresCapture")}</span>
                  </div>
                  <div className={styles.featureItem}>
                    <MousePointer size={20} />
                    <span>{t("onboarding:featuresAnnotate")}</span>
                  </div>
                  <div className={styles.featureItem}>
                    <Zap size={20} />
                    <span>{t("onboarding:featuresRecord")}</span>
                  </div>
                </div>
                <button className={styles.primaryBtn} onClick={goNext}>
                  {t("onboarding:next")}
                  <ChevronRight size={18} />
                </button>
              </div>
            )}

            {/* Step 2: Permissions */}
            {step === 1 && (
              <div className={styles.permissionsStep}>
                <h2 className={styles.stepTitle}>
                  {t("onboarding:permissions")}
                </h2>
                <p className={styles.stepDesc}>
                  {t("onboarding:permissionsScreen")}
                </p>
                <div className={styles.permissionList}>
                  <div className={styles.permissionItem}>
                    <div className={styles.permissionInfo}>
                      <Monitor size={22} />
                      <div>
                        <div className={styles.permissionName}>
                          {t("capture:fullscreen")}
                        </div>
                        <div className={styles.permissionHint}>
                          {isMacOS
                            ? "System Settings → Privacy → Screen Recording"
                            : "Required for screen capture"}
                        </div>
                      </div>
                    </div>
                    {permissionStatus.screen ? (
                      <span className={styles.checkBadge}>
                        <Check size={16} />
                      </span>
                    ) : (
                      <button
                        className={styles.secondaryBtn}
                        onClick={requestScreenPermission}
                      >
                        {t("onboarding:permissionsGrant")}
                      </button>
                    )}
                  </div>

                  <div className={styles.permissionItem}>
                    <div className={styles.permissionInfo}>
                      <Accessibility size={22} />
                      <div>
                        <div className={styles.permissionName}>
                          {t("onboarding:permissionsAccessibility")}
                        </div>
                        <div className={styles.permissionHint}>
                          {isMacOS
                            ? "System Settings → Privacy → Accessibility"
                            : "Required for window detection"}
                        </div>
                      </div>
                    </div>
                    {permissionStatus.accessibility ? (
                      <span className={styles.checkBadge}>
                        <Check size={16} />
                      </span>
                    ) : (
                      <button
                        className={styles.secondaryBtn}
                        onClick={requestAccessibilityPermission}
                      >
                        {t("onboarding:permissionsGrant")}
                      </button>
                    )}
                  </div>

                  <div className={styles.permissionItem}>
                    <div className={styles.permissionInfo}>
                      <Mic size={22} />
                      <div>
                        <div className={styles.permissionName}>
                          {t("onboarding:permissionsMic")}
                        </div>
                        <div className={`${styles.permissionHint} ${styles.optionalHint}`}>
                          {t("common:optional", "Optional")}
                        </div>
                      </div>
                    </div>
                    {permissionStatus.microphone ? (
                      <span className={styles.checkBadge}>
                        <Check size={16} />
                      </span>
                    ) : (
                      <button
                        className={styles.secondaryBtn}
                        onClick={requestMicPermission}
                      >
                        {t("onboarding:permissionsGrant")}
                      </button>
                    )}
                  </div>
                </div>

                <button
                  className={styles.textBtn}
                  onClick={goNext}
                >
                  {t("onboarding:permissionsLater")}
                </button>
              </div>
            )}

            {/* Step 3: Shortcuts */}
            {step === 2 && (
              <div className={styles.shortcutsStep}>
                <h2 className={styles.stepTitle}>
                  {t("onboarding:setupShortcuts")}
                </h2>
                <p className={styles.stepDesc}>
                  {t("onboarding:setupShortcutsDesc")}
                </p>

                <div className={styles.shortcutList}>
                  <div className={styles.shortcutItem}>
                    <div className={styles.shortcutVisual}>
                      <span className={styles.keycap}>
                        {isMacOS ? "⌘" : "Ctrl"}
                      </span>
                      <span className={styles.keyPlus}>+</span>
                      <span className={styles.keycap}>Shift</span>
                      <span className={styles.keyPlus}>+</span>
                      <span className={styles.keycap}>2</span>
                    </div>
                    <span className={styles.shortcutLabel}>
                      {t("preferences:shortcutCaptureArea")}
                    </span>
                  </div>
                  <div className={styles.shortcutItem}>
                    <div className={styles.shortcutVisual}>
                      <span className={styles.keycap}>
                        {isMacOS ? "⌘" : "Ctrl"}
                      </span>
                      <span className={styles.keyPlus}>+</span>
                      <span className={styles.keycap}>Shift</span>
                      <span className={styles.keyPlus}>+</span>
                      <span className={styles.keycap}>R</span>
                    </div>
                    <span className={styles.shortcutLabel}>
                      {t("preferences:shortcutStartRecording")}
                    </span>
                  </div>
                  <div className={styles.shortcutItem}>
                    <div className={styles.shortcutVisual}>
                      <span className={styles.keycap}>
                        {isMacOS ? "⌘" : "Ctrl"}
                      </span>
                      <span className={styles.keyPlus}>+</span>
                      <span className={styles.keycap}>Shift</span>
                      <span className={styles.keyPlus}>+</span>
                      <span className={styles.keycap}>Space</span>
                    </div>
                    <span className={styles.shortcutLabel}>
                      {t("preferences:shortcutToggleQuickAccess")}
                    </span>
                  </div>
                </div>

                <button
                  className={styles.textBtn}
                  onClick={() => setView("preferences")}
                >
                  {t("common:settings")} → {t("preferences:shortcuts")}
                </button>
              </div>
            )}

            {/* Step 4: Quick Preferences */}
            {step === 3 && (
              <div className={styles.quickPrefsStep}>
                <h2 className={styles.stepTitle}>
                  {t("common:preferences")}
                </h2>
                <p className={styles.stepDesc}>
                  {t("onboarding:setupCloudDesc")}
                </p>

                <div className={styles.prefsGrid}>
                  {/* Language */}
                  <div className={styles.prefField}>
                    <label className={styles.prefLabel}>
                      <Languages size={16} />
                      {t("preferences:language")}
                    </label>
                    <select
                      className={styles.prefSelect}
                      value={localSettings.language}
                      onChange={(e) => selectLanguage(e.target.value)}
                    >
                      {availableLanguages.map((lang) => (
                        <option key={lang} value={lang}>
                          {languageNames[lang] || lang}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Theme */}
                  <div className={styles.prefField}>
                    <label className={styles.prefLabel}>
                      <Palette size={16} />
                      {t("preferences:theme")}
                    </label>
                    <div className={styles.themeSelector}>
                      {["system", "light", "dark"].map((th) => (
                        <button
                          key={th}
                          className={`${styles.themeOption} ${
                            localSettings.theme === th
                              ? styles.themeOptionActive
                              : ""
                          }`}
                          onClick={() => selectTheme(th)}
                        >
                          <div
                            className={`${styles.themeSwatch} ${styles[`theme${th.charAt(0).toUpperCase() + th.slice(1)}`] || ""}`}
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

                  {/* Save Location */}
                  <div className={styles.prefField}>
                    <label className={styles.prefLabel}>
                      <FolderOpen size={16} />
                      {t("preferences:saveLocation")}
                    </label>
                    <div className={styles.pathInput}>
                      <input
                        className={styles.prefInput}
                        type="text"
                        value={localSettings.saveLocation}
                        readOnly
                        placeholder="~/Desktop"
                      />
                      <button
                        className={styles.browseBtn}
                        onClick={handleBrowseLocation}
                      >
                        {t("common:browse", "Browse")}
                      </button>
                    </div>
                  </div>

                  {/* Auto-start */}
                  <div className={styles.prefField}>
                    <label className={styles.prefToggle}>
                      <Power size={16} />
                      {t("preferences:launchAtLogin")}
                      <input
                        type="checkbox"
                        className={styles.toggleSwitch}
                        checked={localSettings.autoStart}
                        onChange={(e) =>
                          setLocalSettings((prev) => ({
                            ...prev,
                            autoStart: e.target.checked,
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Done */}
            {step === 4 && (
              <div className={styles.doneStep}>
                <div className={styles.celebrationIcon}>
                  <div className={styles.celebrationCircle}>
                    <Check size={40} />
                  </div>
                </div>
                <h2 className={styles.doneTitle}>
                  {t("onboarding:welcome")}!
                </h2>
                <p className={styles.doneDesc}>
                  {t("onboarding:privacyNote")}
                </p>

                <div className={styles.tipsCarousel}>
                  <div className={styles.tipCard}>
                    <Zap size={18} />
                    <span>{t(quickTips[tipIndex])}</span>
                  </div>
                  <div className={styles.tipDots}>
                    {quickTips.map((_, i) => (
                      <div
                        key={i}
                        className={`${styles.tipDot} ${i === tipIndex ? styles.tipDotActive : ""}`}
                      />
                    ))}
                  </div>
                </div>

                <button className={styles.primaryBtn} onClick={handleFinish}>
                  {t("onboarding:finish")}
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className={styles.nav}>
          {step > 0 && step < totalSteps - 1 && (
            <button className={styles.navBtn} onClick={goBack}>
              <ChevronLeft size={16} />
              {t("onboarding:back")}
            </button>
          )}
          {step < totalSteps - 1 && step !== 0 && (
            <button className={styles.primaryBtn} onClick={goNext}>
              {t("onboarding:next")}
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(OnboardingWizard);
