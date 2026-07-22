# Snapzy

Cross-platform screenshot & screen recording tool built with [Tauri v2](https://v2.tauri.app/).

Supports **Windows**, **macOS**, and **Linux** — FFmpeg and Tesseract OCR are bundled in the installer, no extra setup required.

## Features

- **Screenshot** — full screen, region, window, scrolling, element capture
- **Screen Recording** — video recording with FFmpeg + GIF export
- **Annotation Editor** — arrows, shapes, text, blur, crop
- **Video Editor** — timeline, trim, export
- **OCR** — extract text from screenshots (Tesseract, bundled)
- **Clipboard** — auto-copy, clipboard history
- **Cloud Upload** — S3 / R2 / Google Drive
- **Global Shortcuts** — customizable hotkeys
- **10 Languages** — i18n support (en, zh-CN, zh-TW, ja, ko, de, fr, es, pt, ru)

## Download

Pre-built installers are available on the [Releases](https://github.com/victor-jl/snapzy-tauri/releases) page.

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | `Snapzy_*.dmg` |
| macOS (Intel) | `Snapzy_*.dmg` |
| Windows (x64) | `Snapzy_*.msi` / `Snapzy_*.exe` |
| Linux (x64) | `Snapzy_*.AppImage` / `Snapzy_*.deb` |

## Development

### Prerequisites

- **[Node.js](https://nodejs.org/)** >= 18
- **[Rust](https://rustup.rs/)** (stable)
- **Tauri system dependencies** — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Setup

```bash
git clone https://github.com/victor-jl/snapzy-tauri.git
cd snapzy-tauri
npm install
```

### Download sidecar binaries

```bash
# macOS / Linux — auto-download from web or copy from local system
npm run download-binaries

# macOS / Linux — use locally installed binaries only (brew/apt)
npm run download-binaries:local

# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File scripts/download-binaries.ps1
```

This retrieves FFmpeg and Tesseract OCR into `src-tauri/binaries/`. These are bundled into the final app — users do **not** need to install them separately.

### Run in development

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

Output:

| Platform | Path |
|----------|------|
| macOS | `src-tauri/target/release/bundle/dmg/Snapzy_*.dmg` |
| Windows | `src-tauri/target/release/bundle/msi/Snapzy_*.msi` |
| Linux | `src-tauri/target/release/bundle/appimage/Snapzy_*.AppImage` |

## Project Structure

```
snapzy-tauri/
├── src/                          # React + TypeScript frontend
│   ├── components/
│   │   ├── capture/              # Screenshot overlay, region selection, preview
│   │   ├── annotate/             # Annotation editor
│   │   ├── videoEditor/          # Video editor (timeline, trim, export)
│   │   ├── quickAccess/          # Quick access panel
│   │   ├── history/              # History browser
│   │   ├── preferences/          # Settings (7 panels)
│   │   ├── onboarding/           # Onboarding wizard
│   │   └── common/               # System tray, etc.
│   ├── stores/                   # Zustand state management
│   ├── hooks/                    # Custom React hooks
│   ├── i18n/                     # Internationalization (10 locales)
│   └── utils/                    # Helper utilities
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── capture/              # Screenshot capture (full, region, window, scroll)
│   │   ├── recording/            # FFmpeg video recording + GIF encoding
│   │   ├── clipboard/            # Clipboard management
│   │   ├── ocr/                  # Tesseract OCR
│   │   ├── cloud/                # S3 / R2 / Google Drive upload
│   │   ├── shortcuts/            # Global shortcut registration
│   │   ├── config/               # TOML config import/export
│   │   ├── diagnostics/          # Diagnostic logging
│   │   └── binary_resolver.rs    # Sidecar binary path resolution
│   ├── binaries/                 # FFmpeg & Tesseract sidecars (downloaded at build)
│   ├── icons/                    # App icons
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── scripts/                      # Sidecar download scripts
│   ├── download-binaries.sh      # macOS / Linux
│   └── download-binaries.ps1     # Windows PowerShell
│
├── .github/workflows/
│   └── release.yml               # CI: build + publish multi-platform releases
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

## Releases

Push a version tag to trigger the CI workflow:

```bash
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions will build for all platforms and upload the installers to the [Releases](https://github.com/victor-jl/snapzy-tauri/releases) page automatically.

The workflow builds:
- **macOS** — Apple Silicon (`aarch64`) + Intel (`x86_64`)
- **Windows** — `x86_64`
- **Linux** — `x86_64`

Each installer bundles FFmpeg and Tesseract OCR, so no external dependencies are needed.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri v2](https://v2.tauri.app/) |
| Frontend | React 18 + TypeScript + Vite |
| State | Zustand |
| UI | Tailwind CSS + Lucide Icons |
| i18n | i18next + react-i18next |
| Screenshot | xcap (Rust) |
| Global Shortcuts | rdev (Rust) |
| Recording | FFmpeg (sidecar) |
| OCR | Tesseract (sidecar) |
| Clipboard | arboard (Rust) |
| Cloud | aws-sdk-s3 (S3/R2) + reqwest (Google Drive) |

## License

MIT
