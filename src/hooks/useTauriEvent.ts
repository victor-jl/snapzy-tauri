import { useEffect, useCallback, useRef } from "react";
import { listen, emit, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export type TauriEventName =
  | "shortcut-triggered"
  | "recording-started"
  | "recording-stopped"
  | "capture-completed"
  | "settings-changed"
  | "theme-changed"
  | "window-visible-changed";

interface UseTauriEventOptions<T = unknown> {
  event: TauriEventName;
  handler: (payload: T) => void;
  enabled?: boolean;
}

export function useTauriEvent<T = unknown>({
  event,
  handler,
  enabled = true,
}: UseTauriEventOptions<T>) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    let unlisten: UnlistenFn | undefined;

    const setup = async () => {
      try {
        unlisten = await listen<T>(event, (eventPayload) => {
          handlerRef.current(eventPayload.payload);
        });
      } catch (err) {
        console.warn(`Failed to listen for event "${event}":`, err);
      }
    };

    setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [event, enabled]);
}

/**
 * Emit an event to the Rust backend.
 */
export async function emitTauriEvent<T = unknown>(
  event: TauriEventName,
  payload?: T
): Promise<void> {
  try {
    await emit(event, payload);
  } catch (err) {
    console.warn(`Failed to emit event "${event}":`, err);
  }
}

/**
 * Call a Rust command and catch errors gracefully.
 */
export async function invokeCommand<T = unknown>(
  command: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    console.warn(`Failed to invoke command "${command}":`, err);
    return null;
  }
}

/**
 * Check for app updates via the Tauri updater plugin.
 */
export function useUpdateChecker() {
  const checkForUpdates = useCallback(async () => {
    try {
      await invoke("check_update");
    } catch (err) {
      console.warn("Update check failed:", err);
    }
  }, []);

  return { checkForUpdates };
}
