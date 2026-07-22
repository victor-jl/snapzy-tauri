import { useEffect, useCallback, useRef } from "react";
import {
  register,
  unregister,
  isRegistered,
} from "@tauri-apps/plugin-global-shortcut";
import { useSettingsStore } from "../stores/settingsStore";
import { useUIStore } from "../stores/uiStore";
import { getModifierKey } from "../utils/platform";

type ShortcutAction =
  | "capture-fullscreen"
  | "capture-area"
  | "capture-window"
  | "capture-scrolling"
  | "capture-element"
  | "toggle-quick-access"
  | "toggle-history"
  | "toggle-preferences"
  | "toggle-annotation"
  | "start-recording"
  | "stop-recording"
  | "copy-to-clipboard"
  | "save-file";

interface ShortcutEntry {
  action: ShortcutAction;
  defaultKeys: Record<"mac" | "win", string>;
  handler: () => void;
}

const defaultShortcuts: Record<ShortcutAction, { mac: string; win: string }> =
  {
    "capture-fullscreen": {
      mac: "Command+Shift+1",
      win: "Ctrl+Shift+1",
    },
    "capture-area": {
      mac: "Command+Shift+2",
      win: "Ctrl+Shift+2",
    },
    "capture-window": {
      mac: "Command+Shift+3",
      win: "Ctrl+Shift+3",
    },
    "capture-scrolling": {
      mac: "Command+Shift+4",
      win: "Ctrl+Shift+4",
    },
    "capture-element": {
      mac: "Command+Shift+5",
      win: "Ctrl+Shift+5",
    },
    "toggle-quick-access": {
      mac: "Command+Shift+Space",
      win: "Ctrl+Shift+Space",
    },
    "toggle-history": {
      mac: "Command+Shift+H",
      win: "Ctrl+Shift+H",
    },
    "toggle-preferences": {
      mac: "Command+,",
      win: "Ctrl+,",
    },
    "toggle-annotation": {
      mac: "Command+Shift+A",
      win: "Ctrl+Shift+A",
    },
    "start-recording": {
      mac: "Command+Shift+R",
      win: "Ctrl+Shift+R",
    },
    "stop-recording": {
      mac: "Command+Shift+X",
      win: "Ctrl+Shift+X",
    },
    "copy-to-clipboard": {
      mac: "Command+C",
      win: "Ctrl+C",
    },
    "save-file": {
      mac: "Command+S",
      win: "Ctrl+S",
    },
  };

export function useShortcuts() {
  const shortcutsCustom = useSettingsStore(
    (s) => s.config.shortcuts.custom
  );

  const handlersRef = useRef<Record<string, () => void>>({});
  const registeredRef = useRef<Set<string>>(new Set());

  const resolveShortcut = useCallback(
    (action: ShortcutAction): string => {
      const platform = getModifierKey() === "Cmd" ? "mac" : "win";

      // Check custom shortcuts first
      if (shortcutsCustom[action]) {
        return shortcutsCustom[action];
      }

      return defaultShortcuts[action]?.[platform] ?? "";
    },
    [shortcutsCustom]
  );

  const buildHandlers = useCallback(() => {
    const { setView, togglePanel, openCapture } = useUIStore.getState();

    const actions: Record<ShortcutAction, () => void> = {
      "capture-fullscreen": () => {
        setView("capture");
        // The capture view will handle the actual capture
      },
      "capture-area": () => {
        setView("capture");
      },
      "capture-window": () => {
        setView("capture");
      },
      "capture-scrolling": () => {
        setView("capture");
      },
      "capture-element": () => {
        setView("capture");
      },
      "toggle-quick-access": () => {
        togglePanel("quickAccess");
      },
      "toggle-history": () => {
        setView("history");
      },
      "toggle-preferences": () => {
        setView("preferences");
      },
      "toggle-annotation": () => {
        togglePanel("annotation");
      },
      "start-recording": () => {
        togglePanel("recordingToolbar");
      },
      "stop-recording": () => {
        // Handled by recording hook
      },
      "copy-to-clipboard": () => {
        // Handled contextually by whatever view is active
      },
      "save-file": () => {
        // Handled contextually by whatever view is active
      },
    };

    handlersRef.current = actions;
    return actions;
  }, []);

  const registerAllShortcuts = useCallback(async () => {
    const actions = buildHandlers();

    // Unregister all previously registered shortcuts
    for (const shortcut of registeredRef.current) {
      try {
        if (await isRegistered(shortcut)) {
          await unregister(shortcut);
        }
      } catch {
        // Shortcut may already be unregistered
      }
    }
    registeredRef.current.clear();

    // Register current shortcuts
    for (const [action, handler] of Object.entries(actions)) {
      const shortcut = resolveShortcut(action as ShortcutAction);
      if (!shortcut) continue;

      try {
        await register(shortcut, handler);
        registeredRef.current.add(shortcut);
      } catch (err) {
        console.warn(
          `Failed to register shortcut "${shortcut}" for action "${action}":`,
          err
        );
      }
    }
  }, [resolveShortcut, buildHandlers]);

  useEffect(() => {
    registerAllShortcuts();

    return () => {
      // Cleanup all registered shortcuts
      for (const shortcut of registeredRef.current) {
        unregister(shortcut).catch(() => {});
      }
      registeredRef.current.clear();
    };
  }, [registerAllShortcuts, shortcutsCustom]);

  return {
    resolveShortcut,
    registerAllShortcuts,
    defaultShortcuts,
  };
}
