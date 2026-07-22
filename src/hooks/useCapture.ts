import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useCaptureStore } from "../stores/captureStore";
import type { MonitorInfo, WindowInfo } from "../stores/captureStore";

interface CaptureError {
  message: string;
  code?: string;
}

export function useCapture() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<CaptureError | null>(null);

  const startCapture = useCaptureStore((s) => s.startCapture);
  const finishCapture = useCaptureStore((s) => s.finishCapture);
  const cancelCapture = useCaptureStore((s) => s.cancelCapture);
  const setMonitors = useCaptureStore((s) => s.setMonitors);
  const setWindows = useCaptureStore((s) => s.setWindows);
  const addScrollFrame = useCaptureStore((s) => s.addScrollFrame);
  const clearScrollFrames = useCaptureStore((s) => s.clearScrollFrames);
  const setCaptureError = useCaptureStore((s) => s.setError);

  const handleError = useCallback(
    (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : String(err);
      setError({ message: msg });
      setCaptureError(msg);
    },
    [setCaptureError]
  );

  const captureFullscreen = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    startCapture("fullscreen");
    try {
      const dataUrl = await invoke<string>("capture_fullscreen");
      finishCapture(dataUrl);
      return dataUrl;
    } catch (err) {
      handleError(err);
      cancelCapture();
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [startCapture, finishCapture, cancelCapture, handleError]);

  const captureArea = useCallback(
    async (x: number, y: number, width: number, height: number) => {
      setIsLoading(true);
      setError(null);
      startCapture("area");
      try {
        const dataUrl = await invoke<string>("capture_area", {
          x,
          y,
          width,
          height,
        });
        finishCapture(dataUrl);
        return dataUrl;
      } catch (err) {
        handleError(err);
        cancelCapture();
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [startCapture, finishCapture, cancelCapture, handleError]
  );

  const captureWindow = useCallback(
    async (title: string) => {
      setIsLoading(true);
      setError(null);
      startCapture("window");
      try {
        const dataUrl = await invoke<string>("capture_window", { title });
        finishCapture(dataUrl);
        return dataUrl;
      } catch (err) {
        handleError(err);
        cancelCapture();
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [startCapture, finishCapture, cancelCapture, handleError]
  );

  const captureElement = useCallback(
    async (x: number, y: number) => {
      setIsLoading(true);
      setError(null);
      startCapture("element");
      try {
        const dataUrl = await invoke<string>("capture_element", { x, y });
        finishCapture(dataUrl);
        return dataUrl;
      } catch (err) {
        handleError(err);
        cancelCapture();
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [startCapture, finishCapture, cancelCapture, handleError]
  );

  const fetchMonitors = useCallback(async () => {
    try {
      const monitors = await invoke<MonitorInfo[]>("list_monitors");
      setMonitors(monitors);
      return monitors;
    } catch (err) {
      handleError(err);
      return [];
    }
  }, [setMonitors, handleError]);

  const fetchWindows = useCallback(async () => {
    try {
      const windows = await invoke<WindowInfo[]>("list_windows");
      setWindows(windows);
      return windows;
    } catch (err) {
      handleError(err);
      return [];
    }
  }, [setWindows, handleError]);

  const startScrollCapture = useCallback(
    async (width: number, height: number, overlapPercent: number = 0.2) => {
      setIsLoading(true);
      setError(null);
      startCapture("scrolling");
      try {
        await invoke("start_scrolling_capture", {
          width,
          height,
          overlapPercent,
        });
        return true;
      } catch (err) {
        handleError(err);
        cancelCapture();
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [startCapture, cancelCapture, handleError]
  );

  const captureScrollFrame = useCallback(
    async (rawPng: string) => {
      try {
        const frameCount = await invoke<number>("capture_scroll_frame", {
          rawPng,
        });
        addScrollFrame(rawPng);
        return frameCount;
      } catch (err) {
        handleError(err);
        return -1;
      }
    },
    [addScrollFrame, handleError]
  );

  const finishScrollCapture = useCallback(async () => {
    setIsLoading(true);
    try {
      const stitchedDataUrl = await invoke<string>("finish_scrolling_capture");
      finishCapture(stitchedDataUrl);
      clearScrollFrames();
      return stitchedDataUrl;
    } catch (err) {
      handleError(err);
      cancelCapture();
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [finishCapture, cancelCapture, clearScrollFrames, handleError]);

  return {
    isLoading,
    error,
    captureFullscreen,
    captureArea,
    captureWindow,
    captureElement,
    fetchMonitors,
    fetchWindows,
    startScrollCapture,
    captureScrollFrame,
    finishScrollCapture,
    cancelCapture,
  };
}
