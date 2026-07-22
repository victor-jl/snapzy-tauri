use crate::SnapzyResult;

use crate::config::{self, AppConfig};
use crate::DiagnosticInfo;

/// Load the full application configuration from disk.
#[tauri::command]
pub fn load_config_cmd(app_handle: tauri::AppHandle) -> SnapzyResult<AppConfig> {
    config::load_config(&app_handle)
}

/// Save the application configuration to disk.
#[tauri::command]
pub fn save_config_cmd(app_handle: tauri::AppHandle, config: AppConfig) -> SnapzyResult<()> {
    config::save_config(&app_handle, config)
}

/// Export the current configuration as a TOML string.
#[tauri::command]
pub fn export_config_cmd(app_handle: tauri::AppHandle) -> SnapzyResult<String> {
    config::export_config(&app_handle)
}

/// Import configuration from a TOML string.
#[tauri::command]
pub fn import_config_cmd(
    app_handle: tauri::AppHandle,
    toml_data: String,
) -> SnapzyResult<AppConfig> {
    config::import_config(&app_handle, &toml_data)
}

/// Collect system diagnostic information for support / debugging.
#[tauri::command]
pub fn get_diagnostics_cmd() -> SnapzyResult<DiagnosticInfo> {
    crate::diagnostics::collect_diagnostic_info()
}
