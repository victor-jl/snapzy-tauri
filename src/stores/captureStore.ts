import { create } from "zustand";

export interface MonitorInfo {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_primary: boolean;
  scale_factor: number;
}

export interface WindowInfo {
  id: number;
  title: string;
  app_name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_minimized: boolean;
}

export type CaptureMode = "fullscreen" | "area" | "window" | "scrolling" | "element" | null;

interface CaptureState {
  currentScreenshot: string | null;
  captureMode: CaptureMode;
  isCapturing: boolean;
  monitors: MonitorInfo[];
  windows: WindowInfo[];
  scrollFrames: string[];
  error: string | null;

  startCapture: (mode: CaptureMode) => void;
  finishCapture: (screenshot: string) => void;
  cancelCapture: () => void;
  setMonitors: (monitors: MonitorInfo[]) => void;
  setWindows: (windows: WindowInfo[]) => void;
  addScrollFrame: (frame: string) => void;
  clearScrollFrames: () => void;
  setError: (error: string | null) => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  currentScreenshot: null,
  captureMode: null,
  isCapturing: false,
  monitors: [],
  windows: [],
  scrollFrames: [],
  error: null,

  startCapture: (mode) =>
    set({
      captureMode: mode,
      isCapturing: true,
      currentScreenshot: null,
      error: null,
    }),

  finishCapture: (screenshot) =>
    set({
      currentScreenshot: screenshot,
      isCapturing: false,
    }),

  cancelCapture: () =>
    set({
      captureMode: null,
      isCapturing: false,
      currentScreenshot: null,
      scrollFrames: [],
      error: null,
    }),

  setMonitors: (monitors) => set({ monitors }),

  setWindows: (windows) => set({ windows }),

  addScrollFrame: (frame) =>
    set((state) => ({
      scrollFrames: [...state.scrollFrames, frame],
    })),

  clearScrollFrames: () => set({ scrollFrames: [] }),

  setError: (error) => set({ error }),
}));
