use crate::{SnapzyError, SnapzyResult};

/// Capture the entire primary monitor and return a base64-encoded PNG data URI.
#[tauri::command]
pub fn capture_fullscreen_cmd() -> SnapzyResult<String> {
    crate::capture::screenshot::capture_fullscreen()
}

/// Capture a specific rectangular area of the primary monitor.
#[tauri::command]
pub fn capture_area_cmd(x: i32, y: i32, width: u32, height: u32) -> SnapzyResult<String> {
    crate::capture::screenshot::capture_area(x, y, width, height)
}

/// Capture a window by its title string.
#[tauri::command]
pub fn capture_window_cmd(title: String) -> SnapzyResult<String> {
    // Look up the window by title and capture it.
    let windows = crate::capture::screenshot::list_windows()?;
    let target = windows
        .into_iter()
        .find(|w| w.title.to_lowercase().contains(&title.to_lowercase()))
        .ok_or_else(|| SnapzyError::NotFound(format!("No window matching '{title}' found")))?;

    crate::capture::screenshot::capture_window(target.id)
}

/// List all available monitors.
#[tauri::command]
pub fn list_monitors_cmd() -> SnapzyResult<Vec<crate::MonitorInfo>> {
    crate::capture::screenshot::list_monitors()
}

/// List all available windows.
#[tauri::command]
pub fn list_windows_cmd() -> SnapzyResult<Vec<crate::WindowInfo>> {
    crate::capture::screenshot::list_windows()
}

/// Start a scrolling capture session.
#[tauri::command]
pub fn start_scroll_capture_cmd(
    state: tauri::State<'_, std::sync::Mutex<Option<crate::ScrollCaptureState>>>,
    width: u32,
    height: u32,
    overlap_percent: f64,
) -> SnapzyResult<()> {
    crate::capture::scrolling::start_scrolling_capture(state, width, height, overlap_percent)
}

/// Capture a scroll frame during an active scrolling capture session.
#[tauri::command]
pub fn capture_scroll_frame_cmd(
    state: tauri::State<'_, std::sync::Mutex<Option<crate::ScrollCaptureState>>>,
    raw_png: String,
) -> SnapzyResult<u32> {
    crate::capture::scrolling::capture_scroll_frame(state, raw_png)
}

/// Finish the scrolling capture session and return the stitched result.
#[tauri::command]
pub fn finish_scroll_capture_cmd(
    state: tauri::State<'_, std::sync::Mutex<Option<crate::ScrollCaptureState>>>,
) -> SnapzyResult<String> {
    crate::capture::scrolling::finish_scrolling_capture(state)
}

/// Capture the UI element at the given screen coordinates.
#[tauri::command]
pub fn capture_element_cmd(x: i32, y: i32) -> SnapzyResult<String> {
    crate::capture::element::capture_element(x, y)
}
