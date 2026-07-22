import { create } from "zustand";

export type ActiveView =
  | "quickAccess"
  | "capture"
  | "annotate"
  | "videoEditor"
  | "history"
  | "preferences"
  | "onboarding";

interface UIState {
  activeView: ActiveView;
  isAnnotationOpen: boolean;
  isQuickAccessOpen: boolean;
  isHistoryOpen: boolean;
  isPreferencesOpen: boolean;
  isRecordingToolbarOpen: boolean;
  isCapturing: boolean;

  setView: (view: ActiveView) => void;
  togglePanel: (panel: "annotation" | "quickAccess" | "history" | "preferences" | "recordingToolbar") => void;
  closeAll: () => void;
  openCapture: () => void;
  setCapturing: (capturing: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: "quickAccess",
  isAnnotationOpen: false,
  isQuickAccessOpen: false,
  isHistoryOpen: false,
  isPreferencesOpen: false,
  isRecordingToolbarOpen: false,
  isCapturing: false,

  setView: (view) =>
    set({
      activeView: view,
      // Auto-close panels on view change
      isAnnotationOpen: false,
      isQuickAccessOpen: false,
      isHistoryOpen: false,
      isPreferencesOpen: false,
      isRecordingToolbarOpen: false,
    }),

  togglePanel: (panel) =>
    set((state) => {
      switch (panel) {
        case "annotation":
          return { isAnnotationOpen: !state.isAnnotationOpen };
        case "quickAccess":
          return { isQuickAccessOpen: !state.isQuickAccessOpen };
        case "history":
          return { isHistoryOpen: !state.isHistoryOpen };
        case "preferences":
          return { isPreferencesOpen: !state.isPreferencesOpen };
        case "recordingToolbar":
          return {
            isRecordingToolbarOpen: !state.isRecordingToolbarOpen,
          };
        default:
          return {};
      }
    }),

  closeAll: () =>
    set({
      isAnnotationOpen: false,
      isQuickAccessOpen: false,
      isHistoryOpen: false,
      isPreferencesOpen: false,
      isRecordingToolbarOpen: false,
    }),

  openCapture: () =>
    set({
      activeView: "capture",
      isQuickAccessOpen: false,
    }),

  setCapturing: (capturing) => set({ isCapturing: capturing }),
}));
