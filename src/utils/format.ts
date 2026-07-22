import { format, formatDistanceToNow } from "date-fns";
import {
  enUS,
  zhCN,
  ja,
  ko,
  fr,
  de,
  es,
  ptBR,
  ru,
  vi,
} from "date-fns/locale";

const localeMap: Record<string, Locale> = {
  en: enUS,
  zh: zhCN,
  ja,
  ko,
  fr,
  de,
  es,
  pt: ptBR,
  ru,
  vi,
};

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const size = bytes / Math.pow(k, i);
  const decimals = i === 0 ? 0 : 2;

  return `${size.toFixed(decimals)} ${units[i]}`;
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const mm = mins.toString().padStart(2, "0");
  const ss = secs.toString().padStart(2, "0");

  if (hrs > 0) {
    return `${hrs}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function formatDate(
  date: Date | number,
  locale: string = "en"
): string {
  const fmtStr = "MMM d, yyyy HH:mm";
  try {
    const loc = localeMap[locale] ?? enUS;
    return format(date, fmtStr, { locale: loc });
  } catch {
    return format(date, fmtStr);
  }
}

export function formatTimeAgo(
  date: Date | number,
  locale: string = "en"
): string {
  try {
    const loc = localeMap[locale] ?? enUS;
    return formatDistanceToNow(date, { addSuffix: true, locale: loc });
  } catch {
    return formatDistanceToNow(date, { addSuffix: true });
  }
}

export function formatNumber(n: number, locale: string = "en"): string {
  try {
    return new Intl.NumberFormat(locale).format(n);
  } catch {
    return n.toLocaleString();
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
