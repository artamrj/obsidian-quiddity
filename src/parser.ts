import { TomlDate, parse as parseToml } from "smol-toml";
import type { Habit, ParsedQuiddity, ParseDiagnostic, SourceDocument, SourceHabitLine } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

type TomlRecord = Record<string, unknown>;

export function parseQuiddity(source: string, today = new Date()): ParsedQuiddity {
  const diagnostics: ParseDiagnostic[] = [];
  const document = parseTomlDocument(source, diagnostics);
  const from = readFrom(document.from, diagnostics, today);
  const days = readDays(document.days, diagnostics);
  const timeline = buildTimeline(from, days);
  const habits = readHabits(document.habits, diagnostics);

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
  return {
    source,
    habitLines: findHabitLines(source)
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

export function expandEntries(entries: string[], diagnostics: ParseDiagnostic[] = [], line = 0): string[] {
  const dateSet = new Set<string>();

  for (const entry of entries) {
    const expanded = expandToken(entry);
    if (expanded.length === 0) {
      diagnostics.push({ line, message: `Could not parse entry "${entry}". Use YYYY-MM-DD or YYYY-MM-DD..YYYY-MM-DD.` });
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

export function serializeEntriesArray(entries: string[]): string {
  const serialized = serializeEntries(entries);
  if (!serialized) return "[]";

  return `[${serialized.split(", ").map((entry) => JSON.stringify(entry)).join(", ")}]`;
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

function parseTomlDocument(source: string, diagnostics: ParseDiagnostic[]): TomlRecord {
  try {
    const document = parseToml(source);
    return isRecord(document) ? document : {};
  } catch (error) {
    diagnostics.push({
      line: getTomlErrorLine(error),
      message: `Invalid TOML: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`
    });
    return {};
  }
}

function readFrom(value: unknown, diagnostics: ParseDiagnostic[], today: Date): string {
  if (value === undefined) return toDateKey(today);

  const date = value instanceof TomlDate ? value.toISOString() : value;
  if (typeof date !== "string" || !normalizeDate(date)) {
    diagnostics.push({ line: 1, message: "from must be an ISO date or a string in YYYY-MM-DD format." });
    return toDateKey(today);
  }

  return date;
}

function readDays(value: unknown, diagnostics: ParseDiagnostic[]): number {
  if (value === undefined) return 21;

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    diagnostics.push({ line: 1, message: "days must be a positive integer." });
    return 21;
  }

  return value;
}

function readHabits(value: unknown, diagnostics: ParseDiagnostic[]): Habit[] {
  if (!Array.isArray(value)) {
    diagnostics.push({ line: 1, message: "habits must be an array of [name, entries] pairs." });
    return [];
  }

  return value.reduce<Habit[]>((habits, habit, index) => [
    ...habits,
    ...readHabit(habit, index, diagnostics)
  ], []);
}

function readHabit(value: unknown, index: number, diagnostics: ParseDiagnostic[]): Habit[] {
  const line = index + 1;

  if (!Array.isArray(value) || value.length !== 2) {
    diagnostics.push({ line, message: `Habit ${index + 1} must be [name, entries].` });
    return [];
  }

  const name: unknown = value[0];
  const entries: unknown = value[1];
  if (typeof name !== "string" || name.trim() === "") {
    diagnostics.push({ line, message: `Habit ${index + 1} must have a non-empty string name.` });
    return [];
  }

  if (!Array.isArray(entries)) {
    diagnostics.push({ line, message: `Habit "${name}" entries must be an array of strings.` });
    return [{ name, entries: [] }];
  }

  const stringEntries = entries.filter((entry): entry is string => typeof entry === "string");
  if (stringEntries.length !== entries.length) {
    diagnostics.push({ line, message: `Habit "${name}" entries must contain only strings.` });
  }

  return [{
    name,
    entries: expandEntries(stringEntries, diagnostics, line)
  }];
}

function findHabitLines(source: string): SourceHabitLine[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const habitsStart = lines.findIndex((line) => /^\s*habits\s*=/.test(line));
  if (habitsStart < 0) return [];

  const habitsEnd = findArrayEndLine(lines, habitsStart);
  const names = readSourceHabitNames(source);
  const result: SourceHabitLine[] = [];
  let habitIndex = 0;

  for (let index = habitsStart + 1; index <= habitsEnd; index += 1) {
    const line = lines[index];
    const match = line.match(/^(\s*)\[/);
    if (!match) continue;

    const lineEnd = findArrayItemEndLine(lines, index);
    const name = names[habitIndex] ?? readInlineHabitName(line);
    habitIndex += 1;
    if (!name) continue;

    result.push({
      name,
      lineStart: index,
      lineEnd,
      indent: match[1]
    });
    index = lineEnd;
  }

  return result;
}

function readSourceHabitNames(source: string): string[] {
  try {
    const document = parseToml(source);
    if (!isRecord(document)) return [];
    if (!Array.isArray(document.habits)) return [];

    return document.habits.reduce<string[]>((names, habit) => {
      if (!Array.isArray(habit) || typeof habit[0] !== "string") return [];
      return [...names, habit[0]];
    }, []);
  } catch {
    return [];
  }
}

function readInlineHabitName(line: string): string | null {
  const match = line.match(/^\s*\[\s*(["'])(.*?)\1\s*,/);
  return match?.[2] ?? null;
}

function findArrayItemEndLine(lines: string[], start: number): number {
  let balance = 0;

  for (let index = start; index < lines.length; index += 1) {
    for (const char of lines[index]) {
      if (char === "[") balance += 1;
      if (char === "]") balance -= 1;
    }

    if (balance <= 0) return index;
  }

  return start;
}

function findArrayEndLine(lines: string[], start: number): number {
  let balance = 0;

  for (let index = start; index < lines.length; index += 1) {
    for (const char of lines[index]) {
      if (char === "[") balance += 1;
      if (char === "]") balance -= 1;
    }

    if (balance <= 0) return index;
  }

  return start;
}

function getTomlErrorLine(error: unknown): number {
  if (isRecord(error) && typeof error.line === "number") return error.line;
  return 1;
}

function isRecord(value: unknown): value is TomlRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
