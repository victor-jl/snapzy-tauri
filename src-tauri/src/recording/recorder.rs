use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::binary_resolver::{self, ExternalBinary};
use crate::{CaptureArea, RecordingOptions, RecordingState, SnapzyError, SnapzyResult};

/// Maximum time to wait for FFmpeg to gracefully shut down.
const FFMPEG_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(5);

/// Start a screen recording session using FFmpeg.
///
/// FFmpeg is bundled as a sidecar binary. The platform-specific input device
/// and codec configuration is handled automatically.
///
/// Spawns an FFmpeg process that captures the screen (and optionally audio) to a file.
#[tauri::command]
pub fn start_recording(
    state: State<'_, Mutex<RecordingState>>,
    options: RecordingOptions,
) -> SnapzyResult<String> {
    let mut rec_state = state.lock().map_err(|e| {
        SnapzyError::RecordingError(format!("Failed to acquire recording state lock: {e}"))
    })?;

    if rec_state.active {
        return Err(SnapzyError::RecordingError(
            "A recording is already in progress. Call stop_recording first.".into(),
        ));
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let output_path = options.output_path.clone().unwrap_or_else(|| {
        let ext = if options.format == "webm" { "webm" } else { "mp4" };
        let home = dirs_fallback();
        format!(
            "{home}/snapzy_recording_{timestamp}.{ext}",
            home = home.to_string_lossy()
        )
    });

    // Build the platform-specific FFmpeg command using the bundled binary.
    let mut cmd = build_ffmpeg_command(&options, &output_path)?;

    let child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            SnapzyError::RecordingError(format!(
                "Failed to start FFmpeg. Is FFmpeg bundled? Run `npm run download-binaries`. Error: {e}"
            ))
        })?;

    rec_state.active = true;
    rec_state.output_path = Some(output_path.clone());
    rec_state.ffmpeg_process = Some(child);
    rec_state.area = options.area.clone();
    rec_state.fps = options.fps;

    log::info!(
        "Recording started: {} ({} fps, format: {})",
        output_path,
        options.fps,
        options.format
    );

    Ok(output_path)
}

/// Stop the ongoing screen recording and return the output file path.
#[tauri::command]
pub fn stop_recording(
    state: State<'_, Mutex<RecordingState>>,
) -> SnapzyResult<String> {
    let mut rec_state = state.lock().map_err(|e| {
        SnapzyError::RecordingError(format!("Failed to acquire recording state lock: {e}"))
    })?;

    if !rec_state.active {
        return Err(SnapzyError::RecordingError(
            "No recording is currently active.".into(),
        ));
    }

    // Send quit signal to FFmpeg. Drop stdin before waiting to signal EOF.
    if let Some(ref mut child) = rec_state.ffmpeg_process {
        // Send 'q' to stdin to gracefully stop FFmpeg.
        let mut stdin = child.stdin.take();
        if let Some(ref mut stdin) = stdin {
            let _ = stdin.write_all(b"q");
            let _ = stdin.flush();
        }
        // `stdin` is dropped here, closing the pipe — signals FFmpeg that input is done.

        // Wait for FFmpeg to exit, with a fallback timeout to prevent deadlock.
        fn wait_for_ffmpeg(child: &mut std::process::Child) {
            // Try up to 5 cycles, each ≤ 1 second real-time.
            for _ in 0..5 {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        if !status.success() {
                            log::warn!("FFmpeg exited with non-zero status: {status}");
                        }
                        return;
                    }
                    Ok(None) => {
                        // Still running — spin briefly.
                        std::thread::sleep(Duration::from_millis(1000));
                    }
                    Err(e) => {
                        log::error!("Error waiting for FFmpeg: {e}");
                        return;
                    }
                }
            }

            // Timeout reached — force kill.
            log::warn!(
                "FFmpeg did not exit within {:.0}s, force-killing",
                FFMPEG_SHUTDOWN_TIMEOUT.as_secs_f64()
            );
            if let Err(e) = child.kill() {
                log::error!("Failed to kill FFmpeg: {e}");
            }
            let _ = child.wait();
        }
        wait_for_ffmpeg(child);
    }

    let output_path = rec_state.output_path.clone().unwrap_or_default();

    rec_state.active = false;
    rec_state.output_path = None;
    rec_state.ffmpeg_process = None;
    rec_state.area = None;

    log::info!("Recording stopped: {output_path}");

    Ok(output_path)
}

/// Build the platform-specific FFmpeg command for screen capture.
///
/// - macOS: uses avfoundation to capture the screen (and optionally audio).
/// - Windows: uses gdigrab for screen capture, dshow for audio.
/// - Linux: uses x11grab for screen capture, pulse/alsa for audio.
///
/// Mouse click highlighting and keystroke overlays are handled at the frontend level;
/// this backend captures raw screen data only.
fn build_ffmpeg_command(
    options: &RecordingOptions,
    output_path: &str,
) -> SnapzyResult<Command> {
    // Resolve the bundled FFmpeg binary path.
    let ffmpeg_path = binary_resolver::resolve_binary_path(ExternalBinary::Ffmpeg)
        .ok_or_else(|| SnapzyError::RecordingError(
            "FFmpeg is not found. \
             Run `npm run download-binaries` to download it, \
             or install FFmpeg from https://ffmpeg.org".into(),
        ))?;

    let mut cmd = Command::new(&ffmpeg_path);

    // Overwrite output file without prompting.
    cmd.arg("-y");

    // Framerate (must come before -i for input devices that need it).
    cmd.args(["-framerate", &options.fps.to_string()]);

    // Platform-specific input devices and parameters.
    #[cfg(target_os = "macos")]
    {
        build_macos_command(&mut cmd, options);
    }
    #[cfg(target_os = "windows")]
    {
        build_windows_command(&mut cmd, options)?;
    }
    #[cfg(target_os = "linux")]
    {
        build_linux_command(&mut cmd, options)?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        return Err(SnapzyError::RecordingError(
            "Screen recording is not supported on this platform.".into(),
        ));
    }

    // Video codec.
    if options.format == "webm" {
        cmd.args(["-c:v", "libvpx-vp9", "-b:v", "2M"]);
    } else {
        cmd.args(["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p"]);
    }

    // Output path.
    cmd.arg(output_path);

    Ok(cmd)
}

#[cfg(target_os = "macos")]
fn build_macos_command(cmd: &mut Command, options: &RecordingOptions) {
    // macOS: use avfoundation for screen capture.
    // Dynamically determine which display index to capture based on the area coordinates.
    let display_index = determine_display_index(&options.area);
    let (x, y, w, h) = area_or_default(&options.area);

    cmd.args([
        "-f", "avfoundation",
        "-capture_cursor", "1",
        "-i", &format!("{display_index}:none"),
        "-video_size", &format!("{w}x{h}"),
    ]);

    // If capture area is specified, add a crop filter.
    if options.area.is_some() {
        cmd.args(["-filter:v", &format!("crop={w}:{h}:{x}:{y}")]);
    }

    // Handle audio: system audio requires BlackHole/Soundflower on macOS.
    if options.include_audio && !options.include_mic {
        cmd.args(["-f", "avfoundation", "-i", &format!("{display_index}:BlackHole 2ch")]);
    }
}

/// Determine the avfoundation display index based on the capture area.
/// Falls back to index 1 (primary display) if no area is specified or enumeration fails.
#[cfg(target_os = "macos")]
fn determine_display_index(area: &Option<crate::CaptureArea>) -> u32 {
    if let Some(ref area) = area {
        if let Ok(monitors) = xcap::Monitor::all() {
            for (i, m) in monitors.iter().enumerate() {
                // Match the monitor that contains the capture origin.
                if m.x() <= area.x
                    && m.y() <= area.y
                    && (m.x() + m.width() as i32) > area.x
                    && (m.y() + m.height() as i32) > area.y
                {
                    // avfoundation index = xcap index + 1
                    return (i + 1) as u32;
                }
            }
        }
    }
    1 // Default to primary display.
}

#[cfg(target_os = "windows")]
fn build_windows_command(cmd: &mut Command, options: &RecordingOptions) -> SnapzyResult<()> {
    // Windows: use gdigrab for screen capture.
    let (x, y, w, h) = area_or_default(&options.area);

    if options.area.is_some() {
        cmd.args([
            "-f", "gdigrab",
            "-offset_x", &x.to_string(),
            "-offset_y", &y.to_string(),
            "-video_size", &format!("{w}x{h}"),
            "-i", "desktop",
        ]);
    } else {
        cmd.args([
            "-f", "gdigrab",
            "-i", "desktop",
        ]);
    }

    if options.include_audio || options.include_mic {
        cmd.args(["-f", "dshow", "-i", "audio=default"]);
    }

    Ok(())
}

#[cfg(target_os = "linux")]
fn build_linux_command(cmd: &mut Command, options: &RecordingOptions) -> SnapzyResult<()> {
    let (x, y, w, h) = area_or_default(&options.area);
    let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0.0".into());

    cmd.args([
        "-f", "x11grab",
        "-video_size", &format!("{w}x{h}"),
        "-i", &format!("{display}+{x},{y}"),
    ]);

    if options.include_audio || options.include_mic {
        // Try PulseAudio first, fall back to ALSA.
        if Command::new("pactl").arg("info").stdout(Stdio::null()).stderr(Stdio::null()).status().is_ok() {
            cmd.args(["-f", "pulse", "-i", "default"]);
        } else {
            cmd.args(["-f", "alsa", "-i", "default"]);
        }
    }

    Ok(())
}

/// Return the default capture area (or the specified area if provided).
fn area_or_default(area: &Option<CaptureArea>) -> (i32, i32, u32, u32) {
    match area {
        Some(a) => (a.x, a.y, a.width, a.height),
        None => {
            // Try to get the primary monitor dimensions.
            if let Ok(monitors) = xcap::Monitor::all() {
                if let Some(primary) = monitors.into_iter().find(|m| m.is_primary()) {
                    return (primary.x(), primary.y(), primary.width(), primary.height());
                }
            }
            // Reasonable default.
            (0, 0, 1920, 1080)
        }
    }
}

/// Get a user-appropriate directory for saving recordings.
fn dirs_fallback() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join("Desktop");
    }
    if let Ok(profile) = std::env::var("USERPROFILE") {
        return PathBuf::from(profile).join("Desktop");
    }
    PathBuf::from(".")
}
