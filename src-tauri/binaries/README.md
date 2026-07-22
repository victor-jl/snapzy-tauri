# Snapzy - External Binaries (FFmpeg + Tesseract)

These binaries are bundled with the Snapzy application during the build process.

## How it works

1. **During development**: Binaries are resolved from this directory
2. **During production build**: Tauri's `externalBin` configuration bundles them into the app installer
3. **At runtime**: The `binary_resolver` module finds them automatically

## Quick Start

```bash
# Download binaries for all platforms (for cross-platform builds)
npm run download-binaries

# Or download only for your current platform (faster)
npm run download-binaries:local
```

## Downloaded Binaries

### FFmpeg
- `ffmpeg-x86_64-pc-windows-msvc.exe` - Windows x64
- `ffmpeg-x86_64-apple-darwin` - macOS Intel
- `ffmpeg-aarch64-apple-darwin` - macOS Apple Silicon
- `ffmpeg-x86_64-unknown-linux-gnu` - Linux x64

**Source**: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases) (static builds, LGPL licensed)

### Tesseract OCR
- `tesseract-x86_64-pc-windows-msvc.exe` - Windows x64
- `tesseract-x86_64-apple-darwin` - macOS Intel
- `tesseract-aarch64-apple-darwin` - macOS Apple Silicon
- `tesseract-x86_64-unknown-linux-gnu` - Linux x64

**Source**: 
- Windows: [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/releases)
- macOS/Linux: System package manager or manual build

### Tesseract Language Data (tessdata/)
- `eng.traineddata` - English (required)
- `chi_sim.traineddata` - Chinese Simplified
- `chi_tra.traineddata` - Chinese Traditional
- `jpn.traineddata` - Japanese
- `kor.traineddata` - Korean
- `spa.traineddata` - Spanish
- `fra.traineddata` - French
- `deu.traineddata` - German
- `rus.traineddata` - Russian
- `vie.traineddata` - Vietnamese

**Source**: [tesseract-ocr/tessdata](https://github.com/tesseract-ocr/tessdata)

## Manual Installation (Windows)

If the download script doesn't work for your platform, you can manually install:

### Windows
1. Download FFmpeg from https://www.gyan.dev/ffmpeg/builds/ (essentials build)
2. Extract and copy `ffmpeg.exe` → `binaries/ffmpeg-x86_64-pc-windows-msvc.exe`
3. Download Tesseract from https://github.com/UB-Mannheim/tesseract/releases
4. Install Tesseract, then copy `tesseract.exe` → `binaries/tesseract-x86_64-pc-windows-msvc.exe`
5. Copy tessdata from `C:\Program Files\Tesseract-OCR\tessdata\` → `binaries/tessdata\`

### macOS
```bash
brew install ffmpeg tesseract
npm run download-binaries:local
```

### Linux
```bash
sudo apt install ffmpeg tesseract-ocr tesseract-ocr-eng tesseract-ocr-chi-sim
npm run download-binaries:local
```

## Environment Variable Overrides

You can override binary paths with environment variables:

```bash
# Use custom FFmpeg
export SNAPZY_FFMPEG_PATH=/path/to/custom/ffmpeg

# Use custom Tesseract
export SNAPZY_TESSERACT_PATH=/path/to/custom/tesseract

# Use custom tessdata
export TESSDATA_PREFIX=/path/to/tessdata
```
