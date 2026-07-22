mod binary_resolver;
mod capture;
mod clipboard;
mod cloud;
mod commands;
mod config;
mod diagnostics;
mod ocr;
mod recording;
mod shortcuts;

use std::sync::Mutex;

/// Shared recording state managed by Tauri.
pub struct RecordingState {
    pub active: bool,
    pub output_path: Option<String>,
    pub ffmpeg_process: Option<std::process::Child>,
    pub area: Option<CaptureArea>,
    pub fps: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CaptureArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
    pub scale_factor: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WindowInfo {
    pub id: u32,
    pub title: String,
    pub app_name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_minimized: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OcrResult {
    pub text: String,
    pub confidence: f32,
    pub blocks: Vec<OcrBlock>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OcrBlock {
    pub text: String,
    pub confidence: f32,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiagnosticInfo {
    pub os: String,
    pub os_version: String,
    pub hostname: String,
    pub cpu_arch: String,
    pub cpu_count: usize,
    pub total_memory_gb: f64,
    pub displays: Vec<DisplayInfo>,
    pub tauri_version: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DisplayInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScrollCaptureState {
    pub frames: Vec<Vec<u8>>,
    pub scroll_y: i32,
    pub total_height: u32,
    pub width: u32,
    pub overlap_percent: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RecordingOptions {
    pub area: Option<CaptureArea>,
    pub fps: u32,
    pub include_audio: bool,
    pub include_mic: bool,
    pub format: String, // "mp4" or "webm"
    pub show_clicks: bool,
    pub show_keystrokes: bool,
    pub output_path: Option<String>,
}

/// Unified error type that implements Serialize for frontend consumption.
#[derive(Debug)]
pub enum SnapzyError {
    CaptureError(String),
    ClipboardError(String),
    RecordingError(String),
    OcrError(String),
    IoError(std::io::Error),
    ImageError(String),
    EncodingError(String),
    NotFound(String),
    General(String),
}

impl std::fmt::Display for SnapzyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SnapzyError::CaptureError(e) => write!(f, "Screenshot capture failed: {e}"),
            SnapzyError::ClipboardError(e) => write!(f, "Clipboard operation failed: {e}"),
            SnapzyError::RecordingError(e) => write!(f, "Recording error: {e}"),
            SnapzyError::OcrError(e) => write!(f, "OCR error: {e}"),
            SnapzyError::IoError(e) => write!(f, "IO error: {e}"),
            SnapzyError::ImageError(e) => write!(f, "Image processing error: {e}"),
            SnapzyError::EncodingError(e) => write!(f, "Encoding error: {e}"),
            SnapzyError::NotFound(e) => write!(f, "Not found: {e}"),
            SnapzyError::General(e) => write!(f, "{e}"),
        }
    }
}

impl std::error::Error for SnapzyError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            SnapzyError::IoError(e) => Some(e),
            _ => None,
        }
    }
}

impl From<std::io::Error> for SnapzyError {
    fn from(e: std::io::Error) -> Self {
        SnapzyError::IoError(e)
    }
}

// Implement Serialize for SnapzyError so Tauri can return it to the frontend.
impl serde::Serialize for SnapzyError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type SnapzyResult<T> = Result<T, SnapzyError>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let recording_state = RecordingState {
        active: false,
        output_path: None,
        ffmpeg_process: None,
        area: None,
        fps: 30,
    };

    tauri::Builder::default()
        .manage(Mutex::new(recording_state))
        .manage(Mutex::new(None::<ScrollCaptureState>))
        .plugin(tauri_plugin_global_shortcut::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            // Register default global shortcuts
            #[cfg(desktop)]
            {
                use tauri::Manager;
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    if let Err(e) = shortcuts::register_defaults(&handle) {
                        log::error!("Failed to register default shortcuts: {e}");
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Screenshot commands
            capture::screenshot::capture_fullscreen,
            capture::screenshot::capture_area,
            capture::screenshot::capture_window,
            capture::screenshot::capture_monitor,
            capture::screenshot::list_monitors,
            capture::screenshot::list_windows,
            // Scrolling capture commands
            capture::scrolling::start_scrolling_capture,
            capture::scrolling::capture_scroll_frame,
            capture::scrolling::finish_scrolling_capture,
            // Element capture commands
            capture::element::capture_element,
            // Recording commands
            recording::recorder::start_recording,
            recording::recorder::stop_recording,
            // GIF commands
            recording::gif_encoder::encode_gif,
            // Clipboard commands
            clipboard::copy_image_to_clipboard,
            clipboard::copy_text_to_clipboard,
            clipboard::read_text_from_clipboard,
            clipboard::copy_file_to_clipboard,
            // OCR commands
            ocr::recognize_text,
            // Diagnostics commands
            diagnostics::collect_diagnostic_info,
            // Cloud commands
            commands::cloud_cmds::upload_file,
            // Config commands
            commands::config_cmds::load_config,
            commands::config_cmds::save_config,
            commands::config_cmds::export_config,
            commands::config_cmds::import_config,
            commands::config_cmds::get_diagnostics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Snapzy");
}
