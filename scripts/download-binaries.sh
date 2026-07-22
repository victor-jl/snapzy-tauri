#!/usr/bin/env bash
# =============================================================================
# Snapzy - Download External Binaries (FFmpeg + Tesseract)
# =============================================================================
# Downloads pre-built FFmpeg and Tesseract OCR binaries for all target platforms
# and places them in src-tauri/binaries/ with the correct sidecar naming convention.
#
# Usage:
#   ./scripts/download-binaries.sh          # Download for all platforms
#   ./scripts/download-binaries.sh --local  # Download only for current platform
#
# Sources:
#   FFmpeg:  https://github.com/BtbN/FFmpeg-Builds/releases (static builds)
#   Tesseract: https://github.com/UB-Mannheim/tesseract (Windows) 
#              Homebrew (macOS), apt (Linux)
#
# After download, run `npm run tauri build` and the binaries will be bundled.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARIES_DIR="$SCRIPT_DIR/../src-tauri/binaries"
LOCAL_ONLY=false

# Parse CLI flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --local) LOCAL_ONLY=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ============================================================
# Configuration
# ============================================================

# FFmpeg: static builds from BtbN (no dependencies needed)
FFMPEG_BASE_URL="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest"

declare -A FFMPEG_URLS=(
  ["x86_64-pc-windows-msvc"]="ffmpeg-master-latest-win64-gpl.zip"
  ["x86_64-apple-darwin"]="ffmpeg-master-latest-macos64-gpl.tar.xz"
  ["aarch64-apple-darwin"]="ffmpeg-master-latest-macos64-gpl.tar.xz"
  ["x86_64-unknown-linux-gnu"]="ffmpeg-master-latest-linux64-gpl.tar.xz"
)

# Tesseract: platform-specific sources
TESSERACT_WIN_URL="https://github.com/UB-Mannheim/tesseract/releases/download/v5.5.0/tesseract-ocr-w64-setup-5.5.0.20241111.exe"

TESSDATA_BASE_URL="https://github.com/tesseract-ocr/tessdata/raw/main"

# Common language data files to download
TESSDATA_FILES=(
  "eng.traineddata"       # English (required)
  "chi_sim.traineddata"   # Chinese Simplified
  "chi_tra.traineddata"   # Chinese Traditional
  "jpn.traineddata"       # Japanese
  "kor.traineddata"       # Korean
  "spa.traineddata"       # Spanish
  "fra.traineddata"       # French
  "deu.traineddata"       # German
  "rus.traineddata"       # Russian
  "vie.traineddata"       # Vietnamese
)

# ============================================================
# Platform detection
# ============================================================

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)  HOST_OS="macos" ;;
  Linux)   HOST_OS="linux" ;;
  MINGW*|MSYS*|CYGWIN*) HOST_OS="windows" ;;
  *) echo "Error: Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
  x86_64|amd64) HOST_ARCH="x86_64" ;;
  arm64|aarch64) HOST_ARCH="aarch64" ;;
  *) echo "Error: Unsupported architecture: $ARCH"; exit 1 ;;
esac

HOST_TRIPLE="${HOST_ARCH}-"
case "$HOST_OS" in
  macos)   HOST_TRIPLE+="apple-darwin" ;;
  linux)   HOST_TRIPLE+="unknown-linux-gnu" ;;
  windows) HOST_TRIPLE+="pc-windows-msvc" ;;
esac

echo "============================================"
echo "  Snapzy - Binary Downloader"
echo "============================================"
echo "  Platform: $HOST_OS / $HOST_ARCH"
echo "  Target triple: $HOST_TRIPLE"
echo "  Local only: $LOCAL_ONLY"
echo "  Output: $BINARIES_DIR"
echo "============================================"
echo ""

mkdir -p "$BINARIES_DIR"
mkdir -p "$BINARIES_DIR/tessdata"

# ============================================================
# Helper: check if a command is available
# ============================================================
has_command() { command -v "$1" >/dev/null 2>&1; }

# ============================================================
# Helper: download a URL with progress
# ============================================================
download_file() {
  local url="$1" output="$2"
  echo "  Downloading: $url"
  if has_command curl; then
    curl -fSL --progress-bar -o "$output" "$url"
  elif has_command wget; then
    wget -q --show-progress -O "$output" "$url"
  else
    echo "  Error: Neither curl nor wget is installed."
    exit 1
  fi
}

# ============================================================
# Helper: extract archive
# ============================================================
extract_archive() {
  local archive="$1" dest="$2"
  mkdir -p "$dest"
  case "$archive" in
    *.zip)
      if has_command unzip; then
        unzip -qo "$archive" -d "$dest"
      elif has_command 7z; then
        7z x -o"$dest" "$archive" -y >/dev/null
      else
        echo "  Error: unzip or 7z required to extract .zip files"
        exit 1
      fi
      ;;
    *.tar.xz|*.tar.gz|*.tar.bz2)
      tar -xf "$archive" -C "$dest"
      ;;
    *)
      echo "  Error: Unknown archive format: $archive"
      exit 1
      ;;
  esac
}

# ============================================================
# Download FFmpeg
# ============================================================
download_ffmpeg() {
  local triple="$1"
  local exe_ext=""
  [[ "$triple" == *windows* ]] && exe_ext=".exe"

  local output_name="ffmpeg-${triple}${exe_ext}"
  local output_path="$BINARIES_DIR/$output_name"

  if [[ -f "$output_path" ]]; then
    echo "[FFmpeg] $triple - already exists, skipping."
    return
  fi

  echo "[FFmpeg] $triple - downloading..."

  # If on macOS and have brew, use the local binary.
  if [[ "$HOST_OS" == "macos" ]] && has_command brew && [[ "$triple" == "$HOST_TRIPLE" ]]; then
    local brew_prefix
    brew_prefix="$(brew --prefix ffmpeg 2>/dev/null || echo "")"
    if [[ -n "$brew_prefix" && -f "$brew_prefix/bin/ffmpeg" ]]; then
      echo "  Using Homebrew FFmpeg from $brew_prefix/bin/ffmpeg"
      cp "$brew_prefix/bin/ffmpeg" "$output_path"
      chmod +x "$output_path"
      return
    fi
  fi

  # If on Linux and ffmpeg is in PATH, use the local binary.
  if [[ "$HOST_OS" == "linux" ]] && has_command ffmpeg && [[ "$triple" == "$HOST_TRIPLE" ]]; then
    local system_ffmpeg
    system_ffmpeg="$(which ffmpeg)"
    echo "  Using system FFmpeg from $system_ffmpeg"
    cp "$system_ffmpeg" "$output_path"
    chmod +x "$output_path"
    return
  fi

  # Download static build from BtbN releases.
  local url="${FFMPEG_BASE_URL}/${FFMPEG_URLS[$triple]:-}"
  if [[ -z "$url" ]]; then
    echo "  Warning: No FFmpeg URL configured for $triple"
    return
  fi

  local tmp_archive="/tmp/snapzy_ffmpeg_${triple}_$(date +%s)"
  download_file "$url" "$tmp_archive"

  local tmp_extract="/tmp/snapzy_ffmpeg_extracted_${triple}"
  extract_archive "$tmp_archive" "$tmp_extract"

  # Find the ffmpeg binary in the extracted folder.
  local found_bin
  found_bin="$(find "$tmp_extract" -type f -name "ffmpeg${exe_ext}" -not -path "*ffprobe*" 2>/dev/null | head -1)"
  if [[ -z "$found_bin" ]]; then
    echo "  Error: Could not find ffmpeg in extracted archive"
    rm -rf "$tmp_archive" "$tmp_extract"
    return
  fi

  cp "$found_bin" "$output_path"
  chmod +x "$output_path"

  rm -rf "$tmp_archive" "$tmp_extract"
  echo "  Done: $output_name ($(du -h "$output_path" | cut -f1))"
}

# ============================================================
# Download Tesseract
# ============================================================
download_tesseract() {
  local triple="$1"
  local exe_ext=""
  [[ "$triple" == *windows* ]] && exe_ext=".exe"

  local output_name="tesseract-${triple}${exe_ext}"
  local output_path="$BINARIES_DIR/$output_name"

  if [[ -f "$output_path" ]]; then
    echo "[Tesseract] $triple - already exists, skipping."
    return
  fi

  echo "[Tesseract] $triple - downloading..."

  # If on macOS and have brew, use the local binary.
  if [[ "$HOST_OS" == "macos" ]] && has_command brew && [[ "$triple" == "$HOST_TRIPLE" ]]; then
    local brew_prefix
    brew_prefix="$(brew --prefix tesseract 2>/dev/null || echo "")"
    if [[ -n "$brew_prefix" && -f "$brew_prefix/bin/tesseract" ]]; then
      echo "  Using Homebrew Tesseract from $brew_prefix/bin/tesseract"
      cp "$brew_prefix/bin/tesseract" "$output_path"
      chmod +x "$output_path"
      return
    fi
  fi

  # If on Linux and tesseract is in PATH, use the local binary.
  if [[ "$HOST_OS" == "linux" ]] && has_command tesseract && [[ "$triple" == "$HOST_TRIPLE" ]]; then
    local system_tesseract
    system_tesseract="$(which tesseract)"
    echo "  Using system Tesseract from $system_tesseract"
    cp "$system_tesseract" "$output_path"
    chmod +x "$output_path"
    return
  fi

  # If on Windows, try to find an installed Tesseract.
  if [[ "$HOST_OS" == "windows" || "$triple" == *windows* ]]; then
    local win_paths=(
      "/c/Program Files/Tesseract-OCR/tesseract.exe"
      "/c/Program Files (x86)/Tesseract-OCR/tesseract.exe"
      "C:/Program Files/Tesseract-OCR/tesseract.exe"
      "C:/Program Files (x86)/Tesseract-OCR/tesseract.exe"
    )
    for p in "${win_paths[@]}"; do
      if [[ -f "$p" ]]; then
        echo "  Using installed Tesseract from $p"
        cp "$p" "$output_path"
        return
      fi
    done

    # Download Tesseract installer for Windows.
    echo "  Downloading Tesseract Windows installer..."
    local tmp_installer="/tmp/snapzy_tesseract_setup.exe"
    download_file "$TESSERACT_WIN_URL" "$tmp_installer"
    
    # Extract the installer contents using 7z (portable extraction).
    if has_command 7z; then
      local tmp_tess="/tmp/snapzy_tesseract_extracted"
      7z x -o"$tmp_tess" "$tmp_installer" -y >/dev/null 2>&1 || true
      local found_tess
      found_tess="$(find "$tmp_tess" -name "tesseract.exe" -type f 2>/dev/null | head -1)"
      if [[ -n "$found_tess" ]]; then
        cp "$found_tess" "$output_path"
        echo "  Extracted tesseract.exe from installer"
      fi
      rm -rf "$tmp_tess"
    else
      echo "  Note: Installer downloaded to $tmp_installer"
      echo "  Run the installer manually to install Tesseract, then copy tesseract.exe here."
    fi
    rm -f "$tmp_installer"
    return
  fi

  echo "  Warning: Could not find or download Tesseract for $triple"
  echo "  Please install Tesseract manually and copy the binary to $output_path"
}

# ============================================================
# Download Tessdata (language files)
# ============================================================
download_tessdata() {
  echo ""
  echo "[Tessdata] Downloading language data files..."

  for lang_file in "${TESSDATA_FILES[@]}"; do
    local output_path="$BINARIES_DIR/tessdata/$lang_file"
    if [[ -f "$output_path" ]]; then
      echo "  $lang_file - already exists, skipping."
      continue
    fi

    local url="${TESSDATA_BASE_URL}/${lang_file}"
    echo "  $lang_file - downloading..."
    download_file "$url" "$output_path" || echo "  Warning: Failed to download $lang_file"
  done

  echo "  Tessdata download complete."
}

# ============================================================
# Copy local tessdata if available
# ============================================================
copy_local_tessdata() {
  local src=""
  
  if [[ "$HOST_OS" == "macos" ]]; then
    src="$(brew --prefix tesseract 2>/dev/null || echo "")/share/tessdata"
  elif [[ "$HOST_OS" == "linux" ]]; then
    for d in /usr/share/tesseract-ocr/4.00/tessdata /usr/share/tesseract-ocr/tessdata /usr/share/tessdata; do
      if [[ -d "$d" ]]; then
        src="$d"
        break
      fi
    done
  elif [[ "$HOST_OS" == "windows" ]]; then
    for d in "/c/Program Files/Tesseract-OCR/tessdata" "/c/Program Files (x86)/Tesseract-OCR/tessdata"; do
      if [[ -d "$d" ]]; then
        src="$d"
        break
      fi
    done
  fi

  if [[ -n "$src" && -d "$src" ]]; then
    echo ""
    echo "[Tessdata] Copying language data from local installation..."
    echo "  Source: $src"
    for lang_file in "${TESSDATA_FILES[@]}"; do
      if [[ -f "$src/$lang_file" ]] && [[ ! -f "$BINARIES_DIR/tessdata/$lang_file" ]]; then
        cp "$src/$lang_file" "$BINARIES_DIR/tessdata/"
        echo "  Copied: $lang_file"
      fi
    done
  fi
}

# ============================================================
# Main
# ============================================================

if $LOCAL_ONLY; then
  echo "--- Downloading binaries for current platform only ---"
  echo ""
  download_ffmpeg "$HOST_TRIPLE"
  download_tesseract "$HOST_TRIPLE"
else
  echo "--- Downloading binaries for all platforms ---"
  echo ""
  PLATFORMS=(
    "x86_64-pc-windows-msvc"
    "x86_64-apple-darwin"
    "aarch64-apple-darwin"
    "x86_64-unknown-linux-gnu"
  )
  for triple in "${PLATFORMS[@]}"; do
    download_ffmpeg "$triple"
  done
  echo ""
  for triple in "${PLATFORMS[@]}"; do
    download_tesseract "$triple"
  done
fi

# Download/copy tessdata.
copy_local_tessdata
download_tessdata

echo ""
echo "============================================"
echo "  Download Complete!"
echo "============================================"
echo ""
echo "Binaries directory: $BINARIES_DIR"
echo ""
echo "Contents:"
ls -lh "$BINARIES_DIR"/* 2>/dev/null || echo "  (no binaries yet)"
echo ""
ls -lh "$BINARIES_DIR/tessdata/" 2>/dev/null || echo "  (no tessdata yet)"
echo ""
echo "Next steps:"
echo "  1. Run 'npm install' if you haven't yet"
echo "  2. Run 'npm run tauri dev' to start development"
echo "  3. Run 'npm run tauri build' to create a production build"
echo "     (binaries will be automatically bundled)"
echo ""
