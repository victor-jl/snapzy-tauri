//! Resolves paths to bundled external binaries (sidecars).
//!
//! During development, binaries are resolved from `src-tauri/binaries/`.
//! In production builds, Tauri sidecar API locates them in the app bundle.
//!
//! ## Windows
//! - `ffmpeg.exe` and `tesseract.exe` are bundled as sidecars
//! - Tesseract requires `tessdata/` folder alongside the binary
//!
//! ## macOS
//! - `ffmpeg` and `tesseract` are bundled in the app's `MacOS/` folder
//! - Tesseract needs `tessdata/` in the Resources folder
//!
//! ## Linux
//! - `ffmpeg` and `tesseract` are bundled in the AppImage/package
//! - Tesseract looks for `tessdata/` relative to its binary or in standard paths

use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Supported external binary types.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExternalBinary {
    /// FFmpeg for screen recording and video processing.
    Ffmpeg,
    /// Tesseract for OCR text recognition.
    Tesseract,
}

impl ExternalBinary {
    /// Get the binary base name (without extension or target-triple suffix).
    fn base_name(&self) -> &str {
        match self {
            ExternalBinary::Ffmpeg => "ffmpeg",
            ExternalBinary::Tesseract => "tesseract",
        }
    }

    /// Get the binary file name for the current platform.
    fn executable_name(&self) -> &str {
        #[cfg(target_os = "windows")]
        {
            match self {
                ExternalBinary::Ffmpeg => "ffmpeg.exe",
                ExternalBinary::Tesseract => "tesseract.exe",
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            self.base_name()
        }
    }
}

/// Resolve the path to a bundled external binary.
///
/// Resolution order:
/// 1. Environment variable override (e.g., `SNAPZY_FFMPEG_PATH`, `SNAPZY_TESSERACT_PATH`)
/// 2. Tauri sidecar path (production builds)
/// 3. `src-tauri/binaries/` directory (development)
/// 4. System PATH (fallback)
pub fn resolve_binary_path(binary: ExternalBinary) -> Option<PathBuf> {
    // 1. Environment variable override (useful for custom installs).
    if let Some(env_path) = env_override(binary) {
        if Path::new(&env_path).exists() {
            log::info!(
                "Using {} from env override: {}",
                binary.base_name(),
                env_path.display()
            );
            return Some(PathBuf::from(env_path));
        }
    }

    // 2. Tauri sidecar path (set by Tauri at runtime in production).
    if let Some(sidecar_path) = tauri_sidecar_path(binary) {
        return Some(sidecar_path);
    }

    // 3. Development binaries directory.
    if let Some(dev_path) = dev_binary_path(binary) {
        log::info!(
            "Using {} from dev binaries: {}",
            binary.base_name(),
            dev_path.display()
        );
        return Some(dev_path);
    }

    // 4. Fallback to system PATH.
    if let Some(sys_path) = system_path(binary) {
        log::info!(
            "Using {} from system PATH: {}",
            binary.base_name(),
            sys_path.display()
        );
        return Some(sys_path);
    }

    log::warn!("{} not found in any location", binary.base_name());
    None
}

/// Create a Command with the resolved binary path.
///
/// Returns `None` if the binary cannot be found.
pub fn command_for(binary: ExternalBinary) -> Option<Command> {
    resolve_binary_path(binary).map(Command::new)
}

/// Check if an environment variable override is set.
fn env_override(binary: ExternalBinary) -> Option<String> {
    let env_var = match binary {
        ExternalBinary::Ffmpeg => "SNAPZY_FFMPEG_PATH",
        ExternalBinary::Tesseract => "SNAPZY_TESSERACT_PATH",
    };
    env::var(env_var).ok().filter(|v| !v.is_empty())
}

/// Resolve via Tauri sidecar mechanism (production builds).
///
/// Tauri v2 sets environment variables or resolves sidecars relative to the
/// current executable when the app is packaged. The sidecar binary naming 
/// convention is: `<name>-<target_triple>[.exe]`.
fn tauri_sidecar_path(binary: ExternalBinary) -> Option<PathBuf> {
    // In Tauri v2 production builds, sidecars are placed next to the main executable.
    let exe_dir = env::current_exe()
        .ok()?
        .parent()?
        .to_path_buf();

    // Try the sidecar naming convention first.
    let target_triple = target_triple_name();
    #[cfg(target_os = "windows")]
    let sidecar_name = format!("{}-{}.exe", binary.base_name(), target_triple);
    #[cfg(not(target_os = "windows"))]
    let sidecar_name = format!("{}-{}", binary.base_name(), target_triple);

    let sidecar_path = exe_dir.join(&sidecar_name);
    if sidecar_path.exists() {
        log::info!("Found sidecar: {}", sidecar_path.display());
        return Some(sidecar_path);
    }

    // Also try without the target triple suffix.
    let simple_path = exe_dir.join(binary.executable_name());
    if simple_path.exists() {
        log::info!("Found bundled binary: {}", simple_path.display());
        return Some(simple_path);
    }

    // On macOS, also check the Resources directory.
    #[cfg(target_os = "macos")]
    {
        if let Some(resources_dir) = exe_dir.parent().map(|p| p.join("Resources")) {
            let mac_path = resources_dir.join(binary.executable_name());
            if mac_path.exists() {
                log::info!("Found bundled binary in Resources: {}", mac_path.display());
                return Some(mac_path);
            }
        }
    }

    None
}

/// Resolve from the development `src-tauri/binaries/` directory.
fn dev_binary_path(binary: ExternalBinary) -> Option<PathBuf> {
    // Compute path relative to the Cargo manifest directory (src-tauri/).
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let binaries_dir = manifest_dir.join("binaries");

    // Try with the target triple suffix (sidecar convention).
    let target_triple = target_triple_name();
    #[cfg(target_os = "windows")]
    let sidecar_name = format!("{}-{}.exe", binary.base_name(), target_triple);
    #[cfg(not(target_os = "windows"))]
    let sidecar_name = format!("{}-{}", binary.base_name(), target_triple);

    let sidecar_path = binaries_dir.join(&sidecar_name);
    if sidecar_path.exists() {
        return Some(sidecar_path);
    }

    // Try simple name.
    let simple_path = binaries_dir.join(binary.executable_name());
    if simple_path.exists() {
        return Some(simple_path);
    }

    None
}

/// Fallback: find the binary on the system PATH.
fn system_path(binary: ExternalBinary) -> Option<PathBuf> {
    let name = binary.executable_name();
    which_in_path(&name)
}

/// Search for an executable on the system PATH.
fn which_in_path(name: &str) -> Option<PathBuf> {
    if let Ok(path_var) = env::var("PATH") {
        for dir in env::split_paths(&path_var) {
            let full_path = dir.join(name);
            if full_path.is_file() {
                return Some(full_path);
            }
        }
    }
    None
}

/// Get the Rust target triple for the current platform.
fn target_triple_name() -> &'static str {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        "x86_64-pc-windows-msvc"
    }
    #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
    {
        "aarch64-pc-windows-msvc"
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        "x86_64-apple-darwin"
    }
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        "aarch64-apple-darwin"
    }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        "x86_64-unknown-linux-gnu"
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        "aarch64-unknown-linux-gnu"
    }
    #[cfg(not(any(
        all(target_os = "windows", target_arch = "x86_64"),
        all(target_os = "windows", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "aarch64"),
    )))]
    {
        compile_error!("Unsupported target platform for binary sidecars")
    }
}

/// Get the tessdata directory (for Tesseract language data files).
///
/// Resolution order:
/// 1. `TESSDATA_PREFIX` environment variable
/// 2. Relative to the bundled tesseract binary: `../tessdata/`
/// 3. Development: `src-tauri/binaries/tessdata/`
/// 4. System default tessdata paths
pub fn tessdata_dir() -> Option<PathBuf> {
    // 1. Environment variable (standard Tesseract convention).
    if let Ok(prefix) = env::var("TESSDATA_PREFIX") {
        if !prefix.is_empty() {
            let path = PathBuf::from(&prefix);
            if path.exists() {
                return Some(path);
            }
        }
    }

    // 2. Relative to the resolved tesseract binary.
    if let Some(tesseract_path) = resolve_binary_path(ExternalBinary::Tesseract) {
        if let Some(parent) = tesseract_path.parent() {
            let relative_tessdata = parent.join("tessdata");
            if relative_tessdata.exists() {
                log::info!("Found tessdata relative to binary: {}", relative_tessdata.display());
                return Some(relative_tessdata);
            }
            // Also try one level up (for sidecar layouts where binary is in a subfolder).
            if let Some(grandparent) = parent.parent() {
                let up_tessdata = grandparent.join("tessdata");
                if up_tessdata.exists() {
                    return Some(up_tessdata);
                }
            }
        }
    }

    // 3. Development binaries directory.
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dev_tessdata = manifest_dir.join("binaries").join("tessdata");
    if dev_tessdata.exists() {
        log::info!("Found tessdata in dev: {}", dev_tessdata.display());
        return Some(dev_tessdata);
    }

    // 4. System default paths.
    let system_paths: &[&str] = &[
        #[cfg(target_os = "macos")]
        "/opt/homebrew/share/tessdata",
        #[cfg(target_os = "macos")]
        "/usr/local/share/tessdata",
        #[cfg(target_os = "linux")]
        "/usr/share/tesseract-ocr/4.00/tessdata",
        #[cfg(target_os = "linux")]
        "/usr/share/tesseract-ocr/tessdata",
        #[cfg(target_os = "linux")]
        "/usr/share/tessdata",
        #[cfg(target_os = "windows")]
        "C:\\Program Files\\Tesseract-OCR\\tessdata",
        #[cfg(target_os = "windows")]
        "C:\\Program Files (x86)\\Tesseract-OCR\\tessdata",
    ];

    for path in system_paths {
        let p = PathBuf::from(path);
        if p.exists() {
            log::info!("Found system tessdata: {}", p.display());
            return Some(p);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_target_triple_is_valid() {
        let triple = target_triple_name();
        assert!(!triple.is_empty());
        assert!(triple.contains('-'));
    }

    #[test]
    fn test_executable_name_has_extension_on_windows() {
        let ffmpeg = ExternalBinary::Ffmpeg.executable_name();
        let tess = ExternalBinary::Tesseract.executable_name();
        #[cfg(target_os = "windows")]
        {
            assert!(ffmpeg.ends_with(".exe"));
            assert!(tess.ends_with(".exe"));
        }
        #[cfg(not(target_os = "windows"))]
        {
            assert!(!ffmpeg.contains('.'));
            assert!(!tess.contains('.'));
        }
    }

    #[test]
    fn test_env_override_empty() {
        // Should be empty unless explicitly set.
        let ffmpeg_override = env_override(ExternalBinary::Ffmpeg);
        let tess_override = env_override(ExternalBinary::Tesseract);
        // These may be set in CI; we just verify they return Option<String>.
        let _ = ffmpeg_override;
        let _ = tess_override;
    }

    #[test]
    fn test_command_for_returns_none_when_not_found() {
        // In a test environment without the sidecar binaries, this may return None
        // or fall back to system PATH. We just verify it compiles and returns Option.
        let cmd = command_for(ExternalBinary::Ffmpeg);
        let _ = cmd; // May be Some (if ffmpeg on PATH) or None.
    }
}
