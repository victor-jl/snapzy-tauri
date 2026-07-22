# =============================================================================
# Snapzy - Download External Binaries (Windows PowerShell)
# =============================================================================
# Downloads FFmpeg and Tesseract OCR binaries for the current platform.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/download-binaries.ps1
# =============================================================================

param(
    [switch]$LocalOnly = $true,
    [string]$BinariesDir = "$PSScriptRoot\..\src-tauri\binaries"
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Snapzy - Binary Downloader (Windows)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Output: $BinariesDir"
Write-Host "============================================"
Write-Host ""

# Create directories
New-Item -ItemType Directory -Force -Path "$BinariesDir" | Out-Null
New-Item -ItemType Directory -Force -Path "$BinariesDir\tessdata" | Out-Null

# ============================================================
# Download FFmpeg for Windows
# ============================================================
function Download-FFmpeg {
    $outputPath = "$BinariesDir\ffmpeg-x86_64-pc-windows-msvc.exe"
    
    if (Test-Path $outputPath) {
        Write-Host "[FFmpeg] Already exists, skipping." -ForegroundColor Gray
        return
    }

    Write-Host "[FFmpeg] Downloading for Windows..." -ForegroundColor Yellow

    # Check if ffmpeg is already on PATH or installed via winget/choco
    $sysFfmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($sysFfmpeg) {
        Write-Host "  Found system FFmpeg at: $($sysFfmpeg.Source)"
        Copy-Item $sysFfmpeg.Source $outputPath
        Write-Host "  Done: ffmpeg-x86_64-pc-windows-msvc.exe" -ForegroundColor Green
        return
    }

    # Download static build from gyan.dev
    $ffmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    $tmpZip = "$env:TEMP\snapzy_ffmpeg.zip"
    $tmpExtract = "$env:TEMP\snapzy_ffmpeg_extracted"

    Write-Host "  Downloading from: $ffmpegUrl"
    Invoke-WebRequest -Uri $ffmpegUrl -OutFile $tmpZip

    Write-Host "  Extracting..."
    Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract -Force

    # Find ffmpeg.exe in the extracted folder
    $foundBin = Get-ChildItem -Path $tmpExtract -Recurse -Name "ffmpeg.exe" | Select-Object -First 1
    if ($foundBin) {
        Copy-Item "$tmpExtract\$foundBin" $outputPath
        Write-Host "  Done: ffmpeg-x86_64-pc-windows-msvc.exe" -ForegroundColor Green
    } else {
        Write-Host "  Warning: Could not find ffmpeg.exe in archive" -ForegroundColor Red
    }

    # Clean up
    Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
    Remove-Item $tmpExtract -Recurse -Force -ErrorAction SilentlyContinue
}

# ============================================================
# Download Tesseract for Windows
# ============================================================
function Download-Tesseract {
    $outputPath = "$BinariesDir\tesseract-x86_64-pc-windows-msvc.exe"
    
    if (Test-Path $outputPath) {
        Write-Host "[Tesseract] Already exists, skipping." -ForegroundColor Gray
        return
    }

    Write-Host "[Tesseract] Downloading for Windows..." -ForegroundColor Yellow

    # Check common install locations
    $installPaths = @(
        "C:\Program Files\Tesseract-OCR\tesseract.exe",
        "C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        "$env:LOCALAPPDATA\Tesseract-OCR\tesseract.exe"
    )

    foreach ($path in $installPaths) {
        if (Test-Path $path) {
            Write-Host "  Found installed Tesseract at: $path"
            Copy-Item $path $outputPath
            Write-Host "  Done: tesseract-x86_64-pc-windows-msvc.exe" -ForegroundColor Green
            return
        }
    }

    # Check PATH
    $sysTess = Get-Command tesseract -ErrorAction SilentlyContinue
    if ($sysTess) {
        Write-Host "  Found system Tesseract at: $($sysTess.Source)"
        Copy-Item $sysTess.Source $outputPath
        Write-Host "  Done: tesseract-x86_64-pc-windows-msvc.exe" -ForegroundColor Green
        return
    }

    # Download Tesseract installer
    $tessUrl = "https://github.com/UB-Mannheim/tesseract/releases/download/v5.5.0/tesseract-ocr-w64-setup-5.5.0.20241111.exe"
    $tmpInstaller = "$env:TEMP\snapzy_tesseract_setup.exe"

    Write-Host "  Downloading installer from: $tessUrl"
    Write-Host "  Note: Tesseract is ~40MB, this may take a moment..."
    Invoke-WebRequest -Uri $tessUrl -OutFile $tmpInstaller

    Write-Host "  Please install Tesseract to the default location (C:\Program Files\Tesseract-OCR)"
    Write-Host "  Launching installer..."
    Start-Process -FilePath $tmpInstaller -Wait

    # Try to copy after installation
    $installedPath = "C:\Program Files\Tesseract-OCR\tesseract.exe"
    if (Test-Path $installedPath) {
        Copy-Item $installedPath $outputPath
        Write-Host "  Done: tesseract-x86_64-pc-windows-msvc.exe" -ForegroundColor Green
    } else {
        Write-Host "  Warning: Tesseract installation may not have completed." -ForegroundColor Yellow
        Write-Host "  After installing, manually copy tesseract.exe to: $outputPath"
    }

    Remove-Item $tmpInstaller -Force -ErrorAction SilentlyContinue
}

# ============================================================
# Download Tessdata (language files)
# ============================================================
function Download-Tessdata {
    Write-Host ""
    Write-Host "[Tessdata] Downloading language data files..." -ForegroundColor Yellow

    $tessdataUrl = "https://github.com/tesseract-ocr/tessdata/raw/main"
    $langFiles = @(
        "eng.traineddata"
        "chi_sim.traineddata"
        "chi_tra.traineddata"
        "jpn.traineddata"
        "kor.traineddata"
        "spa.traineddata"
        "fra.traineddata"
        "deu.traineddata"
        "rus.traineddata"
        "vie.traineddata"
    )

    # First, try to copy from installed Tesseract
    $systemTessdata = "C:\Program Files\Tesseract-OCR\tessdata"
    if (Test-Path $systemTessdata) {
        Write-Host "  Copying from system Tesseract installation..."
        foreach ($lang in $langFiles) {
            $src = "$systemTessdata\$lang"
            $dest = "$BinariesDir\tessdata\$lang"
            if ((Test-Path $src) -and !(Test-Path $dest)) {
                Copy-Item $src $dest
                Write-Host "    Copied: $lang"
            }
        }
    }

    # Download any missing files
    foreach ($lang in $langFiles) {
        $output = "$BinariesDir\tessdata\$lang"
        if (Test-Path $output) {
            Write-Host "  $lang - already exists." -ForegroundColor Gray
            continue
        }

        $url = "$tessdataUrl/$lang"
        Write-Host "  $lang - downloading..."
        try {
            Invoke-WebRequest -Uri $url -OutFile $output
            Write-Host "    Done." -ForegroundColor Green
        } catch {
            Write-Host "    Failed to download $lang" -ForegroundColor Red
        }
    }
}

# ============================================================
# Main
# ============================================================

try {
    Download-FFmpeg
    Download-Tesseract
    Download-Tessdata

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  Download Complete!" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Binaries directory: $BinariesDir"
    Write-Host ""
    Write-Host "Contents:"
    Get-ChildItem "$BinariesDir\*" -File | ForEach-Object { 
        Write-Host "  $($_.Name) ($('{0:N1} MB' -f ($_.Length / 1MB)))"
    }
    Write-Host ""
    Get-ChildItem "$BinariesDir\tessdata\*" -File | ForEach-Object { 
        Write-Host "  tessdata\$($_.Name) ($('{0:N1} MB' -f ($_.Length / 1MB)))"
    }
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Run 'npm install' if you haven't yet"
    Write-Host "  2. Run 'npm run tauri dev' to start development"
    Write-Host "  3. Run 'npm run tauri build' to create a production build"
    Write-Host "     (binaries will be automatically bundled)"
} catch {
    Write-Host ""
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace
    exit 1
}
