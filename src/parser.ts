import type { Habit, ParsedQuiddity, ParseDiagnostic, SourceDocument, SourceHabitLine } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

export function parseQuiddity(source: string, today = new Date()): ParsedQuiddity {
  const document = analyzeSource(source);
  const diagnostics: ParseDiagnostic[] = [];
  const meta = parseMeta(document.metaLines, diagnostics);
  const from = normalizeDate(meta.from ?? toDateKey(today)) ?? toDateKey(today);
  const days = Math.max(1, Number.parseInt(meta.days ?? "21", 10) || 21);
  const theme = meta.theme ?? "violet";
  const timeline = buildTimeline(from, days);
  const habits = document.habitLines.map((line) => parseHabitLine(line, timeline, diagnostics));

  return {
    config: {
      title: meta.title,
      from,
      days,
      theme,
      habits
    },
    timeline,
    diagnostics,
    sourceStyle: document.sourceStyle
  };
}

export function analyzeSource(source: string): SourceDocument {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const habitsIndex = lines.findIndex((line) => line.trim() === "habits:");
  const sourceStyle = habitsIndex >= 0 ? "habits-block" : "compact";
  const metaLines: string[] = [];
  const habitLines: SourceHabitLine[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "habits:") return;

    if (sourceStyle === "habits-block") {
      if (index < habitsIndex) {
        metaLines.push(line);
        return;
      }

      const match = line.match(/^(\s*)-\s+([^:]+):\s*(.*)$/);
      if (match) {
        habitLines.push({
          name: match[2].trim(),
          entriesText: match[3].trim(),
          lineIndex: index,
          indent: match[1],
          bullet: true
        });
      }
      return;
    }

    const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
    if (!match) return;

    const key = match[2].trim();
    if (isMetaKey(key)) {
      metaLines.push(line);
      return;
    }

    habitLines.push({
      name: key,
      entriesText: match[3].trim(),
      lineIndex: index,
      indent: match[1],
      bullet: false
    });
  });

  return {
    source,
    sourceStyle,
    metaLines,
    habitLines
  };
}

export function buildTimeline(from: string, days: number): string[] {
  const result: string[] = [];
  const start = parseDateKey(from);
  if (!start) return result;

  for (let offset = 0; offset < days; offset += 1) {
    result.push(addDays(start, offset));
  }

  return result;
}

export function expandEntries(entriesText: string, timeline: string[], diagnostics: ParseDiagnostic[] = [], line = 0): string[] {
  const dateSet = new Set<string>();
  const tokens = entriesText.split(",").map((part) => part.trim()).filter(Boolean);

  for (const token of tokens) {
    const expanded = expandToken(token, timeline);
    if (expanded.length === 0) {
      diagnostics.push({ line, message: `Could not parse entry "${token}".` });
      continue;
    }

    expanded.forEach((date) => dateSet.add(date));
  }

  return Array.from(dateSet).sort(compareDateKeys);
}

export function serializeEntries(entries: string[]): string {
  const sorted = Array.from(new Set(entries)).sort(compareDateKeys);
  const ranges: string[] = [];
  let index = 0;

  while (index < sorted.length) {
    const start = sorted[index];
    let end = start;

    while (index + 1 < sorted.length && diffDays(end, sorted[index + 1]) === 1) {
      index += 1;
      end = sorted[index];
    }

    ranges.push(start === end ? start : `${start}..${end}`);
    index += 1;
  }

  return ranges.join(", ");
}

export function toDisplayDay(dateKey: string): string {
  const parts = parseDateKey(dateKey);
  return parts ? String(parts.day) : "";
}

export function formatTooltipDate(dateKey: string): string {
  const parts = parseDateKey(dateKey);
  if (!parts) return dateKey;

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

function parseMeta(lines: string[], diagnostics: ParseDiagnostic[]): Record<string, string> {
  const meta: Record<string, string> = {};

  lines.forEach((line, index) => {
    const match = line.match(/^\s*([^:]+):\s*(.*)$/);
    if (!match) return;

    const key = match[1].trim();
    if (!isMetaKey(key)) {
      diagnostics.push({ line: index + 1, message: `Unknown metadata key "${key}".` });
      return;
    }

    meta[key] = match[2].trim();
  });

  return meta;
}

function parseHabitLine(line: SourceHabitLine, timeline: string[], diagnostics: ParseDiagnostic[]): Habit {
  const entries = expandEntries(line.entriesText, timeline, diagnostics, line.lineIndex + 1);
  const colorMatch = line.name.match(/^(.*?)\s+\[(#[0-9a-fA-F]{3,6})\]$/);

  if (colorMatch && HEX_COLOR.test(colorMatch[2])) {
    return {
      name: colorMatch[1].trim(),
      color: colorMatch[2],
      entries
    };
  }

  return {
    name: line.name,
    entries
  };
}

function expandToken(token: string, timeline: string[]): string[] {
  const rangeParts = token.split("..").map((part) => part.trim());

  if (rangeParts.length === 1) {
    const date = resolveDateToken(rangeParts[0], timeline);
    return date ? [date] : [];
  }

  if (rangeParts.length !== 2) return [];

  const start = resolveDateToken(rangeParts[0], timeline);
  if (!start) return [];

  if (/^\+\d+$/.test(rangeParts[1])) {
    const length = Number.parseInt(rangeParts[1].slice(1), 10);
    return expandDateRange(start, addDays(start, length - 1));
  }

  const end = resolveDateToken(rangeParts[1], timeline, start);
  if (!end || compareDateKeys(start, end) > 0) return [];

  return expandDateRange(start, end);
}

function resolveDateToken(token: string, timeline: string[], rangeStart?: string): string | null {
  if (ISO_DATE.test(token)) return normalizeDate(token);
  if (!/^\d{1,2}$/.test(token)) return null;

  const day = Number.parseInt(token, 10);
  const candidates = timeline.filter((date) => parseDateKey(date)?.day === day);
  if (candidates.length === 0) return null;
  if (!rangeStart) return candidates[0];

  const sameOrAfter = candidates.find((date) => compareDateKeys(date, rangeStart) >= 0);
  return sameOrAfter ?? candidates[0];
}

function expandDateRange(start: string, end: string): string[] {
  const result: string[] = [];
  let current = start;

  while (compareDateKeys(current, end) <= 0) {
    result.push(current);
    current = addDays(current, 1);
  }

  return result;
}

function isMetaKey(key: string): boolean {
  return ["title", "from", "days", "theme"].includes(key);
}

function normalizeDate(value: string): string | null {
  const parts = parseDateKey(value);
  return parts ? toDateKey(new Date(Date.UTC(parts.year, parts.month - 1, parts.day))) : null;
}

function parseDateKey(value: string): DateParts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return { year, month, day };
}

function addDays(dateKey: string | DateParts, offset: number): string {
  const parts = typeof dateKey === "string" ? parseDateKey(dateKey) : dateKey;
  if (!parts) return "";

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offset));
  return toDateKey(date);
}

function diffDays(start: string, end: string): number {
  const startParts = parseDateKey(start);
  const endParts = parseDateKey(end);
  if (!startParts || !endParts) return Number.NaN;

  const startTime = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const endTime = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  return Math.round((endTime - startTime) / 86400000);
}

function toDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}
