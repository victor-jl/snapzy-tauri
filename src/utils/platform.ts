export function isMac(): boolean {
  return /mac/i.test(navigator.platform ?? navigator.userAgent);
}

export function isWindows(): boolean {
  return /win/i.test(navigator.platform ?? navigator.userAgent);
}

export function isLinux(): boolean {
  return /linux/i.test(navigator.platform ?? navigator.userAgent) && !isAndroid();
}

export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

export type ModifierKey = "Cmd" | "Ctrl";

export function getModifierKey(): ModifierKey {
  return isMac() ? "Cmd" : "Ctrl";
}

export type PlatformName = "macOS" | "Windows" | "Linux" | "Unknown";

export function getPlatformName(): PlatformName {
  if (isMac()) return "macOS";
  if (isWindows()) return "Windows";
  if (isLinux()) return "Linux";
  return "Unknown";
}

export function getAppDataPath(): string {
  const home = getHomeDir();
  const platform = getPlatformName();

  switch (platform) {
    case "macOS":
      return `${home}/Library/Application Support/com.snapzy.app`;
    case "Windows":
      return `${home}\\AppData\\Roaming\\com.snapzy.app`;
    case "Linux":
      return `${home}/.local/share/snapzy`;
    default:
      return `${home}/.snapzy`;
  }
}

function getHomeDir(): string {
  if (typeof window !== "undefined" && window.__TAURI__) {
    // In Tauri, the app data path is managed by Rust; this is a fallback
  }
  // Fallback using env or user data
  if (isWindows()) {
    return process.env.USERPROFILE ?? process.env.HOME ?? "C:\\Users\\Default";
  }
  return process.env.HOME ?? "/tmp";
}
