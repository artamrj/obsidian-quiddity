import React, { memo, useCallback, useMemo, useState } from "react";
import type { App, MarkdownPostProcessorContext } from "obsidian";
import { MarkdownView, Notice, setIcon } from "obsidian";
import { formatTooltipDate, parseQuiddity, toDisplayDay } from "./parser";
import { replaceQuiddityBlockInFile, toggleHabitDateInSource } from "./updater";
import type { Habit, ParsedQuiddity } from "./types";

type QuiddityRendererProps = {
  app: App;
  ctx: MarkdownPostProcessorContext;
  el: HTMLElement;
  source: string;
};

type StreakCell = {
  date: string;
  active: boolean;
  start: boolean;
  end: boolean;
  length: number;
};

type HabitRowView = {
  habit: Habit;
  cells: StreakCell[];
};

export function QuiddityRenderer({ app, ctx, el, source }: QuiddityRendererProps) {
  const [currentSource, setCurrentSource] = useState(source);
  const [isSaving, setIsSaving] = useState(false);
  const parsed = useMemo(() => parseQuiddity(currentSource), [currentSource]);
  const rows = useMemo(() => buildHabitRows(parsed.config.habits, parsed.timeline), [parsed]);
  const gridStyle = useMemo<React.CSSProperties>(() => ({
    gridTemplateColumns: `minmax(8.5rem, 11rem) repeat(${parsed.timeline.length}, var(--quiddity-cell-size))`
  }), [parsed.timeline.length]);

  const handleToggle = useCallback(async (habit: Habit, date: string) => {
    if (isSaving) return;

    const previousSource = currentSource;
    const nextSource = toggleHabitDateInSource(previousSource, habit.name, date);
    if (nextSource === previousSource) return;

    setIsSaving(true);

    try {
      const changed = await replaceQuiddityBlockInFile(app, ctx, el, nextSource);
      if (changed) {
        setCurrentSource(nextSource);
      }
    } catch (error) {
      console.error("[Quiddity] Failed to update habit block.", error);
      new Notice("Quiddity could not save this habit change.");
    } finally {
      setIsSaving(false);
    }
  }, [app, ctx, currentSource, el, isSaving]);

  return (
    <section className={`quiddity-root${isSaving ? " is-saving" : ""}`}>
      <Diagnostics parsed={parsed} />
      <TrackerGrid
        gridStyle={gridStyle}
        isSaving={isSaving}
        onToggle={handleToggle}
        rows={rows}
        timeline={parsed.timeline}
      />
      <ActionBar app={app} ctx={ctx} el={el} />
    </section>
  );
}

function Diagnostics({ parsed }: { parsed: ParsedQuiddity }) {
  if (parsed.diagnostics.length === 0) return null;

  return (
    <div className="quiddity-diagnostics setting-item-description">
      {parsed.diagnostics.map((diagnostic, index) => (
        <div key={`${diagnostic.line}-${index}`}>Line {diagnostic.line}: {diagnostic.message}</div>
      ))}
    </div>
  );
}

function TrackerGrid({
  gridStyle,
  isSaving,
  onToggle,
  rows,
  timeline
}: {
  gridStyle: React.CSSProperties;
  isSaving: boolean;
  onToggle: (habit: Habit, date: string) => Promise<void>;
  rows: HabitRowView[];
  timeline: string[];
}) {
  return (
    <div className="quiddity-scroll">
      <div className="quiddity-grid" style={gridStyle}>
        <DateHeader timeline={timeline} />
        {rows.map((row) => (
          <HabitRow
            isSaving={isSaving}
            key={row.habit.name}
            onToggle={onToggle}
            row={row}
          />
        ))}
      </div>
    </div>
  );
}

function DateHeader({ timeline }: { timeline: string[] }) {
  return (
    <>
      <div className="quiddity-corner" />
      {timeline.map((date) => (
        <div className="quiddity-date" key={date} title={formatTooltipDate(date)}>{toDisplayDay(date)}</div>
      ))}
    </>
  );
}

const HabitRow = memo(function HabitRow({
  isSaving,
  onToggle,
  row
}: {
  isSaving: boolean;
  onToggle: (habit: Habit, date: string) => Promise<void>;
  row: HabitRowView;
}) {
  return (
    <>
      <div className="quiddity-habit-name">{row.habit.name}</div>
      {row.cells.map((cell) => (
        <HabitCell
          cell={cell}
          habit={row.habit}
          isSaving={isSaving}
          key={cell.date}
          onToggle={onToggle}
        />
      ))}
    </>
  );
});

const HabitCell = memo(function HabitCell({
  cell,
  habit,
  isSaving,
  onToggle
}: {
  cell: StreakCell;
  habit: Habit;
  isSaving: boolean;
  onToggle: (habit: Habit, date: string) => Promise<void>;
}) {
  const label = `${habit.name} - ${formatTooltipDate(cell.date)} - ${cell.active ? "done" : "empty"}`;

  return (
    <button
      aria-label={label}
      className={cellClass(cell)}
      disabled={isSaving}
      onClick={() => void onToggle(habit, cell.date)}
      title={label}
      type="button"
    >
      {cell.active ? <span className="quiddity-mark">{cell.end ? cell.length : ""}</span> : null}
    </button>
  );
});

function ActionBar({ app, ctx, el }: {
  app: App;
  ctx: MarkdownPostProcessorContext;
  el: HTMLElement;
}) {
  const setButtonRef = useCallback((button: HTMLButtonElement | null) => {
    if (button) setIcon(button, "code-2");
  }, []);

  return (
    <div className="quiddity-actions">
      <button
        aria-label="Reveal source block"
        className="clickable-icon"
        onClick={() => revealSourceBlock(app, ctx, el)}
        ref={setButtonRef}
        title="Reveal source block"
        type="button"
      />
    </div>
  );
}

function revealSourceBlock(app: App, ctx: MarkdownPostProcessorContext, el: HTMLElement): void {
  const section = ctx.getSectionInfo(el);
  const view = app.workspace.getActiveViewOfType(MarkdownView);

  if (!section || !view || view.file?.path !== ctx.sourcePath) {
    new Notice("Quiddity could not reveal the source block.");
    return;
  }

  const position = { line: section.lineStart + 1, ch: 0 };
  view.editor.setCursor(position);
  view.editor.scrollIntoView({ from: position, to: position }, true);
  view.editor.focus();
}

function buildHabitRows(habits: Habit[], timeline: string[]): HabitRowView[] {
  return habits.map((habit) => ({
    habit,
    cells: buildStreakCells(habit, timeline)
  }));
}

function buildStreakCells(habit: Habit, timeline: string[]): StreakCell[] {
  const done = new Set(habit.entries);
  const cells = timeline.map((date) => ({
    date,
    active: done.has(date),
    start: false,
    end: false,
    length: 0
  }));

  let index = 0;
  while (index < cells.length) {
    if (!cells[index].active) {
      index += 1;
      continue;
    }

    const start = index;
    while (index + 1 < cells.length && cells[index + 1].active) index += 1;
    const end = index;
    const length = end - start + 1;

    cells[start].start = true;
    cells[end].end = true;
    for (let cursor = start; cursor <= end; cursor += 1) {
      cells[cursor].length = length;
    }

    index += 1;
  }

  return cells;
}

function cellClass(cell: StreakCell): string {
  const classes = ["quiddity-cell"];
  if (cell.active) classes.push("is-active");
  if (cell.start) classes.push("is-start");
  if (cell.end) classes.push("is-end");
  if (cell.length === 1) classes.push("is-single");
  return classes.join(" ");
}
