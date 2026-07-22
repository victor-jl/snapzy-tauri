use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use std::path::PathBuf;

use crate::{SnapzyError, SnapzyResult};

/// Copy a PNG image (as raw bytes or base64 data URI) to the clipboard.
///
/// The image is converted to the format expected by the platform:
/// - macOS: TIFF/PNG
/// - Windows: BMP/PNG
/// - Linux: PNG
#[tauri::command]
pub fn copy_image_to_clipboard(image_data: String) -> SnapzyResult<()> {
    let png_bytes = decode_image_data(&image_data)?;

    // Decode the PNG into a DynamicImage for format conversion.
    let img = image::load_from_memory(&png_bytes)
        .map_err(|e| SnapzyError::ImageError(format!("Failed to decode image: {e}")))?;

    // Use arboard to set the image on the clipboard.
    let mut clipboard = arboard::Clipboard::new().map_err(|e| {
        SnapzyError::ClipboardError(format!("Failed to open clipboard: {e}"))
    })?;

    // Convert the image to ImageData for arboard.
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    let image_data_owned: Vec<u8> = rgba.into_raw();

    let img_data = arboard::ImageData {
        width: width as usize,
        height: height as usize,
        bytes: std::borrow::Cow::Owned(image_data_owned),
    };

    clipboard.set_image(img_data).map_err(|e| {
        SnapzyError::ClipboardError(format!("Failed to set image on clipboard: {e}"))
    })?;

    log::info!("Image copied to clipboard ({}x{})", width, height);
    Ok(())
}

/// Copy plain text to the clipboard.
#[tauri::command]
pub fn copy_text_to_clipboard(text: String) -> SnapzyResult<()> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| {
        SnapzyError::ClipboardError(format!("Failed to open clipboard: {e}"))
    })?;

    clipboard.set_text(text).map_err(|e| {
        SnapzyError::ClipboardError(format!("Failed to set text on clipboard: {e}"))
    })?;

    Ok(())
}

/// Read plain text from the clipboard.
/// Returns an empty string if the clipboard does not contain text.
#[tauri::command]
pub fn read_text_from_clipboard() -> SnapzyResult<String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| {
        SnapzyError::ClipboardError(format!("Failed to open clipboard: {e}"))
    })?;

    clipboard.get_text().map_err(|e| {
        SnapzyError::ClipboardError(format!("Failed to read text from clipboard: {e}"))
    })
}

/// Copy a file to the clipboard by its path.
///
/// On Windows: copies the file path as text.
/// On macOS: uses AppleScript/NSFilePromisePboardType emulation via text path.
/// On Linux: copies the file URI.
#[tauri::command]
pub fn copy_file_to_clipboard(path: String) -> SnapzyResult<()> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(SnapzyError::NotFound(format!(
            "File not found: {path}"
        )));
    }

    let canonical = file_path
        .canonicalize()
        .unwrap_or(file_path)
        .to_string_lossy()
        .to_string();

    copy_text_to_clipboard(canonical)?;

    log::info!("File path copied to clipboard: {path}");
    Ok(())
}

/// Decode image data from either raw base64 or a data URI.
fn decode_image_data(data: &str) -> SnapzyResult<Vec<u8>> {
    if data.starts_with("data:image/png;base64,") {
        let b64 = &data["data:image/png;base64,".len()..];
        BASE64
            .decode(b64)
            .map_err(|e| SnapzyError::EncodingError(format!("Failed to decode base64: {e}")))
    } else if data.starts_with("data:image/") {
        // Generic data URI handler.
        if let Some(idx) = data.find(";base64,") {
            let b64 = &data[idx + 8..];
            BASE64
                .decode(b64)
                .map_err(|e| SnapzyError::EncodingError(format!("Failed to decode base64: {e}")))
        } else {
            Err(SnapzyError::EncodingError(
                "Unknown data URI format".into(),
            ))
        }
    } else {
        // Try as raw base64.
        BASE64
            .decode(data)
            .map_err(|e| SnapzyError::EncodingError(format!("Failed to decode base64: {e}")))
    }
}
