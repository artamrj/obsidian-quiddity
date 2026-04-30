import type { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import { Notice } from "obsidian";
import { analyzeSource, parseQuiddity } from "./parser";
import { serializeEntries } from "./parser";

export function toggleHabitDateInSource(source: string, habitName: string, date: string): string {
  const document = analyzeSource(source);
  const parsed = parseQuiddity(source);
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const habitLine = document.habitLines.find((line) => line.name === habitName);
  const parsedHabit = parsed.config.habits.find((habit) => habit.name === habitName);

  if (!habitLine || !parsedHabit) return source;

  const entries = new Set(parsedHabit.entries);
  const nextEntries = entries.has(date)
    ? Array.from(entries).filter((entry) => entry !== date)
    : [...Array.from(entries), date];
  const prefix = habitLine.bullet ? `${habitLine.indent}- ${habitLine.name}: ` : `${habitLine.indent}${habitLine.name}: `;

  lines[habitLine.lineIndex] = `${prefix}${serializeEntries(nextEntries)}`;
  return lines.join("\n");
}

export async function toggleHabitDateInFile(
  app: App,
  ctx: MarkdownPostProcessorContext,
  el: HTMLElement,
  habitName: string,
  date: string
): Promise<boolean> {
  const section = ctx.getSectionInfo(el);
  const file = app.vault.getAbstractFileByPath(ctx.sourcePath);

  if (!section || !file || !isTFile(file)) {
    new Notice("Quiddity could not locate the source block.");
    return false;
  }

  const content = await app.vault.read(file);
  const lines = content.split("\n");
  const blockLines = lines.slice(section.lineStart + 1, section.lineEnd);
  const updatedBlock = toggleHabitDateInSource(blockLines.join("\n"), habitName, date);

  lines.splice(section.lineStart + 1, section.lineEnd - section.lineStart - 1, ...updatedBlock.split("\n"));
  await app.vault.modify(file, lines.join("\n"));
  return true;
}

export async function replaceQuiddityBlockInFile(
  app: App,
  ctx: MarkdownPostProcessorContext,
  el: HTMLElement,
  nextSource: string
): Promise<boolean> {
  const section = ctx.getSectionInfo(el);
  const file = app.vault.getAbstractFileByPath(ctx.sourcePath);

  if (!section || !file || !isTFile(file)) {
    new Notice("Quiddity could not locate the source block.");
    return false;
  }

  const content = await app.vault.read(file);
  const lines = content.split("\n");

  lines.splice(section.lineStart + 1, section.lineEnd - section.lineStart - 1, ...nextSource.split("\n"));
  await app.vault.modify(file, lines.join("\n"));
  return true;
}

function isTFile(file: unknown): file is TFile {
  return typeof file === "object" && file !== null && "extension" in file;
}
