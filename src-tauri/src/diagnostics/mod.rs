use std::time::Instant;

use crate::{DiagnosticInfo, DisplayInfo, SnapzyResult};

/// A simple performance timing helper.
/// Use `DiagnosticTimer::start("label")` and then call `.elapsed_ms()` to measure.
pub struct DiagnosticTimer {
    label: String,
    start: Instant,
}

impl DiagnosticTimer {
    /// Start a new named timer.
    pub fn start(label: &str) -> Self {
        log::debug!("[perf] {label}: started");
        Self {
            label: label.to_string(),
            start: Instant::now(),
        }
    }

    /// Get the elapsed time in milliseconds (does not stop the timer).
    pub fn elapsed_ms(&self) -> u64 {
        self.start.elapsed().as_millis() as u64
    }

    /// Log the elapsed time with the timer's label and return elapsed ms.
    pub fn log_elapsed(&self) -> u64 {
        let ms = self.elapsed_ms();
        log::debug!("[perf] {}: {}ms", self.label, ms);
        ms
    }
}

/// Collect system diagnostic information.
///
/// Returns OS, version, CPU, memory, display, and Tauri version info
/// for debugging and support purposes.
#[tauri::command]
pub fn collect_diagnostic_info() -> SnapzyResult<DiagnosticInfo> {
    let timer = DiagnosticTimer::start("collect_diagnostic_info");

    let os = std::env::consts::OS.to_string();
    let cpu_arch = std::env::consts::ARCH.to_string();

    let os_version = get_os_version();
    let hostname = get_hostname();
    let cpu_count = num_cpus::available();
    let total_memory_gb = get_total_memory_gb();
    let displays = get_display_info();
    let tauri_version = option_env!("CARGO_PKG_VERSION").unwrap_or("0.1.0");

    let diag = DiagnosticInfo {
        os,
        os_version,
        hostname,
        cpu_arch,
        cpu_count,
        total_memory_gb,
        displays,
        tauri_version: tauri_version.to_string(),
    };

    timer.log_elapsed();

    log::info!(
        "Diagnostics collected: {} {} ({} cores, {:.1} GB RAM, {} displays)",
        diag.os,
        diag.os_version,
        diag.cpu_count,
        diag.total_memory_gb,
        diag.displays.len(),
    );

    Ok(diag)
}

/// Get the OS version string.
#[cfg(target_os = "macos")]
fn get_os_version() -> String {
    std::process::Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .ok()
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if s.is_empty() { None } else { Some(s) }
        })
        .unwrap_or_else(|| "Unknown macOS".into())
}

#[cfg(target_os = "windows")]
fn get_os_version() -> String {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    std::process::Command::new("cmd")
        .args(["/C", "ver"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if s.is_empty() { None } else { Some(s) }
        })
        .unwrap_or_else(|| "Unknown Windows".into())
}

#[cfg(target_os = "linux")]
fn get_os_version() -> String {
    // Try /etc/os-release first.
    if let Ok(content) = std::fs::read_to_string("/etc/os-release") {
        let name = content
            .lines()
            .find(|l| l.starts_with("PRETTY_NAME="))
            .map(|l| l.trim_start_matches("PRETTY_NAME=").trim_matches('"').to_string());
        if let Some(n) = name {
            return n;
        }
    }

    // Fallback: uname -a.
    std::process::Command::new("uname")
        .arg("-a")
        .output()
        .ok()
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if s.is_empty() { None } else { Some(s) }
        })
        .unwrap_or_else(|| "Unknown Linux".into())
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn get_os_version() -> String {
    format!("{} (unknown version)", std::env::consts::OS)
}

/// Get the system hostname (anonymized for privacy).
/// Shows only the first 4 characters + "...".
fn get_hostname() -> String {
    let raw = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "unknown".into());

    // Anonymize: show only first 4 chars to protect user privacy.
    let char_count = raw.chars().count();
    if char_count <= 4 {
        raw
    } else {
        format!("{}...", &raw[..raw.char_indices().nth(4).map(|(i, _)| i).unwrap_or(raw.len())])
    }
}

/// Get total system memory in GB.
#[cfg(target_os = "macos")]
fn get_total_memory_gb() -> f64 {
    use std::process::Command;

    // sysctl hw.memsize returns total RAM in bytes.
    Command::new("sysctl")
        .args(["-n", "hw.memsize"])
        .output()
        .ok()
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            s.parse::<u64>().ok()
        })
        .map(|bytes| bytes as f64 / (1024.0 * 1024.0 * 1024.0))
        .unwrap_or(0.0)
}

#[cfg(target_os = "windows")]
fn get_total_memory_gb() -> f64 {
    // Use wmic to get total physical memory.
    std::process::Command::new("wmic")
        .args(["computersystem", "get", "totalphysicalmemory"])
        .output()
        .ok()
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout);
            s.lines()
                .nth(1)
                .and_then(|l| l.trim().parse::<u64>().ok())
        })
        .map(|bytes| bytes as f64 / (1024.0 * 1024.0 * 1024.0))
        .unwrap_or(0.0)
}

#[cfg(target_os = "linux")]
fn get_total_memory_gb() -> f64 {
    // Parse /proc/meminfo.
    if let Ok(content) = std::fs::read_to_string("/proc/meminfo") {
        for line in content.lines() {
            if line.starts_with("MemTotal:") {
                let kb: u64 = line
                    .split_whitespace()
                    .nth(1)
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0);
                return kb as f64 / (1024.0 * 1024.0);
            }
        }
    }
    0.0
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn get_total_memory_gb() -> f64 {
    0.0
}

/// Get display information using xcap.
fn get_display_info() -> Vec<DisplayInfo> {
    match xcap::Monitor::all() {
        Ok(monitors) => monitors
            .into_iter()
            .map(|m| DisplayInfo {
                name: m.name().to_string(),
                width: m.width(),
                height: m.height(),
                scale_factor: m.scale_factor(),
                is_primary: m.is_primary(),
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}

/// Dummy `num_cpus` replacement using std only (real `num_cpus` crate is recommended).
/// We use a simple approach: count logical CPUs via environment or platform APIs.
mod num_cpus {
    pub fn available() -> usize {
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("sysctl")
                .args(["-n", "hw.ncpu"])
                .output()
                .ok()
                .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse().ok())
                .unwrap_or(4)
        }

        #[cfg(target_os = "windows")]
        {
            std::env::var("NUMBER_OF_PROCESSORS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(4)
        }

        #[cfg(target_os = "linux")]
        {
            std::fs::read_to_string("/proc/cpuinfo")
                .ok()
                .map(|s| s.lines().filter(|l| l.starts_with("processor")).count())
                .unwrap_or(4)
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            // Use std::thread as a rough estimate.
            std::thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(4)
        }
    }
}

/// Dummy `hostname` replacement.
mod hostname {
    pub fn get() -> std::io::Result<OsString> {
        #[cfg(target_os = "macos")]
        {
            let output = std::process::Command::new("hostname")
                .output()
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(OsString::from(s))
        }

        #[cfg(target_os = "linux")]
        {
            let output = std::process::Command::new("hostname")
                .output()
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(OsString::from(s))
        }

        #[cfg(target_os = "windows")]
        {
            let output = std::process::Command::new("hostname")
                .output()
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(OsString::from(s))
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            Ok(OsString::from("unknown"))
        }
    }

    use std::ffi::OsString;
}
