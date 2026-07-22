use crate::{RecordingOptions, SnapzyResult};

/// Start a screen recording session.
#[tauri::command]
pub fn start_recording_cmd(
    state: tauri::State<'_, std::sync::Mutex<crate::RecordingState>>,
    options: RecordingOptions,
) -> SnapzyResult<String> {
    crate::recording::recorder::start_recording(state, options)
}

/// Stop the active recording session and return the output file path.
#[tauri::command]
pub fn stop_recording_cmd(
    state: tauri::State<'_, std::sync::Mutex<crate::RecordingState>>,
) -> SnapzyResult<String> {
    crate::recording::recorder::stop_recording(state)
}

/// Encode a sequence of PNG frame bytes into an animated GIF.
/// Returns the file path to the generated GIF.
#[tauri::command]
pub fn encode_gif_cmd(
    frames: Vec<Vec<u8>>,
    fps: u32,
    width: u32,
    height: u32,
) -> SnapzyResult<String> {
    crate::recording::gif_encoder::encode_gif(frames, fps, width, height, None)
}
