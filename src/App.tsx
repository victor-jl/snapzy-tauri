import { useEffect } from "react";
import { useUIStore } from "./stores/uiStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useCapture } from "./hooks/useCapture";
import { useShortcuts } from "./hooks/useShortcuts";
import CaptureOverlay from "./components/capture/CaptureOverlay";
import CapturePreview from "./components/capture/CapturePreview";
import AnnotationEditor from "./components/annotate/AnnotationEditor";
import VideoEditor from "./components/videoEditor/VideoEditor";
import QuickAccessPanel from "./components/quickAccess/QuickAccessPanel";
import HistoryPanel from "./components/history/HistoryPanel";
import PreferencesWindow from "./components/preferences/PreferencesWindow";
import OnboardingWizard from "./components/onboarding/OnboardingWizard";
import SystemTray from "./components/common/SystemTray";
import "./App.css";

function App() {
  const activeView = useUIStore((s) => s.activeView);
  const setView = useUIStore((s) => s.setView);
  const isAnnotationOpen = useUIStore((s) => s.isAnnotationOpen);
  const isQuickAccessOpen = useUIStore((s) => s.isQuickAccessOpen);
  const isHistoryOpen = useUIStore((s) => s.isHistoryOpen);
  const isPreferencesOpen = useUIStore((s) => s.isPreferencesOpen);
  const isCapturing = useUIStore((s) => s.isCapturing);
  const theme = useSettingsStore((s) => s.theme);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const { monitors, windows } = useCapture();

  // Initialize: load settings and check onboarding
  useEffect(() => {
    loadSettings();

    const hasCompletedOnboarding = localStorage.getItem(
      "snapzy_onboarding_completed"
    );
    if (!hasCompletedOnboarding) {
      setView("onboarding");
    }
  }, []);

  // Register global shortcuts
  useShortcuts();

  // Load monitors and windows on mount
  useEffect(() => {
    monitors();
    windows();
  }, []);

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");

    if (theme === "light") {
      root.classList.add("theme-light");
    } else if (theme === "dark") {
      root.classList.add("theme-dark");
    }
    // 'system' uses the media query in CSS (default)
  }, [theme]);

  return (
    <div className="app-root">
      {/* System Tray - always rendered, handles menu bar interaction */}
      <SystemTray />

      {/* Main views - conditionally rendered based on UI state */}
      {activeView === "capture" && <CaptureOverlay />}

      {activeView === "quickAccess" && (
        <QuickAccessPanel />
      )}

      {isAnnotationOpen && activeView === "annotate" && (
        <AnnotationEditor />
      )}

      {activeView === "videoEditor" && (
        <VideoEditor />
      )}

      {isHistoryOpen && activeView === "history" && (
        <HistoryPanel />
      )}

      {isPreferencesOpen && activeView === "preferences" && (
        <PreferencesWindow />
      )}

      {activeView === "onboarding" && (
        <OnboardingWizard />
      )}

      {/* Capture preview overlay - shown after successful capture */}
      {isCapturing && (
        <CapturePreview />
      )}
    </div>
  );
}

export default App;
