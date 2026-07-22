import { create } from "zustand";

export type RecordingFormat = "mp4" | "gif";

interface RecordingState {
  isRecording: boolean;
  duration: number;
  format: RecordingFormat;
  showClicks: boolean;
  showKeystrokes: boolean;
  outputPath: string | null;
  error: string | null;

  startRecording: (opts?: {
    format?: RecordingFormat;
    showClicks?: boolean;
    showKeystrokes?: boolean;
  }) => void;
  stopRecording: (outputPath?: string) => void;
  updateDuration: (seconds: number) => void;
  setFormat: (format: RecordingFormat) => void;
  setError: (error: string | null) => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  isRecording: false,
  duration: 0,
  format: "mp4",
  showClicks: false,
  showKeystrokes: false,
  outputPath: null,
  error: null,

  startRecording: (opts) =>
    set({
      isRecording: true,
      duration: 0,
      format: opts?.format ?? "mp4",
      showClicks: opts?.showClicks ?? false,
      showKeystrokes: opts?.showKeystrokes ?? false,
      outputPath: null,
      error: null,
    }),

  stopRecording: (outputPath) =>
    set({
      isRecording: false,
      outputPath: outputPath ?? null,
    }),

  updateDuration: (seconds) => set({ duration: seconds }),

  setFormat: (format) => set({ format }),

  setError: (error) => set({ error }),
}));
