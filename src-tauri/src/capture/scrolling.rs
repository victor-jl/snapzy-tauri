use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use image::{DynamicImage, ImageEncoder, codecs::png::PngEncoder, imageops};
use std::io::Cursor;
use std::sync::Mutex;
use tauri::State;

use crate::{ScrollCaptureState, SnapzyError, SnapzyResult};

/// Start a new scrolling capture session.
/// Captures the initial frame at the given area.
#[tauri::command]
pub fn start_scrolling_capture(
    state: State<'_, Mutex<Option<ScrollCaptureState>>>,
    width: u32,
    height: u32,
    overlap_percent: f64,
) -> SnapzyResult<()> {
    let mut scroll_state = state.lock().map_err(|e| {
        SnapzyError::General(format!("Failed to acquire scroll state lock: {e}"))
    })?;

    if scroll_state.is_some() {
        return Err(SnapzyError::General(
            "A scrolling capture session is already active. Call finish_scrolling_capture first."
                .into(),
        ));
    }

    *scroll_state = Some(ScrollCaptureState {
        frames: Vec::new(),
        scroll_y: 0,
        total_height: height,
        width,
        overlap_percent: overlap_percent.clamp(0.0, 0.5),
    });

    log::info!(
        "Scrolling capture started: {}x{} with {:.0}% overlap",
        width,
        height,
        overlap_percent * 100.0
    );

    Ok(())
}

/// Capture a scroll frame. The frontend should call this after each scroll increment.
/// The `raw_png` parameter is a base64-encoded PNG data URI of the current viewport.
#[tauri::command]
pub fn capture_scroll_frame(
    state: State<'_, Mutex<Option<ScrollCaptureState>>>,
    raw_png: String,
) -> SnapzyResult<u32> {
    let mut scroll_state = state.lock().map_err(|e| {
        SnapzyError::General(format!("Failed to acquire scroll state lock: {e}"))
    })?;

    let cs = scroll_state.as_mut().ok_or_else(|| {
        SnapzyError::General("No active scrolling capture session. Call start_scrolling_capture first.".into())
    })?;

    // Decode base64 PNG data URI.
    let png_data = decode_base64_image(&raw_png)?;

    cs.frames.push(png_data);
    let frame_count = cs.frames.len() as u32;

    log::debug!("Scroll frame {frame_count} captured");

    Ok(frame_count)
}

/// Finish the scrolling capture session, stitch all frames together, and return a base64 PNG.
/// Clears the session state.
#[tauri::command]
pub fn finish_scrolling_capture(
    state: State<'_, Mutex<Option<ScrollCaptureState>>>,
) -> SnapzyResult<String> {
    let mut scroll_state = state.lock().map_err(|e| {
        SnapzyError::General(format!("Failed to acquire scroll state lock: {e}"))
    })?;

    let cs = scroll_state.take().ok_or_else(|| {
        SnapzyError::General(
            "No active scrolling capture session. Call start_scrolling_capture first.".into(),
        )
    })?;

    if cs.frames.is_empty() {
        return Err(SnapzyError::General(
            "No frames captured. Call capture_scroll_frame before finishing.".into(),
        ));
    }

    // Parse all frames into DynamicImages.
    let images: Vec<DynamicImage> = cs
        .frames
        .iter()
        .map(|data| {
            image::load_from_memory(data)
                .map_err(|e| SnapzyError::ImageError(format!("Failed to decode frame: {e}")))
        })
        .collect::<SnapzyResult<Vec<_>>>()?;

    let stitched = stitch_frames(&images, cs.width, cs.overlap_percent)?;

    // Encode to base64 PNG.
    let mut buf = Cursor::new(Vec::new());
    PngEncoder::new(&mut buf)
        .write_image(
            stitched.as_bytes(),
            stitched.width(),
            stitched.height(),
            stitched.color().into(),
        )
        .map_err(|e| SnapzyError::EncodingError(format!("PNG encoding failed: {e}")))?;

    let encoded = BASE64.encode(buf.into_inner());
    log::info!(
        "Scrolling capture finished: {} frames stitched to {}x{}",
        images.len(),
        stitched.width(),
        stitched.height()
    );

    Ok(format!("data:image/png;base64,{encoded}"))
}

/// Stitch multiple frames vertically, detecting and removing overlap.
fn stitch_frames(
    frames: &[DynamicImage],
    base_width: u32,
    overlap_percent: f64,
) -> SnapzyResult<DynamicImage> {
    if frames.is_empty() {
        return Err(SnapzyError::ImageError("No frames to stitch".into()));
    }

    // Determine output dimensions.
    let width = frames[0].width();
    // Resize all frames to consistent width if needed.
    let frames: Vec<DynamicImage> = if width != base_width {
        frames
            .iter()
            .map(|f| {
                let ratio = base_width as f64 / f.width() as f64;
                let new_h = (f.height() as f64 * ratio) as u32;
                imageops::resize(f, base_width, new_h, imageops::FilterType::Lanczos3)
            })
            .map(DynamicImage::ImageRgba8)
            .collect()
    } else {
        frames.to_vec()
    };

    let frame_width = frames[0].width();
    let frame_height = frames[0].height();

    // Calculate overlap in pixels.
    let overlap_px = (frame_height as f64 * overlap_percent) as u32;

    // Calculate total height of stitched result.
    let mut total_height: u32 = frame_height;
    for i in 1..frames.len() {
        let actual_overlap = if overlap_px > 0 && frame_height > overlap_px {
            // Detect actual overlap by comparing pixel rows.
            let detected = detect_vertical_overlap(&frames[i - 1], &frames[i], overlap_px * 2)?;
            detected.max(1) // At minimum 1px overlap to avoid zero.
        } else {
            0
        };
        total_height += frame_height.saturating_sub(actual_overlap);
    }

    // Create the stitched image.
    let mut stitched = DynamicImage::new_rgba8(frame_width, total_height);
    let mut y_offset: u32 = 0;

    for i in 0..frames.len() {
        imageops::overlay(&mut stitched, &frames[i], 0, y_offset as i64);

        if i < frames.len() - 1 {
            let next_overlap = if overlap_px > 0 && frame_height > overlap_px {
                detect_vertical_overlap(&frames[i], &frames[i + 1], overlap_px * 2)
                    .unwrap_or(overlap_px)
            } else {
                0
            };
            y_offset += frame_height.saturating_sub(next_overlap);
        }
    }

    Ok(stitched)
}

/// Detect the vertical overlap between two successive frames by comparing pixel rows.
///
/// Compares the bottom of `top_frame` against the top of `bottom_frame` row-by-row
/// (up to `max_search` rows) and finds the best match position.
fn detect_vertical_overlap(
    top_frame: &DynamicImage,
    bottom_frame: &DynamicImage,
    max_search: u32,
) -> SnapzyResult<u32> {
    let h_top = top_frame.height();
    let h_bottom = bottom_frame.height();
    let w = top_frame.width().min(bottom_frame.width());

    let search_limit = max_search.min(h_top).min(h_bottom);
    if search_limit < 2 {
        return Ok(1);
    }

    let mut best_offset: u32 = 0;
    let mut best_diff = u64::MAX;

    // Try each possible overlap amount.
    for offset in 1..search_limit {
        let row_diff = compare_rows(top_frame, h_top - offset, bottom_frame, 0, w);
        if row_diff < best_diff {
            best_diff = row_diff;
            best_offset = offset;

            // Early exit: very good match found.
            if best_diff < w as u64 * 15 {
                break;
            }
        }
    }

    Ok(best_offset)
}

/// Compare a single row from two images and return the sum of absolute differences.
fn compare_rows(
    img_a: &DynamicImage,
    row_a: u32,
    img_b: &DynamicImage,
    row_b: u32,
    width: u32,
) -> u64 {
    let mut diff: u64 = 0;
    for x in 0..width {
        let pa = img_a.get_pixel(x, row_a);
        let pb = img_b.get_pixel(x, row_b);
        diff += (pa[0] as i32 - pb[0] as i32).unsigned_abs() as u64;
        diff += (pa[1] as i32 - pb[1] as i32).unsigned_abs() as u64;
        diff += (pa[2] as i32 - pb[2] as i32).unsigned_abs() as u64;
    }
    diff
}

/// Decode a base64 data URI into raw PNG bytes.
fn decode_base64_image(data_uri: &str) -> SnapzyResult<Vec<u8>> {
    // Strip the data URI prefix if present.
    let base64_str = if let Some(stripped) = data_uri.strip_prefix("data:image/png;base64,") {
        stripped
    } else if let Some(idx) = data_uri.find(";base64,") {
        &data_uri[idx + 8..]
    } else {
        data_uri
    };

    BASE64
        .decode(base64_str)
        .map_err(|e| SnapzyError::EncodingError(format!("Failed to decode base64 frame: {e}")))
}
