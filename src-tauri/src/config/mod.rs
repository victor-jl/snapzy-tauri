use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::{SnapzyError, SnapzyResult};

// ---------------------------------------------------------------------------
// AppConfig – the complete application configuration
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub general: GeneralConfig,

    #[serde(default)]
    pub capture: CaptureConfig,

    #[serde(default)]
    pub annotate: AnnotateConfig,

    #[serde(default)]
    pub cloud: CloudConfigSection,

    #[serde(default)]
    pub shortcuts: ShortcutsConfig,

    #[serde(default)]
    pub recording: RecordingConfig,

    #[serde(default)]
    pub history: HistoryConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralConfig {
    #[serde(default = "default_true")]
    pub launch_at_login: bool,

    #[serde(default = "default_true")]
    pub show_in_menu_bar: bool,

    #[serde(default = "default_language")]
    pub language: String,

    #[serde(default = "default_theme")]
    pub theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureConfig {
    #[serde(default = "default_capture_action")]
    pub default_action: String, // "clipboard", "save", "annotate"

    #[serde(default = "default_save_location")]
    pub save_location: String,

    #[serde(default = "default_file_format")]
    pub file_format: String, // "png", "jpg", "webp"

    #[serde(default = "default_true")]
    pub include_shadow: bool,

    #[serde(default = "default_true")]
    pub play_sound: bool,

    #[serde(default = "default_true")]
    pub show_mouse: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnotateConfig {
    #[serde(default = "default_annotate_color")]
    pub default_color: String, // hex e.g. "#FF0000"

    #[serde(default = "default_annotate_tool")]
    pub default_tool: String, // "pen", "arrow", "rectangle", "text", "blur"

    #[serde(default = "default_true")]
    pub auto_open: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudConfigSection {
    #[serde(default)]
    pub enabled: bool,

    #[serde(default = "default_cloud_provider")]
    pub provider: String, // "s3", "r2", "google_drive", "none"

    /// Provider-specific JSON blob stored as-is.
    #[serde(default)]
    pub credentials: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutsConfig {
    /// Custom shortcut overrides: action → shortcut string.
    #[serde(default)]
    pub custom: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingConfig {
    #[serde(default = "default_recording_fps")]
    pub fps: u32,

    #[serde(default = "default_recording_format")]
    pub format: String, // "mp4" or "webm"

    #[serde(default)]
    pub include_audio: bool,

    #[serde(default)]
    pub include_mic: bool,

    #[serde(default)]
    pub show_clicks: bool,

    #[serde(default)]
    pub show_keystrokes: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryConfig {
    #[serde(default = "default_retention_days")]
    pub retention_days: u32,

    #[serde(default = "default_max_items")]
    pub max_items: u32,
}

// ---------------------------------------------------------------------------
// Default impls
// ---------------------------------------------------------------------------

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            general: Default::default(),
            capture: Default::default(),
            annotate: Default::default(),
            cloud: Default::default(),
            shortcuts: Default::default(),
            recording: Default::default(),
            history: Default::default(),
        }
    }
}

macro_rules! impl_default {
    ($t:ty) => {
        impl Default for $t {
            fn default() -> Self {
                Self {
                    $(let _: ();)* // trick to accept field defaults.
                }
            }
        }
    };
}

// Not using macro; implement manually so field defaults are resolved correctly.

impl Default for GeneralConfig {
    fn default() -> Self {
        Self {
            launch_at_login: default_true(),
            show_in_menu_bar: default_true(),
            language: default_language(),
            theme: default_theme(),
        }
    }
}

impl Default for CaptureConfig {
    fn default() -> Self {
        Self {
            default_action: default_capture_action(),
            save_location: default_save_location(),
            file_format: default_file_format(),
            include_shadow: default_true(),
            play_sound: default_true(),
            show_mouse: default_true(),
        }
    }
}

impl Default for AnnotateConfig {
    fn default() -> Self {
        Self {
            default_color: default_annotate_color(),
            default_tool: default_annotate_tool(),
            auto_open: default_true(),
        }
    }
}

impl Default for CloudConfigSection {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: default_cloud_provider(),
            credentials: serde_json::Value::Null,
        }
    }
}

impl Default for ShortcutsConfig {
    fn default() -> Self {
        Self {
            custom: std::collections::HashMap::new(),
        }
    }
}

impl Default for RecordingConfig {
    fn default() -> Self {
        Self {
            fps: default_recording_fps(),
            format: default_recording_format(),
            include_audio: false,
            include_mic: false,
            show_clicks: false,
            show_keystrokes: false,
        }
    }
}

impl Default for HistoryConfig {
    fn default() -> Self {
        Self {
            retention_days: default_retention_days(),
            max_items: default_max_items(),
        }
    }
}

// ---------------------------------------------------------------------------
// Serde default helpers
// ---------------------------------------------------------------------------

fn default_true() -> bool {
    true
}
fn default_language() -> String {
    "en".into()
}
fn default_theme() -> String {
    "system".into()
}
fn default_capture_action() -> String {
    "clipboard".into()
}
fn default_save_location() -> String {
    "Desktop".into()
}
fn default_file_format() -> String {
    "png".into()
}
fn default_annotate_color() -> String {
    "#FF0000".into()
}
fn default_annotate_tool() -> String {
    "pen".into()
}
fn default_cloud_provider() -> String {
    "none".into()
}
fn default_recording_fps() -> u32 {
    30
}
fn default_recording_format() -> String {
    "mp4".into()
}
fn default_retention_days() -> u32 {
    30
}
fn default_max_items() -> u32 {
    500
}

// ---------------------------------------------------------------------------
// Config I/O
// ---------------------------------------------------------------------------

/// Return the path to the config TOML file inside the app-data directory.
pub fn config_path(app_handle: &tauri::AppHandle) -> SnapzyResult<PathBuf> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| SnapzyError::General(format!("Failed to resolve app data dir: {e}")))?;

    // Ensure the directory exists.
    fs::create_dir_all(&data_dir)?;

    Ok(data_dir.join("config.toml"))
}

/// Load the application configuration from disk.
/// Returns defaults if no config file exists yet.
pub fn load_config(app_handle: &tauri::AppHandle) -> SnapzyResult<AppConfig> {
    let path = config_path(app_handle)?;

    match fs::read_to_string(&path) {
        Ok(content) => {
            let config: AppConfig = toml::from_str(&content).map_err(|e| {
                SnapzyError::General(format!("Failed to parse config TOML: {e}"))
            })?;
            log::info!("Config loaded from {}", path.display());
            Ok(config)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            let defaults = AppConfig::default();
            log::info!(
                "No config file found at {}; using defaults.",
                path.display()
            );
            // Optionally write the default config so the user has a starting point.
            let default_toml = toml::to_string_pretty(&defaults).map_err(|e| {
                SnapzyError::General(format!("Failed to serialize default config: {e}"))
            })?;
            fs::write(&path, default_toml)?;
            Ok(defaults)
        }
        Err(e) => Err(SnapzyError::from(e)),
    }
}

/// Save the application configuration to disk.
pub fn save_config(app_handle: &tauri::AppHandle, config: AppConfig) -> SnapzyResult<()> {
    let path = config_path(app_handle)?;

    let toml_str = toml::to_string_pretty(&config).map_err(|e| {
        SnapzyError::General(format!("Failed to serialize config to TOML: {e}"))
    })?;

    fs::write(&path, toml_str)?;

    log::info!("Config saved to {}", path.display());
    Ok(())
}

/// Export the current configuration as a TOML string.
pub fn export_config(app_handle: &tauri::AppHandle) -> SnapzyResult<String> {
    let config = load_config(app_handle)?;
    toml::to_string_pretty(&config).map_err(|e| {
        SnapzyError::General(format!("Failed to export config as TOML: {e}"))
    })
}

/// Import configuration from a TOML string, validate it, and save it to disk.
pub fn import_config(
    app_handle: &tauri::AppHandle,
    toml_data: &str,
) -> SnapzyResult<AppConfig> {
    let config: AppConfig = toml::from_str(toml_data).map_err(|e| {
        SnapzyError::General(format!("Failed to parse imported TOML: {e}"))
    })?;

    // Validate and save.
    save_config(app_handle, config.clone())?;

    log::info!("Config imported successfully.");
    Ok(config)
}
