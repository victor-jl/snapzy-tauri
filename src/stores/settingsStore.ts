import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface GeneralConfig {
  launch_at_login: boolean;
  show_in_menu_bar: boolean;
  language: string;
  theme: string;
}

export interface CaptureConfig {
  default_action: string;
  save_location: string;
  file_format: string;
  include_shadow: boolean;
  play_sound: boolean;
  show_mouse: boolean;
}

export interface AnnotateConfig {
  default_color: string;
  default_tool: string;
  auto_open: boolean;
}

export interface CloudConfigSection {
  enabled: boolean;
  provider: string;
  credentials: Record<string, unknown>;
}

export interface ShortcutsConfig {
  custom: Record<string, string>;
}

export interface RecordingConfig {
  fps: number;
  format: string;
  include_audio: boolean;
  include_mic: boolean;
  show_clicks: boolean;
  show_keystrokes: boolean;
}

export interface HistoryConfig {
  retention_days: number;
  max_items: number;
}

export interface AppConfig {
  general: GeneralConfig;
  capture: CaptureConfig;
  annotate: AnnotateConfig;
  cloud: CloudConfigSection;
  shortcuts: ShortcutsConfig;
  recording: RecordingConfig;
  history: HistoryConfig;
}

export type Theme = "light" | "dark" | "system";
export type ConfigSection = keyof AppConfig;

const defaultConfig: AppConfig = {
  general: {
    launch_at_login: true,
    show_in_menu_bar: true,
    language: "en",
    theme: "system",
  },
  capture: {
    default_action: "clipboard",
    save_location: "Desktop",
    file_format: "png",
    include_shadow: true,
    play_sound: true,
    show_mouse: true,
  },
  annotate: {
    default_color: "#FF0000",
    default_tool: "pen",
    auto_open: true,
  },
  cloud: {
    enabled: false,
    provider: "none",
    credentials: {},
  },
  shortcuts: {
    custom: {},
  },
  recording: {
    fps: 30,
    format: "mp4",
    include_audio: false,
    include_mic: false,
    show_clicks: false,
    show_keystrokes: false,
  },
  history: {
    retention_days: 30,
    max_items: 500,
  },
};

interface SettingsState {
  config: AppConfig;
  theme: Theme;
  isLoading: boolean;
  error: string | null;

  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  updateSection: <K extends ConfigSection>(
    section: K,
    updates: Partial<AppConfig[K]>
  ) => void;
  setTheme: (theme: Theme) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  config: { ...defaultConfig },
  theme: "system",
  isLoading: false,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await invoke<AppConfig>("load_config");
      set({
        config,
        theme: (config.general.theme as Theme) || "system",
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  saveSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const { config } = get();
      await invoke("save_config", { config });
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  updateSection: (section, updates) =>
    set((state) => ({
      config: {
        ...state.config,
        [section]: {
          ...state.config[section],
          ...updates,
        },
      },
    })),

  setTheme: (theme) =>
    set((state) => ({
      theme,
      config: {
        ...state.config,
        general: {
          ...state.config.general,
          theme,
        },
      },
    })),
}));
