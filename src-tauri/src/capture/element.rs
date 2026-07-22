use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use image::{DynamicImage, GenericImageView, ImageEncoder, codecs::png::PngEncoder};
use std::io::Cursor;

use crate::{SnapzyError, SnapzyResult};

/// Detect the UI element at the given screen coordinates and capture it.
///
/// This function performs a fullscreen capture, then analyzes the area around `(x, y)`
/// to detect the rectangular bounds of the UI element (e.g., a button, dialog, or
/// panel) and returns the cropped element as a base64-encoded PNG.
#[tauri::command]
pub fn capture_element(x: i32, y: i32) -> SnapzyResult<String> {
    // Capture the full primary monitor.
    let full = capture_fullscreen_for_element()?;

    // Detect the element bounds around (x, y).
    let (ex, ey, ew, eh) = detect_element_bounds(&full, x as u32, y as u32)?;

    if ew < 4 || eh < 4 {
        return Err(SnapzyError::CaptureError(format!(
            "No detectable element at ({x}, {y}); found region too small ({ew}x{eh})"
        )));
    }

    let cropped = full.crop_imm(ex, ey, ew, eh);

    // Encode to base64 PNG.
    let mut buf = Cursor::new(Vec::new());
    PngEncoder::new(&mut buf)
        .write_image(
            cropped.as_bytes(),
            cropped.width(),
            cropped.height(),
            cropped.color().into(),
        )
        .map_err(|e| SnapzyError::EncodingError(format!("PNG encoding failed: {e}")))?;

    let encoded = BASE64.encode(buf.into_inner());
    Ok(format!("data:image/png;base64,{encoded}"))
}

/// Capture the full primary monitor for element detection purposes.
fn capture_fullscreen_for_element() -> SnapzyResult<DynamicImage> {
    let monitors = xcap::Monitor::all().map_err(|e| {
        SnapzyError::CaptureError(format!("Failed to enumerate monitors: {e}"))
    })?;

    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .or_else(|| {
            xcap::Monitor::all()
                .ok()
                .and_then(|mut list| if list.is_empty() { None } else { Some(list.remove(0)) })
        })
        .ok_or_else(|| SnapzyError::CaptureError("No monitors found".into()))?;

    let img = primary.capture_image().map_err(|e| {
        SnapzyError::CaptureError(format!("Failed to capture: {e}"))
    })?;

    Ok(DynamicImage::ImageRgba8(img))
}

/// Detect the bounding box of the UI element containing the point (px, py).
///
/// Uses edge-detection based region growing: expands outward from the click point
/// in all four directions until a significant color/brightness edge is detected.
fn detect_element_bounds(
    img: &DynamicImage,
    px: u32,
    py: u32,
) -> SnapzyResult<(u32, u32, u32, u32)> {
    let (img_w, img_h) = (img.width(), img.height());

    if px >= img_w || py >= img_h {
        return Err(SnapzyError::CaptureError(format!(
            "Point ({px}, {py}) is outside image bounds ({img_w}x{img_h})"
        )));
    }

    // Sample the color at the click point as a reference.
    let ref_color = img.get_pixel(px, py);
    let sample_radius: u32 = 3;

    // Compute an average background color around the click point.
    let mut avg_r = 0u32;
    let mut avg_g = 0u32;
    let mut avg_b = 0u32;
    let mut count = 0u32;
    for dy in -(sample_radius as i32)..=(sample_radius as i32) {
        for dx in -(sample_radius as i32)..=(sample_radius as i32) {
            let sx = px as i32 + dx;
            let sy = py as i32 + dy;
            if sx >= 0 && sy >= 0 && (sx as u32) < img_w && (sy as u32) < img_h {
                let c = img.get_pixel(sx as u32, sy as u32);
                avg_r += c[0] as u32;
                avg_g += c[1] as u32;
                avg_b += c[2] as u32;
                count += 1;
            }
        }
    }
    if count == 0 {
        return Err(SnapzyError::CaptureError(
            "Could not sample pixels around point".into(),
        ));
    }
    avg_r /= count;
    avg_g /= count;
    avg_b /= count;

    let edge_threshold: u32 = 45;
    let max_expand: u32 = 2000;

    // Expand left.
    let mut left = px;
    while left > 0 && (px - left) < max_expand {
        let edge = is_edge_at(img, left - 1, py, img_w, img_h, avg_r, avg_g, avg_b, edge_threshold);
        if edge {
            break;
        }
        // Also check a few rows above/below to handle rounded corners.
        if py > 0 {
            let edge_above =
                is_edge_at(img, left - 1, py - 1, img_w, img_h, avg_r, avg_g, avg_b, edge_threshold);
            if edge_above {
                break;
            }
        }
        if py + 1 < img_h {
            let edge_below =
                is_edge_at(img, left - 1, py + 1, img_w, img_h, avg_r, avg_g, avg_b, edge_threshold);
            if edge_below {
                break;
            }
        }
        left -= 1;
    }

    // Expand right.
    let mut right = px;
    while right + 1 < img_w && (right - px) < max_expand {
        let edge =
            is_edge_at(img, right + 1, py, img_w, img_h, avg_r, avg_g, avg_b, edge_threshold);
        if edge {
            break;
        }
        if py > 0 {
            let edge_above = is_edge_at(
                img,
                right + 1,
                py - 1,
                img_w,
                img_h,
                avg_r,
                avg_g,
                avg_b,
                edge_threshold,
            );
            if edge_above {
                break;
            }
        }
        if py + 1 < img_h {
            let edge_below = is_edge_at(
                img,
                right + 1,
                py + 1,
                img_w,
                img_h,
                avg_r,
                avg_g,
                avg_b,
                edge_threshold,
            );
            if edge_below {
                break;
            }
        }
        right += 1;
    }

    // Expand top.
    let mut top = py;
    while top > 0 && (py - top) < max_expand {
        let edge =
            is_edge_at(img, px, top - 1, img_w, img_h, avg_r, avg_g, avg_b, edge_threshold);
        if edge {
            break;
        }
        if px > 0 {
            let edge_left = is_edge_at(
                img,
                px - 1,
                top - 1,
                img_w,
                img_h,
                avg_r,
                avg_g,
                avg_b,
                edge_threshold,
            );
            if edge_left {
                break;
            }
        }
        if px + 1 < img_w {
            let edge_right = is_edge_at(
                img,
                px + 1,
                top - 1,
                img_w,
                img_h,
                avg_r,
                avg_g,
                avg_b,
                edge_threshold,
            );
            if edge_right {
                break;
            }
        }
        top -= 1;
    }

    // Expand bottom.
    let mut bottom = py;
    while bottom + 1 < img_h && (bottom - py) < max_expand {
        let edge = is_edge_at(
            img,
            px,
            bottom + 1,
            img_w,
            img_h,
            avg_r,
            avg_g,
            avg_b,
            edge_threshold,
        );
        if edge {
            break;
        }
        if px > 0 {
            let edge_left = is_edge_at(
                img,
                px - 1,
                bottom + 1,
                img_w,
                img_h,
                avg_r,
                avg_g,
                avg_b,
                edge_threshold,
            );
            if edge_left {
                break;
            }
        }
        if px + 1 < img_w {
            let edge_right = is_edge_at(
                img,
                px + 1,
                bottom + 1,
                img_w,
                img_h,
                avg_r,
                avg_g,
                avg_b,
                edge_threshold,
            );
            if edge_right {
                break;
            }
        }
        bottom += 1;
    }

    let w = right - left + 1;
    let h = bottom - top + 1;

    Ok((left, top, w, h))
}

/// Check whether a pixel at (x, y) represents an edge relative to the reference color.
fn is_edge_at(
    img: &DynamicImage,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
    ref_r: u32,
    ref_g: u32,
    ref_b: u32,
    threshold: u32,
) -> bool {
    if x >= w || y >= h {
        return true;
    }
    let pixel = img.get_pixel(x, y);
    let dr = (pixel[0] as i32 - ref_r as i32).unsigned_abs();
    let dg = (pixel[1] as i32 - ref_g as i32).unsigned_abs();
    let db = (pixel[2] as i32 - ref_b as i32).unsigned_abs();
    (dr + dg + db) / 3 > threshold
}
