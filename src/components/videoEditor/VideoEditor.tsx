import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Save, X, Download, Scissors, Loader2,
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useHistoryStore } from "../../stores/historyStore";
import Timeline from "./Timeline";
import TrimControls from "./TrimControls";
import styles from "./VideoEditor.module.css";

interface VideoEditorProps {
  videoPath: string;
  onClose: () => void;
}

export type ExportFormat = "mp4" | "webm" | "gif";

const SPEED_OPTIONS = [0.5, 1, 1.5, 2];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

const VideoEditor: React.FC<VideoEditorProps> = ({ videoPath, onClose }) => {
  const { t } = useTranslation();
  const closeAll = useUIStore((s) => s.closeAll);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(1);

  // Derive playback range
  const playableStart = trimStart;
  const playableEnd = trimEnd > 0 ? trimEnd : duration;

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration;
    setDuration(d);
    setTrimEnd(d);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;
    setCurrentTime(t);

    // Enforce trim bounds during playback
    if (trimEnd > 0 && t >= trimEnd) {
      video.pause();
      video.currentTime = trimStart;
      setIsPlaying(false);
      setCurrentTime(trimStart);
    }

    // Capture preview frame
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        canvasRef.current.width = video.videoWidth || 320;
        canvasRef.current.height = video.videoHeight || 180;
        ctx.drawImage(video, 0, 0);
        setPreviewFrame(canvasRef.current.toDataURL("image/jpeg", 0.5));
      }
    }
  }, [trimEnd, trimStart]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
  }, [trimStart]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      // If at trim end, loop back to start
      if (trimEnd > 0 && video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
        setCurrentTime(trimStart);
      }
      video.play().catch(() => {
        // Autoplay blocked - ignore
      });
      setIsPlaying(true);
    }
  }, [isPlaying, trimEnd, trimStart]);

  const skipBack = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const newTime = Math.max(trimStart, video.currentTime - 5);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  }, [trimStart]);

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const limit = trimEnd > 0 ? trimEnd : duration;
    const newTime = Math.min(limit, video.currentTime + 5);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  }, [trimEnd, duration]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v;
    }
    if (v === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume || 1;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  }, [isMuted, volume]);

  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const s = parseFloat(e.target.value);
    setSpeed(s);
    if (videoRef.current) {
      videoRef.current.playbackRate = s;
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setInPoint = useCallback(() => {
    setTrimStart(currentTime);
    if (currentTime > trimEnd && trimEnd > 0) {
      setTrimEnd(Math.min(duration, currentTime + 1));
    }
  }, [currentTime, trimEnd, duration]);

  const setOutPoint = useCallback(() => {
    setTrimEnd(Math.max(currentTime, trimStart + 0.1));
  }, [currentTime, trimStart]);

  const resetTrim = useCallback(() => {
    setTrimStart(0);
    setTrimEnd(duration);
  }, [duration]);

  const handleTimelineZoom = useCallback((newZoom: number) => {
    setTimelineZoom(Math.max(0.5, Math.min(10, newZoom)));
  }, []);

  const handleExport = useCallback(async (_format: ExportFormat) => {
    setShowExport(false);
    setIsExporting(true);
    // In a real implementation this would invoke a Tauri command
    // to run ffmpeg or similar with trimStart/trimEnd
    try {
      // Simulate export delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // const result = await invoke("export_video", {
      //   path: videoPath,
      //   format,
      //   trimStart,
      //   trimEnd: trimEnd > 0 ? trimEnd : duration,
      // });
    } finally {
      setIsExporting(false);
    }
  }, [videoPath, trimStart, trimEnd, duration]);

  const handleSave = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleCancel = useCallback(() => {
    closeAll();
    onClose();
  }, [closeAll, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (videoRef.current) {
            const newTime = Math.max(trimStart, videoRef.current.currentTime - (1 / 30));
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (videoRef.current) {
            const limit = trimEnd > 0 ? trimEnd : duration;
            const newTime = Math.min(limit, videoRef.current.currentTime + (1 / 30));
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
          }
          break;
        case "i":
        case "I":
          setInPoint();
          break;
        case "o":
        case "O":
          setOutPoint();
          break;
        case "Escape":
          handleCancel();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, trimStart, trimEnd, duration, setInPoint, setOutPoint, handleCancel]);

  const displayStart = useMemo(
    () => formatTime(trimStart),
    [trimStart]
  );
  const displayCurrent = useMemo(
    () => formatTime(currentTime),
    [currentTime]
  );
  const displayEnd = useMemo(
    () => formatTime(trimEnd > 0 ? trimEnd : duration),
    [trimEnd, duration]
  );

  return (
    <div className={styles.overlay}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Scissors size={18} />
          <span className={styles.headerTitle}>{t("recording:trim")}</span>
          {isExporting && (
            <Loader2 size={16} className={styles.exportingSpinner} />
          )}
        </div>
        <div className={styles.headerRight}>
          <button className={styles.btnSecondary} onClick={handleCancel}>
            <X size={15} />
            {t("common:cancel")}
          </button>
          <button
            className={styles.btnDanger}
            onClick={handleCancel}
          >
            {t("recording:discard")}
          </button>
          <button
            className={styles.btnPrimary}
            onClick={() => setShowExport(true)}
            disabled={isExporting}
          >
            <Download size={15} />
            {t("annotate:export")}
          </button>
          <button className={styles.btnPrimary} onClick={handleSave}>
            <Save size={15} />
            {t("common:save")}
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className={styles.previewArea}>
        <video
          ref={videoRef}
          className={styles.video}
          src={videoPath}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onClick={togglePlay}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {!videoPath && (
          <div className={styles.previewImage}>
            {previewFrame ? (
              <img src={previewFrame} alt="Preview" />
            ) : (
              <span>{t("common:loading")}</span>
            )}
          </div>
        )}
      </div>

      {/* Trimming Controls */}
      <TrimControls
        trimStart={trimStart}
        trimEnd={trimEnd > 0 ? trimEnd : duration}
        duration={duration}
        currentTime={currentTime}
        onSetInPoint={setInPoint}
        onSetOutPoint={setOutPoint}
        onResetTrim={resetTrim}
        onTrimStartChange={setTrimStart}
        onTrimEndChange={setTrimEnd}
      />

      {/* Playback Controls */}
      <div className={styles.controlsBar}>
        <div className={styles.controlGroup}>
          <button className={styles.controlBtn} onClick={skipBack} title="-5s">
            <SkipBack size={16} />
          </button>
          <button
            className={`${styles.controlBtn} ${styles.playBtn}`}
            onClick={togglePlay}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className={styles.controlBtn} onClick={skipForward} title="+5s">
            <SkipForward size={16} />
          </button>
        </div>

        <div className={styles.timeDisplay}>
          {displayCurrent}
          <span className={styles.timeSeparator}>/</span>
          {displayEnd}
        </div>

        <div className={styles.divider} />

        <div className={styles.controlGroup}>
          <button
            className={styles.volumeBtn}
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <input
            type="range"
            className={styles.volumeSlider}
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
          />
        </div>

        <div className={styles.divider} />

        <select
          className={styles.speedSelect}
          value={speed}
          onChange={handleSpeedChange}
        >
          {SPEED_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>

        <div className={styles.divider} />

        <span className={styles.timeDisplay} style={{ minWidth: "auto" }}>
          {t("recording:trim")}: {displayStart} - {displayEnd}
        </span>
      </div>

      {/* Timeline */}
      <Timeline
        duration={duration}
        currentTime={currentTime}
        trimStart={trimStart}
        trimEnd={trimEnd > 0 ? trimEnd : duration}
        zoom={timelineZoom}
        videoRef={videoRef}
        onSeek={handleSeek}
        onZoomChange={handleTimelineZoom}
      />

      {/* Export Modal */}
      {showExport && (
        <div
          className={styles.exportOverlay}
          onClick={() => setShowExport(false)}
        >
          <div
            className={styles.exportModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.exportTitle}>
              {t("annotate:exportAs")}
            </div>
            <div className={styles.exportOptions}>
              {(["mp4", "webm", "gif"] as ExportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  className={styles.exportOption}
                  onClick={() => handleExport(fmt)}
                >
                  <Download size={16} />
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
            <div className={styles.exportOptionsFooter}>
              <button
                className={styles.btnSecondary}
                onClick={() => setShowExport(false)}
              >
                {t("common:cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(VideoEditor);
