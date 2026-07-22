import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRecordingStore } from "../stores/recordingStore";
import type { RecordingFormat } from "../stores/recordingStore";

interface RecordingOptions {
  fps?: number;
  format?: RecordingFormat;
  includeAudio?: boolean;
  includeMic?: boolean;
  showClicks?: boolean;
  showKeystrokes?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  outputPath?: string;
}

export function useRecording() {
  const isRecording = useRecordingStore((s) => s.isRecording);
  const duration = useRecordingStore((s) => s.duration);
  const format = useRecordingStore((s) => s.format);
  const showClicks = useRecordingStore((s) => s.showClicks);
  const showKeystrokes = useRecordingStore((s) => s.showKeystrokes);
  const outputPath = useRecordingStore((s) => s.outputPath);
  const error = useRecordingStore((s) => s.error);
  const storeStartRecording = useRecordingStore((s) => s.startRecording);
  const storeStopRecording = useRecordingStore((s) => s.stopRecording);
  const updateDuration = useRecordingStore((s) => s.updateDuration);
  const setFormat = useRecordingStore((s) => s.setFormat);
  const setError = useRecordingStore((s) => s.setError);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        useRecordingStore.getState().updateDuration(
          useRecordingStore.getState().duration + 1
        );
      }, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [isRecording, clearTimer]);

  const startRecording = useCallback(
    async (options: RecordingOptions = {}) => {
      try {
        const area =
          options.x !== undefined &&
          options.y !== undefined &&
          options.width !== undefined &&
          options.height !== undefined
            ? {
                x: options.x,
                y: options.y,
                width: options.width,
                height: options.height,
              }
            : null;

        const recordingOptions = {
          area,
          fps: options.fps ?? 30,
          include_audio: options.includeAudio ?? false,
          include_mic: options.includeMic ?? false,
          format: options.format ?? "mp4",
          show_clicks: options.showClicks ?? false,
          show_keystrokes: options.showKeystrokes ?? false,
          output_path: options.outputPath ?? null,
        };

        storeStartRecording({
          format: options.format,
          showClicks: options.showClicks,
          showKeystrokes: options.showKeystrokes,
        });

        const result = await invoke<string>("start_recording", {
          options: recordingOptions,
        });

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return null;
      }
    },
    [storeStartRecording, setError]
  );

  const stopRecording = useCallback(async () => {
    try {
      if (format === "gif") {
        const gifPath = await invoke<string>("encode_gif", {
          frames: [],
          fps: 30,
          width: 1920,
          height: 1080,
        });
        storeStopRecording(gifPath);
        return gifPath;
      }

      const path = await invoke<string>("stop_recording");
      storeStopRecording(path);
      return path;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      storeStopRecording();
      return null;
    }
  }, [format, storeStopRecording, setError]);

  const formatDuration = useCallback((totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }, []);

  return {
    isRecording,
    duration,
    durationFormatted: formatDuration(duration),
    format,
    showClicks,
    showKeystrokes,
    outputPath,
    error,
    startRecording,
    stopRecording,
    setFormat,
  };
}
