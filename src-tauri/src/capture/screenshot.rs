use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use image::{ImageEncoder, codecs::png::PngEncoder};
use std::io::Cursor;

use crate::SnapzyError;
use crate::{MonitorInfo, SnapzyResult, WindowInfo};

/// Capture the entire primary monitor.
#[tauri::command]
pub fn capture_fullscreen() -> SnapzyResult<String> {
    let monitors = xcap::Monitor::all().map_err(|e| {
        SnapzyError::CaptureError(format!("Failed to enumerate monitors: {e}"))
    })?;

    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .or_else(|| {
            // If no primary found, fall back to the first monitor.
            xcap::Monitor::all()
                .ok()
                .and_then(|mut list| if list.is_empty() { None } else { Some(list.remove(0)) })
        })
        .ok_or_else(|| SnapzyError::CaptureError("No monitors found".into()))?;

    let image = primary.capture_image().map_err(|e| {
        SnapzyError::CaptureError(format!("Failed to capture monitor: {e}"))
    })?;

    encode_image_to_base64(&image)
}

/// Capture a specific rectangular area of the primary monitor.
#[tauri::command]
pub fn capture_area(x: i32, y: i32, width: u32, height: u32) -> SnapzyResult<String> {
    if width == 0 || height == 0 {
        return Err(SnapzyError::CaptureError(
            "Width and height must be greater than zero".into(),
        ));
    }

    let full = capture_fullscreen_raw()?;
    let cropped = full.crop_imm(x as u32, y as u32, width, height);
    encode_image_to_base64(&cropped)
}

/// Capture a specific window by its window ID (platform-specific).
///
/// On Windows and macOS, xcap can enumerate and capture windows natively.
/// On Linux, window capture via xcap may be limited.
#[tauri::command]
pub fn capture_window(window_id: u32) -> SnapzyResult<String> {
    let windows = list_windows_internal().map_err(|e| {
        SnapzyError::CaptureError(format!("Failed to enumerate windows: {e}"))
    })?;

    let target = windows
        .into_iter()
        .find(|w| w.id == window_id)
        .ok_or_else(|| SnapzyError::NotFound(format!("Window with ID {window_id} not found")))?;

    // Re-enumerate via xcap to get a capture handle.
    let xcap_windows = xcap::Window::all().map_err(|e| {
        SnapzyError::CaptureError(format!("Failed to enumerate windows for capture: {e}"))
    })?;

    let xcap_win = xcap_windows
        .into_iter()
        .find(|w| {
            w.title() == target.title && w.app_name() == target.app_name
        })
        .ok_or_else(|| {
            SnapzyError::CaptureError(format!(
                "Window '{title}' is not capturable (may be minimized or on unsupported platform)",
                title = target.title
            ))
        })?;

    let image = xcap_win.capture_image().map_err(|e| {
        SnapzyError::CaptureError(format!("Failed to capture window: {e}"))
    })?;

    encode_image_to_base64(&image)
}

/// Capture a specific monitor by its monitor ID (index).
#[tauri::command]
pub fn capture_monitor(monitor_id: u32) -> SnapzyResult<String> {
    let monitors = xcap::Monitor::all().map_err(|e| {
        SnapzyError::CaptureError(format!("Failed to enumerate monitors: {e}"))
    })?;

    let monitor = monitors
        .into_iter()
        .nth(monitor_id as usize)
        .ok_or_else(|| {
            SnapzyError::NotFound(format!("Monitor with ID {monitor_id} not found"))
        })?;

    let image = monitor.capture_image().map_err(|e| {
        SnapzyError::CaptureError(format!("Failed to capture monitor: {e}"))
    })?;

    encode_image_to_base64(&image)
}

/// List all available monitors.
#[tauri::command]
pub fn list_monitors() -> SnapzyResult<Vec<MonitorInfo>> {
    let monitors = xcap::Monitor::all().map_err(|e| {
        SnapzyError::CaptureError(format!("Failed to enumerate monitors: {e}"))
    })?;

    let result: Vec<MonitorInfo> = monitors
        .into_iter()
        .enumerate()
        .map(|(i, m)| MonitorInfo {
            id: i as u32,
            name: m.name().to_string(),
            x: m.x(),
            y: m.y(),
            width: m.width(),
            height: m.height(),
            is_primary: m.is_primary(),
            scale_factor: m.scale_factor(),
        })
        .collect();

    Ok(result)
}

/// List all available windows (does not include minimized or invisible windows on some platforms).
#[tauri::command]
pub fn list_windows() -> SnapzyResult<Vec<WindowInfo>> {
    list_windows_internal()
}

/// Internal: capture the primary monitor as a DynamicImage.
fn capture_fullscreen_raw() -> SnapzyResult<image::DynamicImage> {
    let monitors = xcap::Monitor::all().map_err(|e| {
        SnapzyError::CaptureError(format!("Failed to enumerate monitors: {e}"))
    })?;

    let monitor = if monitors.is_empty() {
        return Err(SnapzyError::CaptureError("No monitors found".into()));
    } else {
        // Prefer primary monitor, fall back to the first one.
        monitors
            .into_iter()
            .find(|m| m.is_primary())
            .unwrap_or_else(|| {
                // Safe: we already checked monitors is non-empty
                xcap::Monitor::all()
                    .ok()
                    .and_then(|mut list| if list.is_empty() { None } else { Some(list.remove(0)) })
                    .expect("Monitors disappeared during capture")
            })
    };

    let img = monitor.capture_image().map_err(|e| {
        SnapzyError::CaptureError(format!("Failed to capture: {e}"))
    })?;
    Ok(image::DynamicImage::ImageRgba8(img))
}

/// Internal: enumerate windows via xcap.
fn list_windows_internal() -> SnapzyResult<Vec<WindowInfo>> {
    let windows = xcap::Window::all().map_err(|e| {
        SnapzyError::CaptureError(format!("Failed to enumerate windows: {e}"))
    })?;

    let result: Vec<WindowInfo> = windows
        .into_iter()
        .filter(|w| {
            // Filter out windows that are too small or likely invisible.
            w.width() > 50 && w.height() > 50 && !w.is_minimized()
        })
        .enumerate()
        .map(|(i, w)| WindowInfo {
            id: i as u32,
            title: w.title().to_string(),
            app_name: w.app_name().to_string(),
            x: w.x(),
            y: w.y(),
            width: w.width(),
            height: w.height(),
            is_minimized: w.is_minimized(),
        })
        .collect();

    Ok(result)
}

/// Encode a DynamicImage (or RgbaImage reference) to a base64 PNG data URI.
fn encode_image_to_base64(img: &image::DynamicImage) -> SnapzyResult<String> {
    let mut buf = Cursor::new(Vec::new());
    PngEncoder::new(&mut buf)
        .write_image(
            img.as_bytes(),
            img.width(),
            img.height(),
            img.color().into(),
        )
        .map_err(|e| SnapzyError::EncodingError(format!("PNG encoding failed: {e}")))?;

    let encoded = BASE64.encode(buf.into_inner());
    Ok(format!("data:image/png;base64,{encoded}"))
}
