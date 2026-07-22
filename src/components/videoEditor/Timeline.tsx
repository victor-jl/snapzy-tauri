import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import styles from "./Timeline.module.css";

interface TimelineProps {
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  zoom: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  onSeek: (time: number) => void;
  onZoomChange: (zoom: number) => void;
}

const PIXELS_PER_SECOND_BASE = 60;

const Timeline: React.FC<TimelineProps> = ({
  duration,
  currentTime,
  trimStart,
  trimEnd,
  zoom,
  videoRef,
  onSeek,
  onZoomChange,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isDraggingTrimStart, setIsDraggingTrimStart] = useState(false);
  const [isDraggingTrimEnd, setIsDraggingTrimEnd] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollStartRef = useRef({ x: 0, scrollLeft: 0 });
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  const pixelsPerSecond = PIXELS_PER_SECOND_BASE * zoom;
  const totalWidth = duration * pixelsPerSecond;

  // Generate thumbnails from video
  useEffect(() => {
    const video = videoRef?.current;
    if (!video || !duration) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const thumbWidth = 80;
    const thumbHeight = 50;
    canvas.width = thumbWidth;
    canvas.height = thumbHeight;

    // Generate a thumbnail every 2 seconds (or fewer for longer videos)
    const interval = duration > 60 ? 2 : 1;
    const count = Math.min(Math.ceil(duration / interval), 60);
    const thumbs: string[] = [];

    const generateThumbnail = (time: number): Promise<string> => {
      return new Promise((resolve) => {
        const handleSeeked = () => {
          ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
          resolve(canvas.toDataURL("image/jpeg", 0.4));
          video.removeEventListener("seeked", handleSeeked);
        };
        video.addEventListener("seeked", handleSeeked);
        video.currentTime = time;
      });
    };

    const generateAll = async () => {
      const originalTime = video.currentTime;
      for (let i = 0; i < count; i++) {
        const t = i * interval;
        try {
          const dataUrl = await generateThumbnail(t);
          thumbs.push(dataUrl);
        } catch {
          // Skip failed thumbnails
        }
      }
      setThumbnails(thumbs);
      // Restore original time
      if (video) {
        video.currentTime = originalTime;
      }
    };

    generateAll();
  }, [videoRef, duration]);

  // Compute ruler ticks
  const rulerTicks = useMemo(() => {
    const ticks: { position: number; label: string; major: boolean }[] = [];
    if (!duration) return ticks;

    // Determine tick interval based on zoom and duration
    const intervals = [0.5, 1, 2, 5, 10, 30, 60];
    let interval = 1;
    for (const intv of intervals) {
      if (totalWidth / (duration / intv) > 20) {
        interval = intv;
        break;
      }
    }
    if (totalWidth / (duration / interval) < 15) {
      interval = intervals[Math.min(intervals.length - 1, intervals.indexOf(interval) + 1)];
    }

    const minorInterval = interval / 4;

    for (let t = 0; t <= duration; t += minorInterval) {
      const isMajor = Math.abs(t % interval) < 0.001 || Math.abs(t % interval - interval) < 0.001;
      ticks.push({
        position: t * pixelsPerSecond,
        label: isMajor ? formatTimeLabel(t) : "",
        major: isMajor,
      });
    }
    return ticks;
  }, [duration, totalWidth, pixelsPerSecond]);

  // --- Playhead drag ---
  const handlePlayheadMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDraggingPlayhead(true);

      const handleMouseMove = (ev: MouseEvent) => {
        const rect = scrollRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = ev.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
        const time = Math.max(0, Math.min(duration, x / pixelsPerSecond));
        onSeek(time);
      };

      const handleMouseUp = () => {
        setIsDraggingPlayhead(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [duration, pixelsPerSecond, onSeek]
  );

  // --- Trim Start drag ---
  const handleTrimStartMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDraggingTrimStart(true);
      const trimStartPos = trimStart * pixelsPerSecond;

      const handleMouseMove = (ev: MouseEvent) => {
        const rect = scrollRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = ev.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
        const time = Math.max(0, Math.min(trimEnd - 0.1, x / pixelsPerSecond));
        onSeek(time);
      };

      const handleMouseUp = () => {
        setIsDraggingTrimStart(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [trimStart, trimEnd, pixelsPerSecond, onSeek]
  );

  // --- Trim End drag ---
  const handleTrimEndMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDraggingTrimEnd(true);

      const handleMouseMove = (ev: MouseEvent) => {
        const rect = scrollRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = ev.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
        const time = Math.max(trimStart + 0.1, Math.min(duration, x / pixelsPerSecond));
        onSeek(time);
      };

      const handleMouseUp = () => {
        setIsDraggingTrimEnd(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [trimStart, duration, pixelsPerSecond, onSeek]
  );

  // --- Scroll drag ---
  const handleScrollMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === scrollRef.current || (e.target as HTMLElement).closest(`.${styles.clickOverlay}`)) {
        setIsScrolling(true);
        scrollStartRef.current = {
          x: e.clientX,
          scrollLeft: scrollRef.current?.scrollLeft ?? 0,
        };

        const handleMouseMove = (ev: MouseEvent) => {
          const dx = ev.clientX - scrollStartRef.current.x;
          if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollStartRef.current.scrollLeft - dx;
          }
        };

        const handleMouseUp = () => {
          setIsScrolling(false);
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
      }
    },
    []
  );

  // --- Click to seek ---
  const handleClickSeek = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingPlayhead || isDraggingTrimStart || isDraggingTrimEnd || isScrolling) return;
      const rect = scrollRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
      const time = Math.max(0, Math.min(duration, x / pixelsPerSecond));
      onSeek(time);
    },
    [duration, pixelsPerSecond, onSeek, isDraggingPlayhead, isDraggingTrimStart, isDraggingTrimEnd, isScrolling]
  );

  // --- Wheel zoom ---
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      onZoomChange(zoom + delta);
    },
    [zoom, onZoomChange]
  );

  const playheadPos = currentTime * pixelsPerSecond;
  const trimStartPos = trimStart * pixelsPerSecond;
  const trimEndPos = trimEnd * pixelsPerSecond;
  const selectedWidth = trimEndPos - trimStartPos;

  return (
    <div className={styles.timelineContainer}>
      {/* Ruler */}
      <div className={styles.ruler}>
        {rulerTicks.map((tick, i) => (
          <React.Fragment key={i}>
            <div
              className={tick.major ? styles.rulerTickMajor : styles.rulerTickMinor}
              style={{ left: tick.position }}
            />
            {tick.major && tick.label && (
              <span className={styles.rulerLabel} style={{ left: tick.position }}>
                {tick.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Scrollable Track */}
      <div
        ref={scrollRef}
        className={styles.timelineScroll}
        onMouseDown={handleScrollMouseDown}
        onWheel={handleWheel}
      >
        <div className={styles.timelineInner} style={{ width: totalWidth }}>
          {/* Thumbnails */}
          <div className={styles.thumbnailTrack}>
            {thumbnails.map((src, i) => {
              const interval = duration > 60 ? 2 : 1;
              const pos = i * interval * pixelsPerSecond;
              const thumbWidth = 80;
              return (
                <img
                  key={i}
                  className={styles.thumbnail}
                  src={src}
                  alt=""
                  style={{
                    left: pos,
                    width: thumbWidth,
                  }}
                />
              );
            })}
          </div>

          {/* Selected Region */}
          <div
            className={styles.selectedRegion}
            style={{
              left: trimStartPos,
              width: selectedWidth,
            }}
          />

          {/* Trim Start Handle */}
          <div
            className={styles.trimHandleLeft}
            style={{ left: trimStartPos - 4 }}
            onMouseDown={handleTrimStartMouseDown}
          />

          {/* Trim End Handle */}
          <div
            className={styles.trimHandleRight}
            style={{ left: trimEndPos - 4 }}
            onMouseDown={handleTrimEndMouseDown}
          />

          {/* Click to seek */}
          <div className={styles.clickOverlay} onClick={handleClickSeek} />

          {/* Playhead */}
          <div
            className={styles.playhead}
            style={{ left: playheadPos }}
          />
          <div
            className={styles.playheadTriangle}
            style={{ left: playheadPos }}
            onMouseDown={handlePlayheadMouseDown}
          />
        </div>
      </div>

      {/* Zoom Controls */}
      <div className={styles.zoomControls}>
        <button
          className={styles.zoomBtn}
          onClick={() => onZoomChange(zoom - 0.5)}
          title="Zoom Out"
        >
          <ZoomOut size={12} />
        </button>
        <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
        <button
          className={styles.zoomBtn}
          onClick={() => onZoomChange(zoom + 0.5)}
          title="Zoom In"
        >
          <ZoomIn size={12} />
        </button>
      </div>
    </div>
  );
};

function formatTimeLabel(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return `${secs}s`;
}

export default React.memo(Timeline);
