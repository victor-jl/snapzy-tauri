import React, { useCallback, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { formatDuration } from "../../utils/format";
import styles from "./TrimControls.module.css";

interface TrimControlsProps {
  trimStart: number;
  trimEnd: number;
  duration: number;
  currentTime: number;
  onSetInPoint: () => void;
  onSetOutPoint: () => void;
  onResetTrim: () => void;
  onTrimStartChange: (value: number) => void;
  onTrimEndChange: (value: number) => void;
}

function secondsToMMSSmmm(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 1000);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

function parseMMSSmmm(input: string): number | null {
  const match = input.match(/^(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const mins = parseInt(match[1], 10);
  const secs = parseInt(match[2], 10);
  const ms = match[3] ? parseInt(match[3].padEnd(3, "0"), 10) : 0;
  return mins * 60 + secs + ms / 1000;
}

const TrimControls: React.FC<TrimControlsProps> = ({
  trimStart,
  trimEnd,
  duration,
  currentTime,
  onSetInPoint,
  onSetOutPoint,
  onResetTrim,
  onTrimStartChange,
  onTrimEndChange,
}) => {
  const { t } = useTranslation();
  const [startInput, setStartInput] = useState(secondsToMMSSmmm(trimStart));
  const [endInput, setEndInput] = useState(secondsToMMSSmmm(trimEnd));
  const [snapToKeyframes, setSnapToKeyframes] = useState(false);

  // Sync input fields when trim values change externally
  useMemo(() => {
    setStartInput(secondsToMMSSmmm(trimStart));
  }, [trimStart]);

  useMemo(() => {
    setEndInput(secondsToMMSSmmm(trimEnd));
  }, [trimEnd]);

  const handleStartInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setStartInput(val);
      const parsed = parseMMSSmmm(val);
      if (parsed !== null && parsed >= 0 && parsed < trimEnd) {
        onTrimStartChange(parsed);
      }
    },
    [trimEnd, onTrimStartChange]
  );

  const handleStartInputBlur = useCallback(() => {
    setStartInput(secondsToMMSSmmm(trimStart));
  }, [trimStart]);

  const handleEndInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setEndInput(val);
      const parsed = parseMMSSmmm(val);
      if (parsed !== null && parsed > trimStart && parsed <= duration) {
        onTrimEndChange(parsed);
      }
    },
    [trimStart, duration, onTrimEndChange]
  );

  const handleEndInputBlur = useCallback(() => {
    setEndInput(secondsToMMSSmmm(trimEnd));
  }, [trimEnd]);

  const trimmedDuration = trimEnd - trimStart;

  return (
    <div className={styles.container}>
      <div className={styles.group}>
        <span className={styles.label}>{t("recording:cutStart")}</span>
        <input
          className={styles.input}
          type="text"
          value={startInput}
          onChange={handleStartInputChange}
          onBlur={handleStartInputBlur}
          placeholder="00:00.000"
        />
        <button
          className={styles.btn}
          onClick={onSetInPoint}
          title={t("recording:cutStart")}
        >
          {t("common:select")}
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.label}>{t("recording:cutEnd")}</span>
        <input
          className={styles.input}
          type="text"
          value={endInput}
          onChange={handleEndInputChange}
          onBlur={handleEndInputBlur}
          placeholder="00:00.000"
        />
        <button
          className={styles.btn}
          onClick={onSetOutPoint}
          title={t("recording:cutEnd")}
        >
          {t("common:select")}
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.label}>{t("recording:duration")}</span>
        <span className={styles.duration}>
          {formatDuration(trimmedDuration)}
        </span>
      </div>

      <div className={styles.divider} />

      <button className={styles.btnDanger} onClick={onResetTrim}>
        <RotateCcw size={12} />
        {t("common:reset")}
      </button>

      <div className={styles.divider} />

      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={snapToKeyframes}
          onChange={(e) => setSnapToKeyframes(e.target.checked)}
        />
        Snap to keyframes
      </label>
    </div>
  );
};

export default React.memo(TrimControls);
