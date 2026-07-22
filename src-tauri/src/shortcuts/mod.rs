use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

use crate::SnapzyError;

/// Holds the registered shortcut → action mapping so we can unregister later.
struct ShortcutEntry {
    shortcut: Shortcut,
    action: String,
}

/// Shared store of registered shortcuts across the application.
static REGISTERED: Mutex<Vec<ShortcutEntry>> = Mutex::new(Vec::new());

/// Register a global keyboard shortcut with the given action string.
/// When triggered, the backend emits a `shortcut-triggered` event carrying the action.
pub fn register_shortcut(
    app_handle: &tauri::AppHandle,
    shortcut_str: &str,
    action: &str,
) -> Result<(), SnapzyError> {
    let gs = app_handle.global_shortcut();
    let shortcut = parse_shortcut(shortcut_str)?;

    let handle = app_handle.clone();
    let action_owned = action.to_string();

    gs.on_shortcut(shortcut.clone(), move |_app, _shortcut, _event| {
        let _ = handle.emit("shortcut-triggered", &action_owned);
    })
    .map_err(|e| SnapzyError::General(format!("Failed to register shortcut '{shortcut_str}': {e}")))?;

    let mut entries = REGISTERED.lock().map_err(|e| {
        SnapzyError::General(format!("Shortcut registry lock poisoned: {e}"))
    })?;

    entries.push(ShortcutEntry {
        shortcut,
        action: action.to_string(),
    });

    log::info!("Registered shortcut: {shortcut_str} -> {action}");
    Ok(())
}

/// Unregister a single shortcut by its original string representation.
pub fn unregister_shortcut(
    app_handle: &tauri::AppHandle,
    shortcut_str: &str,
) -> Result<(), SnapzyError> {
    let shortcut = parse_shortcut(shortcut_str)?;
    let gs = app_handle.global_shortcut();

    gs.unregister(shortcut.clone())
        .map_err(|e| SnapzyError::General(format!("Failed to unregister shortcut '{shortcut_str}': {e}")))?;

    let mut entries = REGISTERED.lock().map_err(|e| {
        SnapzyError::General(format!("Shortcut registry lock poisoned: {e}"))
    })?;

    entries.retain(|e| e.shortcut != shortcut);

    log::info!("Unregistered shortcut: {shortcut_str}");
    Ok(())
}

/// Unregister every previously-registered shortcut.
pub fn unregister_all(app_handle: &tauri::AppHandle) -> Result<(), SnapzyError> {
    let gs = app_handle.global_shortcut();

    let entries = {
        let mut lock = REGISTERED.lock().map_err(|e| {
            SnapzyError::General(format!("Shortcut registry lock poisoned: {e}"))
        })?;
        std::mem::take(&mut *lock)
    };

    for entry in &entries {
        let _ = gs.unregister(entry.shortcut.clone());
    }

    log::info!("Unregistered all shortcuts ({})", entries.len());
    Ok(())
}

// ---------------------------------------------------------------------------
// Default shortcuts
// ---------------------------------------------------------------------------

/// Register the default Snapzy keyboard shortcuts.
pub fn register_defaults(app_handle: &tauri::AppHandle) -> Result<(), SnapzyError> {
    let defaults: Vec<(&str, &str)> = vec![
        ("Cmd+Shift+1", "capture_fullscreen"),
        ("Cmd+Shift+2", "capture_area"),
        ("Cmd+Shift+3", "capture_window"),
        ("Cmd+Shift+5", "start_recording"),
    ];

    for (shortcut_str, action) in &defaults {
        // Convert Cmd → platform-appropriate modifier.
        let adapted = adapt_modifiers(shortcut_str);
        if let Err(e) = register_shortcut(app_handle, &adapted, action) {
            log::warn!("Could not register default shortcut '{adapted}': {e}");
        }
    }

    Ok(())
}

/// Convert "Cmd" into the platform-appropriate modifier.
/// macOS  → Cmd (⌘)
/// Windows / Linux → Ctrl
fn adapt_modifiers(shortcut: &str) -> String {
    if cfg!(target_os = "macos") {
        shortcut.to_string()
    } else {
        shortcut.replace("Cmd+", "Ctrl+")
    }
}

// ---------------------------------------------------------------------------
// Shortcut parser
// ---------------------------------------------------------------------------

/// Parse a human-readable shortcut string like "Cmd+Shift+1" into a `Shortcut`.
fn parse_shortcut(input: &str) -> Result<Shortcut, SnapzyError> {
    let parts: Vec<&str> = input.split('+').map(|s| s.trim()).collect();
    if parts.len() < 2 {
        return Err(SnapzyError::General(format!(
            "Invalid shortcut format: '{input}'. Expected e.g. 'Cmd+Shift+1'"
        )));
    }

    let mut modifiers = Modifiers::empty();
    let code_str = parts.last().unwrap();

    for part in &parts[..parts.len() - 1] {
        match *part {
            "Cmd" | "Meta" | "Super" | "Win" => modifiers.insert(Modifiers::META),
            "Ctrl" | "Control" => modifiers.insert(Modifiers::CONTROL),
            "Alt" | "Option" => modifiers.insert(Modifiers::ALT),
            "Shift" => modifiers.insert(Modifiers::SHIFT),
            other => {
                return Err(SnapzyError::General(format!(
                    "Unknown modifier: '{other}' in shortcut '{input}'"
                )));
            }
        }
    }

    let code = parse_code(code_str).ok_or_else(|| {
        SnapzyError::General(format!(
            "Unknown key: '{code_str}' in shortcut '{input}'"
        ))
    })?;

    Ok(Shortcut::new(modifiers, code))
}

/// Map a key string to a `Code`.
fn parse_code(s: &str) -> Option<Code> {
    match s {
        // Digits
        "0" => Some(Code::Digit0),
        "1" => Some(Code::Digit1),
        "2" => Some(Code::Digit2),
        "3" => Some(Code::Digit3),
        "4" => Some(Code::Digit4),
        "5" => Some(Code::Digit5),
        "6" => Some(Code::Digit6),
        "7" => Some(Code::Digit7),
        "8" => Some(Code::Digit8),
        "9" => Some(Code::Digit9),

        // Letters
        "A" => Some(Code::KeyA),
        "B" => Some(Code::KeyB),
        "C" => Some(Code::KeyC),
        "D" => Some(Code::KeyD),
        "E" => Some(Code::KeyE),
        "F" => Some(Code::KeyF),
        "G" => Some(Code::KeyG),
        "H" => Some(Code::KeyH),
        "I" => Some(Code::KeyI),
        "J" => Some(Code::KeyJ),
        "K" => Some(Code::KeyK),
        "L" => Some(Code::KeyL),
        "M" => Some(Code::KeyM),
        "N" => Some(Code::KeyN),
        "O" => Some(Code::KeyO),
        "P" => Some(Code::KeyP),
        "Q" => Some(Code::KeyQ),
        "R" => Some(Code::KeyR),
        "S" => Some(Code::KeyS),
        "T" => Some(Code::KeyT),
        "U" => Some(Code::KeyU),
        "V" => Some(Code::KeyV),
        "W" => Some(Code::KeyW),
        "X" => Some(Code::KeyX),
        "Y" => Some(Code::KeyY),
        "Z" => Some(Code::KeyZ),

        // Function keys
        "F1" => Some(Code::F1),
        "F2" => Some(Code::F2),
        "F3" => Some(Code::F3),
        "F4" => Some(Code::F4),
        "F5" => Some(Code::F5),
        "F6" => Some(Code::F6),
        "F7" => Some(Code::F7),
        "F8" => Some(Code::F8),
        "F9" => Some(Code::F9),
        "F10" => Some(Code::F10),
        "F11" => Some(Code::F11),
        "F12" => Some(Code::F12),

        // Special keys
        "Space" => Some(Code::Space),
        "Tab" => Some(Code::Tab),
        "Enter" | "Return" => Some(Code::Enter),
        "Escape" | "Esc" => Some(Code::Escape),
        "Backspace" => Some(Code::Backspace),
        "Delete" => Some(Code::Delete),
        "Home" => Some(Code::Home),
        "End" => Some(Code::End),
        "PageUp" => Some(Code::PageUp),
        "PageDown" => Some(Code::PageDown),
        "ArrowUp" | "Up" => Some(Code::ArrowUp),
        "ArrowDown" | "Down" => Some(Code::ArrowDown),
        "ArrowLeft" | "Left" => Some(Code::ArrowLeft),
        "ArrowRight" | "Right" => Some(Code::ArrowRight),

        // Symbols (single-char).
        _ if s.len() == 1 => {
            match s.chars().next().unwrap() {
                '`' => Some(Code::Backquote),
                '-' => Some(Code::Minus),
                '=' => Some(Code::Equal),
                '[' => Some(Code::BracketLeft),
                ']' => Some(Code::BracketRight),
                '\\' => Some(Code::Backslash),
                ';' => Some(Code::Semicolon),
                '\'' => Some(Code::Quote),
                ',' => Some(Code::Comma),
                '.' => Some(Code::Period),
                '/' => Some(Code::Slash),
                _ => None,
            }
        }
        _ => None,
    }
}
