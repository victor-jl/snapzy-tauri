use image::{
    DynamicImage, Frame, ImageBuffer, Rgba, RgbaImage,
    codecs::gif::{GifEncoder, Repeat},
};
use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{SnapzyError, SnapzyResult};

/// Configuration for GIF encoding.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct GifEncodeOptions {
    /// GIF quality (1-100). Lower = smaller file, more color reduction.
    #[serde(default = "default_quality")]
    pub quality: u8,
    /// Enable Floyd-Steinberg dithering for smoother gradients.
    #[serde(default = "default_dither")]
    pub dither: bool,
    /// Maximum number of colors in the palette.
    #[serde(default = "default_max_colors")]
    pub max_colors: u16,
}

fn default_quality() -> u8 {
    80
}
fn default_dither() -> bool {
    true
}
fn default_max_colors() -> u16 {
    256
}

/// Encode a sequence of PNG frame bytes into an animated GIF and save to disk.
///
/// `frames` - Vector of raw PNG bytes (one per frame).
/// `fps` - Frames per second for timing.
/// `width` / `height` - Output GIF dimensions. Frames are resized to this if needed.
/// `options` - Quality/dithering/palette settings.
///
/// Returns the file path to the generated GIF.
#[tauri::command]
pub fn encode_gif(
    frames: Vec<Vec<u8>>,
    fps: u32,
    width: u32,
    height: u32,
    options: Option<GifEncodeOptions>,
) -> SnapzyResult<String> {
    if frames.is_empty() {
        return Err(SnapzyError::EncodingError(
            "No frames provided for GIF encoding".into(),
        ));
    }

    let opts = options.unwrap_or(GifEncodeOptions {
        quality: 80,
        dither: true,
        max_colors: 256,
    });

    let frame_delay = calculate_frame_delay(fps);
    let max_colors = opts.max_colors.min(256);

    // Decode all frames.
    let decoded: Vec<DynamicImage> = frames
        .iter()
        .map(|raw| {
            image::load_from_memory(raw)
                .map_err(|e| SnapzyError::EncodingError(format!("Failed to decode frame: {e}")))
        })
        .collect::<SnapzyResult<Vec<_>>>()?;

    // Resize frames to target dimensions if needed.
    let frames: Vec<DynamicImage> = decoded
        .into_iter()
        .map(|f| {
            if f.width() == width && f.height() == height {
                f
            } else {
                f.resize_exact(
                    width,
                    height,
                    image::imageops::FilterType::Lanczos3,
                )
            }
        })
        .collect();

    // Build an optimized color palette from all frames (sampling).
    let palette = build_color_palette(&frames, max_colors as usize);

    // Generate the output path.
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let output_path = output_gif_path(timestamp);

    let file = File::create(&output_path)?;
    let writer = BufWriter::new(file);
    let mut encoder = GifEncoder::new_with_speed(writer, 10); // speed = 10 (1=best, 30=fastest)
    encoder
        .set_repeat(Repeat::Infinite)
        .map_err(|e| SnapzyError::EncodingError(format!("GIF encoder error: {e}")))?;

    for frame in &frames {
        let rgba = frame.to_rgba8();
        let quantized = quantize_frame(&rgba, &palette, opts.dither);

        let mut gif_frame = Frame::new(quantized);
        gif_frame.delay = image::Delay::from_saturating_duration(
            std::time::Duration::from_millis(frame_delay),
        );

        encoder
            .encode_frame(gif_frame)
            .map_err(|e| SnapzyError::EncodingError(format!("GIF frame encode error: {e}")))?;
    }

    // Drop encoder to flush.
    drop(encoder);

    let path_str = output_path.to_string_lossy().to_string();
    log::info!(
        "GIF encoded: {} frames at {} fps -> {} ({}x{})",
        frames.len(),
        fps,
        path_str,
        width,
        height,
    );

    Ok(path_str)
}

/// Calculate per-frame delay in milliseconds from FPS.
fn calculate_frame_delay(fps: u32) -> u64 {
    if fps == 0 {
        100 // Default to 10 fps.
    } else {
        (1000.0 / fps as f64).round() as u64
    }
}

/// Build an optimized color palette from a collection of frames.
///
/// Samples pixels across all frames and selects the most representative colors
/// using a median-cut-like approach via the image crate's quantization.
fn build_color_palette(frames: &[DynamicImage], max_colors: usize) -> Vec<[u8; 3]> {
    use std::collections::HashMap;

    // Sample colors: take every Nth pixel from every Kth frame.
    let frame_step = 1.max(frames.len() / 20);
    let pixel_step = 4u32;

    let mut color_counts: HashMap<(u8, u8, u8), u32> = HashMap::new();

    for (fi, frame) in frames.iter().enumerate() {
        if fi % frame_step != 0 {
            continue;
        }
        let rgba = frame.to_rgba8();
        for y in (0..rgba.height()).step_by(pixel_step as usize) {
            for x in (0..rgba.width()).step_by(pixel_step as usize) {
                let p = rgba.get_pixel(x, y);
                if p[3] < 128 {
                    continue; // Skip transparent pixels.
                }
                // Reduce color depth for counting.
                let bucket = ((p[0] >> 3) << 5, (p[1] >> 3) << 5, (p[2] >> 3) << 5);
                *color_counts.entry(bucket).or_insert(0) += 1;
            }
        }
    }

    // Sort by frequency and take top N.
    let mut entries: Vec<_> = color_counts.into_iter().collect();
    entries.sort_by(|a, b| b.1.cmp(&a.1));

    let result: Vec<[u8; 3]> = entries
        .into_iter()
        .take(max_colors)
        .map(|((r, g, b), _)| [r, g, b])
        .collect();

    // Ensure we always include pure black and white.
    let has_black = result.iter().any(|c| c[0] == 0 && c[1] == 0 && c[2] == 0);
    let has_white = result.iter().any(|c| c[0] == 255 && c[1] == 255 && c[2] == 255);

    let mut final_palette = result;
    if !has_black && final_palette.len() < max_colors {
        final_palette.push([0, 0, 0]);
    }
    if !has_white && final_palette.len() < max_colors {
        final_palette.push([255, 255, 255]);
    }

    final_palette
}

/// Quantize an RGBA image to a paletted image using the given palette.
///
/// Optionally applies Floyd-Steinberg dithering.
fn quantize_frame(
    rgba: &RgbaImage,
    palette: &[[u8; 3]],
    dither: bool,
) -> ImageBuffer<Rgba<u8>, Vec<u8>> {
    let (w, h) = rgba.dimensions();
    let mut output = RgbaImage::new(w, h);

    if dither {
        // Floyd-Steinberg dithering.
        let mut errors: Vec<Vec<[f64; 3]>> = vec![vec![[0.0; 3]; w as usize + 2]; h as usize + 2];

        for y in 0..h {
            for x in 0..w {
                let p = rgba.get_pixel(x, y);
                let er = errors[y as usize][x as usize];

                let mut r = (p[0] as f64 + er[0]).clamp(0.0, 255.0);
                let mut g = (p[1] as f64 + er[1]).clamp(0.0, 255.0);
                let mut b = (p[2] as f64 + er[2]).clamp(0.0, 255.0);

                let nearest = nearest_color(&palette, r as u8, g as u8, b as u8);
                let qr = nearest[0] as f64;
                let qg = nearest[1] as f64;
                let qb = nearest[2] as f64;

                let err_r = r - qr;
                let err_g = g - qg;
                let err_b = b - qb;

                output.put_pixel(
                    x,
                    y,
                    Rgba([nearest[0], nearest[1], nearest[2], p[3]]),
                );

                let xu = x as usize;
                let yu = y as usize;

                errors[yu][xu + 1][0] += err_r * 7.0 / 16.0;
                errors[yu][xu + 1][1] += err_g * 7.0 / 16.0;
                errors[yu][xu + 1][2] += err_b * 7.0 / 16.0;

                if yu + 1 < h as usize {
                    if xu > 0 {
                        errors[yu + 1][xu - 1][0] += err_r * 3.0 / 16.0;
                        errors[yu + 1][xu - 1][1] += err_g * 3.0 / 16.0;
                        errors[yu + 1][xu - 1][2] += err_b * 3.0 / 16.0;
                    }
                    errors[yu + 1][xu][0] += err_r * 5.0 / 16.0;
                    errors[yu + 1][xu][1] += err_g * 5.0 / 16.0;
                    errors[yu + 1][xu][2] += err_b * 5.0 / 16.0;

                    errors[yu + 1][xu + 1][0] += err_r * 1.0 / 16.0;
                    errors[yu + 1][xu + 1][1] += err_g * 1.0 / 16.0;
                    errors[yu + 1][xu + 1][2] += err_b * 1.0 / 16.0;
                }
            }
        }
    } else {
        // Nearest-neighbor without dithering.
        for y in 0..h {
            for x in 0..w {
                let p = rgba.get_pixel(x, y);
                let nearest = nearest_color(palette, p[0], p[1], p[2]);
                output.put_pixel(x, y, Rgba([nearest[0], nearest[1], nearest[2], p[3]]));
            }
        }
    }

    output
}

/// Find the nearest color in the palette to (r, g, b) using Euclidean distance.
fn nearest_color(palette: &[[u8; 3]], r: u8, g: u8, b: u8) -> [u8; 3] {
    if palette.is_empty() {
        return [r, g, b];
    }

    let mut best = palette[0];
    let mut best_dist = u32::MAX;

    for &color in palette {
        let dr = r as i32 - color[0] as i32;
        let dg = g as i32 - color[1] as i32;
        let db = b as i32 - color[2] as i32;
        let dist = (dr * dr + dg * dg + db * db) as u32;
        if dist < best_dist {
            best_dist = dist;
            best = color;
        }
    }

    best
}

/// Generate an output path for the GIF.
fn output_gif_path(timestamp: u128) -> PathBuf {
    let dir = if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join("Desktop")
    } else if let Ok(profile) = std::env::var("USERPROFILE") {
        PathBuf::from(profile).join("Desktop")
    } else {
        PathBuf::from(".")
    };
    dir.join(format!("snapzy_gif_{timestamp}.gif"))
}
