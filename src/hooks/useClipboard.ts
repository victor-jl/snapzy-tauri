import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ClipboardState {
  isLoading: boolean;
  error: string | null;
  lastOperation: "copy" | "paste" | null;
}

export function useClipboard() {
  const [state, setState] = useState<ClipboardState>({
    isLoading: false,
    error: null,
    lastOperation: null,
  });

  const copyImage = useCallback(async (data: string): Promise<boolean> => {
    setState({ isLoading: true, error: null, lastOperation: null });
    try {
      await invoke("copy_image_to_clipboard", { data });
      setState({ isLoading: false, error: null, lastOperation: "copy" });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ isLoading: false, error: msg, lastOperation: null });
      return false;
    }
  }, []);

  const copyText = useCallback(async (text: string): Promise<boolean> => {
    setState({ isLoading: true, error: null, lastOperation: null });
    try {
      await invoke("copy_text_to_clipboard", { text });
      setState({ isLoading: false, error: null, lastOperation: "copy" });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ isLoading: false, error: msg, lastOperation: null });
      return false;
    }
  }, []);

  const copyFile = useCallback(async (path: string): Promise<boolean> => {
    setState({ isLoading: true, error: null, lastOperation: null });
    try {
      await invoke("copy_file_to_clipboard", { path });
      setState({ isLoading: false, error: null, lastOperation: "copy" });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ isLoading: false, error: msg, lastOperation: null });
      return false;
    }
  }, []);

  const readText = useCallback(async (): Promise<string | null> => {
    setState({ isLoading: true, error: null, lastOperation: null });
    try {
      const text = await invoke<string>("read_text_from_clipboard");
      setState({ isLoading: false, error: null, lastOperation: "paste" });
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ isLoading: false, error: msg, lastOperation: null });
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    copyImage,
    copyText,
    copyFile,
    readText,
    clearError,
  };
}
