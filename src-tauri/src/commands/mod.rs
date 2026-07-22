pub mod capture_cmds;
pub mod recording_cmds;
pub mod clipboard_cmds;
pub mod ocr_cmds;
pub mod cloud_cmds;
pub mod config_cmds;

// Re-export all public command functions so they're accessible via
// `commands::capture_fullscreen_cmd` etc.
pub use capture_cmds::*;
pub use recording_cmds::*;
pub use clipboard_cmds::*;
pub use ocr_cmds::*;
pub use cloud_cmds::*;
pub use config_cmds::*;
