import type { Habit, ParsedQuiddity, ParseDiagnostic, SourceDocument, SourceHabitLine, SourceMetaLine } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SUPPORTED_META_KEYS = new Set(["from", "days"]);

export function parseQuiddity(source: string, today = new Date()): ParsedQuiddity {
  const document = analyzeSource(source);
  const diagnostics: ParseDiagnostic[] = [];
  const meta = parseMeta(document.metaLines, diagnostics);
  const from = normalizeDate(meta.from ?? toDateKey(today)) ?? toDateKey(today);
  const days = Math.max(1, Number.parseInt(meta.days ?? "21", 10) || 21);
  const timeline = buildTimeline(from, days);
  const habits = document.habitLines.map((line) => parseHabitLine(line, diagnostics));

  if (document.habitLines.length === 0) {
    diagnostics.push({ line: 1, message: "Expected a canonical habits: block with habit entries." });
  }

  return {
    config: {
      from,
      days,
      habits
    },
    timeline,
    diagnostics
  };
}

export function analyzeSource(source: string): SourceDocument {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const habitsIndex = lines.findIndex((line) => line.trim() === "habits:");
  const metaLines: SourceMetaLine[] = [];
  const habitLines: SourceHabitLine[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "habits:") return;

    if (habitsIndex >= 0 && index > habitsIndex) {
      const habitMatch = line.match(/^(\s*)-\s+([^:]+):\s*(.*)$/);
      if (habitMatch) {
        habitLines.push({
          name: habitMatch[2].trim(),
          entriesText: habitMatch[3].trim(),
          lineIndex: index,
          indent: habitMatch[1]
        });
      }
      return;
    }

    const metaMatch = line.match(/^\s*([^:]+):\s*(.*)$/);
    if (metaMatch) {
      metaLines.push({
        key: metaMatch[1].trim(),
        value: metaMatch[2].trim(),
        lineIndex: index
      });
    }
  });

  return {
    source,
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

export function expandEntries(entriesText: string, diagnostics: ParseDiagnostic[] = [], line = 0): string[] {
  const dateSet = new Set<string>();
  const tokens = entriesText.split(",").map((part) => part.trim()).filter(Boolean);

  for (const token of tokens) {
    const expanded = expandToken(token);
    if (expanded.length === 0) {
      diagnostics.push({ line, message: `Could not parse entry "${token}". Use YYYY-MM-DD or YYYY-MM-DD..YYYY-MM-DD.` });
      continue;
    }

    expanded.forEach((date) => dateSet.add(date));
  }

  return Array.from(dateSet).sort(compareDateKeys);
}

export function serializeEntries(entries: string[]): string {
  const sorted = Array.from(new Set(entries.filter((entry) => normalizeDate(entry)))).sort(compareDateKeys);
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

function parseMeta(lines: SourceMetaLine[], diagnostics: ParseDiagnostic[]): Record<string, string> {
  const meta: Record<string, string> = {};

  for (const line of lines) {
    if (!SUPPORTED_META_KEYS.has(line.key)) {
      diagnostics.push({ line: line.lineIndex + 1, message: `Unsupported metadata key "${line.key}".` });
      continue;
    }

    meta[line.key] = line.value;
  }

  if (meta.from && !normalizeDate(meta.from)) {
    diagnostics.push({ line: findMetaLine(lines, "from"), message: "from must use YYYY-MM-DD." });
  }

  if (meta.days && (!/^\d+$/.test(meta.days) || Number.parseInt(meta.days, 10) < 1)) {
    diagnostics.push({ line: findMetaLine(lines, "days"), message: "days must be a positive whole number." });
  }

  return meta;
}

function findMetaLine(lines: SourceMetaLine[], key: string): number {
  return (lines.find((line) => line.key === key)?.lineIndex ?? 0) + 1;
}

function parseHabitLine(line: SourceHabitLine, diagnostics: ParseDiagnostic[]): Habit {
  return {
    name: line.name,
    entries: expandEntries(line.entriesText, diagnostics, line.lineIndex + 1)
  };
}

function expandToken(token: string): string[] {
  const rangeParts = token.split("..").map((part) => part.trim());

  if (rangeParts.length === 1) {
    const date = normalizeDate(rangeParts[0]);
    return date ? [date] : [];
  }

  if (rangeParts.length !== 2) return [];

  const start = normalizeDate(rangeParts[0]);
  const end = normalizeDate(rangeParts[1]);
  if (!start || !end || compareDateKeys(start, end) > 0) return [];

  return expandDateRange(start, end);
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

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function normalizeDate(value: string): string | null {
  if (!ISO_DATE.test(value)) return null;

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
