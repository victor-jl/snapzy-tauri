use crate::{OcrResult, SnapzyResult};

/// Recognize text from a base64-encoded image using Tesseract OCR.
///
/// `image_data` - Base64-encoded PNG image (or data URI).
/// `languages` - Optional list of language codes (e.g. ["eng"] or ["chi_sim+eng"]).
#[tauri::command]
pub fn recognize_text_cmd(
    image_data: String,
    languages: Option<Vec<String>>,
) -> SnapzyResult<OcrResult> {
    crate::ocr::recognize_text(image_data, languages)
}
