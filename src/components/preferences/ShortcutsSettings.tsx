import React, { useState, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Pencil,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  X,
} from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { getModifierKey } from "../../utils/platform";
import styles from "./ShortcutsSettings.module.css";

interface ShortcutsSettingsProps {
  onChange: () => void;
}

interface ShortcutDefinition {
  action: string;
  group: string;
  label: string;
  defaultKeys: Record<"mac" | "win", string>;
}

const allShortcuts: ShortcutDefinition[] = [
  // Capture
  { action: "capture-fullscreen", group: "Capture", label: "preferences:shortcutCaptureFullscreen", defaultKeys: { mac: "⌘⇧1", win: "Ctrl+Shift+1" } },
  { action: "capture-area", group: "Capture", label: "preferences:shortcutCaptureArea", defaultKeys: { mac: "⌘⇧2", win: "Ctrl+Shift+2" } },
  { action: "capture-window", group: "Capture", label: "preferences:shortcutCaptureWindow", defaultKeys: { mac: "⌘⇧3", win: "Ctrl+Shift+3" } },
  // Recording
  { action: "start-recording", group: "Recording", label: "preferences:shortcutStartRecording", defaultKeys: { mac: "⌘⇧5", win: "Ctrl+Shift+5" } },
  { action: "stop-recording", group: "Recording", label: "preferences:shortcutStopRecording", defaultKeys: { mac: "⌘⇧6", win: "Ctrl+Shift+6" } },
  // Annotation
  { action: "annotation-undo", group: "Annotation", label: "common:undo", defaultKeys: { mac: "⌘Z", win: "Ctrl+Z" } },
  { action: "annotation-redo", group: "Annotation", label: "common:redo", defaultKeys: { mac: "⌘⇧Z", win: "Ctrl+Shift+Z" } },
  { action: "tool-select", group: "Annotation", label: "annotate:select", defaultKeys: { mac: "V", win: "V" } },
  { action: "tool-arrow", group: "Annotation", label: "annotate:arrow", defaultKeys: { mac: "A", win: "A" } },
  { action: "tool-rectangle", group: "Annotation", label: "annotate:rectangle", defaultKeys: { mac: "R", win: "R" } },
  { action: "tool-ellipse", group: "Annotation", label: "annotate:ellipse", defaultKeys: { mac: "O", win: "O" } },
  { action: "tool-line", group: "Annotation", label: "annotate:line", defaultKeys: { mac: "L", win: "L" } },
  { action: "tool-text", group: "Annotation", label: "annotate:text", defaultKeys: { mac: "T", win: "T" } },
  { action: "tool-blur", group: "Annotation", label: "annotate:blur", defaultKeys: { mac: "B", win: "B" } },
  { action: "tool-crop", group: "Annotation", label: "annotate:crop", defaultKeys: { mac: "C", win: "C" } },
  // UI Navigation
  { action: "toggle-quick-access", group: "UI Navigation", label: "preferences:shortcutToggleQuickAccess", defaultKeys: { mac: "⌘⇧Space", win: "Ctrl+Shift+Space" } },
  { action: "toggle-history", group: "UI Navigation", label: "preferences:shortcutToggleHistory", defaultKeys: { mac: "⌘⇧H", win: "Ctrl+Shift+H" } },
  { action: "toggle-preferences", group: "UI Navigation", label: "preferences:shortcutTogglePreferences", defaultKeys: { mac: "⌘,", win: "Ctrl+," } },
  // Actions
  { action: "copy-to-clipboard", group: "Actions", label: "preferences:shortcutCopyClipboard", defaultKeys: { mac: "⌘C", win: "Ctrl+C" } },
  { action: "save-file", group: "Actions", label: "preferences:shortcutSaveFile", defaultKeys: { mac: "⌘S", win: "Ctrl+S" } },
  { action: "upload", group: "Actions", label: "common:upload", defaultKeys: { mac: "⌘U", win: "Ctrl+U" } },
];

const groupOrder = ["Capture", "Recording", "Annotation", "UI Navigation", "Actions"];

const ShortcutsSettings: React.FC<ShortcutsSettingsProps> = ({ onChange }) => {
  const { t } = useTranslation();
  const config = useSettingsStore((s) => s.config);
  const updateSection = useSettingsStore((s) => s.updateSection);

  const custom = config.shortcuts.custom || {};
  const platform = getModifierKey() === "Cmd" ? "mac" : "win";

  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [captureKeys, setCaptureKeys] = useState<string[]>([]);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const captureRef = useRef<HTMLDivElement>(null);

  // Resolve shortcut display value
  const getShortcut = useCallback(
    (action: string, shortcut: ShortcutDefinition): string => {
      if (custom[action]) return custom[action];
      return shortcut.defaultKeys[platform === "mac" ? "mac" : "win"];
    },
    [custom, platform]
  );

  const startEditing = useCallback(
    (action: string) => {
      setEditingAction(action);
      setCaptureKeys([]);
      setConflictWarning(null);
      // Focus capture area after render
      setTimeout(() => captureRef.current?.focus(), 0);
    },
    []
  );

  const handleKeyCapture = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setEditingAction(null);
        setCaptureKeys([]);
        return;
      }

      if (e.key === "Enter" && captureKeys.length > 0) {
        // Save the new shortcut
        const newShortcut = captureKeys.join("+");
        saveShortcut(editingAction!, newShortcut);
        return;
      }

      // Ignore standalone modifiers
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push(platform === "mac" ? "⌘" : "Ctrl");
      if (e.altKey) parts.push(platform === "mac" ? "⌥" : "Alt");
      if (e.shiftKey) parts.push("⇧");
      parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);

      const combo = parts.join("+");

      // Check for conflicts
      const conflicted = allShortcuts.find((s) => {
        if (s.action === editingAction) return false;
        const existing = custom[s.action] || s.defaultKeys[platform === "mac" ? "mac" : "win"];
        return existing === combo;
      });

      if (conflicted) {
        setConflictWarning(
          `${t("error:shortcutConflict")}: ${t(conflicted.label)}`
        );
      } else {
        setConflictWarning(null);
      }

      setCaptureKeys(parts);
    },
    [captureKeys, editingAction, platform, t]
  );

  const saveShortcut = useCallback(
    (action: string, shortcut: string) => {
      const newCustom = { ...custom, [action]: shortcut };
      updateSection("shortcuts", { custom: newCustom });
      setEditingAction(null);
      setCaptureKeys([]);
      setConflictWarning(null);
      onChange();
    },
    [custom, updateSection, onChange]
  );

  const resetShortcut = useCallback(
    (action: string) => {
      const newCustom = { ...custom };
      delete newCustom[action];
      updateSection("shortcuts", { custom: newCustom });
      onChange();
    },
    [custom, updateSection, onChange]
  );

  const resetAll = useCallback(() => {
    updateSection("shortcuts", { custom: {} });
    onChange();
  }, [updateSection, onChange]);

  const handleExport = useCallback(() => {
    const data = JSON.stringify(custom, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "snapzy-shortcuts.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [custom]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        updateSection("shortcuts", { custom: imported });
        onChange();
      } catch {
        // Invalid file
      }
    };
    input.click();
  }, [updateSection, onChange]);

  // Group and filter
  const filtered = useMemo(() => {
    if (!searchQuery) return allShortcuts;
    const q = searchQuery.toLowerCase();
    return allShortcuts.filter(
      (s) =>
        t(s.label).toLowerCase().includes(q) ||
        s.action.toLowerCase().includes(q) ||
        getShortcut(s.action, s).toLowerCase().includes(q)
    );
  }, [searchQuery, t, getShortcut]);

  const grouped = useMemo(() => {
    const groups: Record<string, ShortcutDefinition[]> = {};
    for (const s of filtered) {
      if (!groups[s.group]) groups[s.group] = [];
      groups[s.group].push(s);
    }
    return groupOrder.filter((g) => groups[g]).map((g) => ({ name: g, items: groups[g] }));
  }, [filtered]);

  const isCustomized = useCallback(
    (action: string) => !!custom[action],
    [custom]
  );

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{t("preferences:shortcuts")}</h2>

      {/* Search */}
      <div className={styles.searchRow}>
        <Search size={14} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("common:search") + "..."}
        />
      </div>

      {/* Platform indicator */}
      <div className={styles.platformNote}>
        {platform === "mac"
          ? "Showing macOS shortcuts (⌘ Cmd)"
          : "Showing Windows/Linux shortcuts (Ctrl)"}
      </div>

      {/* Shortcut list */}
      <div className={styles.shortcutList}>
        {grouped.map((group) => (
          <div key={group.name} className={styles.group}>
            <div className={styles.groupHeader}>{group.name}</div>
            {group.items.map((shortcut) => (
              <div key={shortcut.action} className={styles.row}>
                <span className={styles.actionLabel}>{t(shortcut.label)}</span>
                <div className={styles.shortcutCell}>
                  {editingAction === shortcut.action ? (
                    <div
                      ref={captureRef}
                      className={styles.captureInput}
                      tabIndex={0}
                      onKeyDown={handleKeyCapture}
                    >
                      {captureKeys.length > 0
                        ? captureKeys.join("+")
                        : t("preferences:recordShortcut")}
                      <button
                        className={styles.captureCancel}
                        onClick={() => setEditingAction(null)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`${styles.shortcutKeys} ${isCustomized(shortcut.action) ? styles.customKey : ""}`}
                    >
                      {getShortcut(shortcut.action, shortcut)}
                    </span>
                  )}
                  <button
                    className={styles.editBtn}
                    onClick={() => startEditing(shortcut.action)}
                    title={t("common:edit")}
                  >
                    <Pencil size={13} />
                  </button>
                  {isCustomized(shortcut.action) && (
                    <button
                      className={styles.resetBtn}
                      onClick={() => resetShortcut(shortcut.action)}
                      title={t("preferences:resetDefaults")}
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Conflict warning */}
      {conflictWarning && (
        <div className={styles.conflict}>
          <AlertTriangle size={14} />
          {conflictWarning}
        </div>
      )}

      {/* Actions */}
      <div className={styles.actionsRow}>
        <button className={styles.actionBtn} onClick={resetAll}>
          <RotateCcw size={14} />
          {t("preferences:resetDefaults")}
        </button>
        <button className={styles.actionBtn} onClick={handleExport}>
          <Upload size={14} />
          {t("common:export", "Export")}
        </button>
        <button className={styles.actionBtn} onClick={handleImport}>
          <Download size={14} />
          {t("common:import", "Import")}
        </button>
      </div>
    </div>
  );
};

export default React.memo(ShortcutsSettings);
