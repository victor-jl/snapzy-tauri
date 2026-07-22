use crate::SnapzyResult;

/// Copy a base64-encoded PNG image to the system clipboard.
#[tauri::command]
pub fn copy_image_cmd(data: String) -> SnapzyResult<()> {
    crate::clipboard::copy_image_to_clipboard(data)
}

/// Copy plain text to the system clipboard.
#[tauri::command]
pub fn copy_text_cmd(text: String) -> SnapzyResult<()> {
    crate::clipboard::copy_text_to_clipboard(text)
}

/// Read plain text from the system clipboard.
#[tauri::command]
pub fn read_text_cmd() -> SnapzyResult<String> {
    crate::clipboard::read_text_from_clipboard()
}

/// Copy a file path to the clipboard.
#[tauri::command]
pub fn copy_file_cmd(path: String) -> SnapzyResult<()> {
    crate::clipboard::copy_file_to_clipboard(path)
}
