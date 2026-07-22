use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use std::io::Write;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use std::io::Cursor;
use image::{ImageEncoder, codecs::png::PngEncoder};

use crate::binary_resolver::{self, ExternalBinary};
use crate::{OcrBlock, OcrResult, SnapzyError, SnapzyResult};

/// Recognize text from an image using Tesseract OCR.
///
/// The image is provided as a base64-encoded PNG data URI (or raw base64).
/// `languages` specifies the language codes (e.g., ["eng"], ["chi_sim+eng"]).
///
/// Tesseract is bundled as a sidecar binary. The `tessdata/` language data
/// is resolved relative to the binary or via the `TESSDATA_PREFIX` env var.
#[tauri::command]
pub fn recognize_text(image_data: String, languages: Option<Vec<String>>) -> SnapzyResult<OcrResult> {
    let png_bytes = decode_base64_image(&image_data)?;

    let langs = languages
        .unwrap_or_else(|| vec!["eng".to_string()])
        .join("+");

    // Resolve the tesseract binary path (bundled sidecar first, then system PATH).
    let tesseract_path = binary_resolver::resolve_binary_path(ExternalBinary::Tesseract)
        .ok_or_else(|| SnapzyError::OcrError(
            "Tesseract OCR is not installed. \
             Run `npm run download-binaries` to download it, \
             or install it from https://github.com/tesseract-ocr/tesseract".into(),
        ))?;

    // Resolve tessdata directory for language files.
    let tessdata = binary_resolver::tessdata_dir();

    // Decode the PNG and re-encode to ensure clean PNG format for tesseract.
    let decoded = image::load_from_memory(&png_bytes)
        .map_err(|e| SnapzyError::ImageError(format!("Failed to decode image: {e}")))?;

    let mut png_buf = Cursor::new(Vec::new());
    PngEncoder::new(&mut png_buf)
        .write_image(
            decoded.as_bytes(),
            decoded.width(),
            decoded.height(),
            decoded.color().into(),
        )
        .map_err(|e| SnapzyError::EncodingError(format!("PNG re-encoding failed: {e}")))?;

    let png_vec = png_buf.into_inner();

    // Write to a temp file in the system temp directory.
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros();

    let temp_dir = std::env::temp_dir();
    let input_path = temp_dir.join(format!("snapzy_ocr_in_{timestamp}.png"));
    let output_base = temp_dir.join(format!("snapzy_ocr_out_{timestamp}"));

    // Write the PNG file.
    let mut file = std::fs::File::create(&input_path).map_err(|e| {
        SnapzyError::OcrError(format!("Failed to create temp input file: {e}"))
    })?;

    file.write_all(&png_vec).map_err(|e| {
        SnapzyError::OcrError(format!("Failed to write temp input file: {e}"))
    })?;

    drop(file);

    // Build the tesseract command.
    let mut cmd = Command::new(&tesseract_path);
    cmd.arg(&input_path)
        .arg(output_base.with_extension(""))
        .arg("-l")
        .arg(&langs)
        .arg("--psm")
        .arg("3"); // Fully automatic page segmentation.

    // Set TESSDATA_PREFIX if we found a bundled tessdata directory.
    if let Some(ref td) = tessdata {
        cmd.env("TESSDATA_PREFIX", td);
    }

    let output = cmd.output().map_err(|e| {
        SnapzyError::OcrError(format!("Failed to run tesseract ({}): {e}", tesseract_path.display()))
    })?;

    let stderr_str = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        // Clean up input file on failure.
        let _ = std::fs::remove_file(&input_path);
        return Err(SnapzyError::OcrError(format!(
            "Tesseract failed: {stderr_str}"
        )));
    }

    // Read the text output.
    let text_path = output_base.with_extension("txt");
    let text = std::fs::read_to_string(&text_path)
        .map_err(|e| {
            SnapzyError::OcrError(format!(
                "Failed to read tesseract output: {e}. stderr: {stderr_str}"
            ))
        })?;

    // Parse bounding boxes from TSV output if available.
    let blocks = parse_tsv_output(&output_base)?;

    // Clean up temp files.
    let _ = std::fs::remove_file(&input_path);
    let _ = std::fs::remove_file(&text_path);
    let _ = std::fs::remove_file(output_base.with_extension("tsv"));
    let _ = std::fs::remove_file(output_base.with_extension("osd"));

    let confidence = if blocks.is_empty() {
        0.0
    } else {
        blocks.iter().map(|b| b.confidence as f64).sum::<f64>() / blocks.len() as f64
    };

    let result = OcrResult {
        text: text.trim().to_string(),
        confidence: confidence as f32,
        blocks,
    };

    log::info!(
        "OCR completed: {} characters, {:.1}% confidence",
        result.text.len(),
        result.confidence
    );

    Ok(result)
}

/// Parse the TSV (tab-separated values) output from tesseract for bounding box info.
///
/// Tesseract writes both .txt and .tsv files by default when given an output base name.
fn parse_tsv_output(output_base: &std::path::Path) -> SnapzyResult<Vec<OcrBlock>> {
    let tsv_path = output_base.with_extension("tsv");

    let tsv_content = match std::fs::read_to_string(&tsv_path) {
        Ok(content) => content,
        Err(_) => {
            // TSV not available; return empty blocks.
            return Ok(Vec::new());
        }
    };

    let mut blocks: Vec<OcrBlock> = Vec::new();

    for (i, line) in tsv_content.lines().enumerate() {
        // Skip header line.
        if i == 0 {
            continue;
        }

        let fields: Vec<&str> = line.split('\t').collect();
        if fields.len() < 12 {
            continue;
        }

        // TSV format: level, page_num, block_num, par_num, line_num, word_num,
        // left, top, width, height, conf, text
        let level: i32 = fields[0].parse().unwrap_or(0);
        let text = fields[11].trim().to_string();

        // Skip empty entries and non-word level entries (level 5 = word).
        if text.is_empty() || level < 3 {
            continue;
        }

        let left: i32 = fields[6].parse().unwrap_or(0);
        let top: i32 = fields[7].parse().unwrap_or(0);
        let width: i32 = fields[8].parse().unwrap_or(0);
        let height: i32 = fields[9].parse().unwrap_or(0);
        let conf: f32 = fields[10].parse().unwrap_or(0.0);

        // Try to merge with the previous block if they're on the same row.
        if let Some(last) = blocks.last_mut() {
            if last.y == top && last.height == height {
                // Same row: extend width and append text.
                last.text.push(' ');
                last.text.push_str(&text);
                last.width = (left + width) - last.x;
                last.confidence = (last.confidence + conf) / 2.0;
                continue;
            }
        }

        blocks.push(OcrBlock {
            text,
            confidence: conf,
            x: left,
            y: top,
            width,
            height,
        });
    }

    Ok(blocks)
}

/// Decode base64 image data (supports data URIs and raw base64).
fn decode_base64_image(data: &str) -> SnapzyResult<Vec<u8>> {
    if let Some(stripped) = data.strip_prefix("data:image/png;base64,") {
        BASE64
            .decode(stripped)
            .map_err(|e| SnapzyError::EncodingError(format!("Failed to decode base64: {e}")))
    } else if let Some(idx) = data.find(";base64,") {
        let b64 = &data[idx + 8..];
        BASE64
            .decode(b64)
            .map_err(|e| SnapzyError::EncodingError(format!("Failed to decode base64: {e}")))
    } else {
        BASE64
            .decode(data)
            .map_err(|e| SnapzyError::EncodingError(format!("Failed to decode base64: {e}")))
    }
}
