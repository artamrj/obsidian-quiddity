import React, { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { App, MarkdownPostProcessorContext } from "obsidian";
import { formatTooltipDate, parseQuiddity, toDisplayDay } from "./parser";
import { toggleHabitDateInFile, toggleHabitDateInSource } from "./updater";
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

const SCROLL_POSITIONS = new Map<string, number>();

export function QuiddityRenderer({ app, ctx, el, source }: QuiddityRendererProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isWritingRef = useRef(false);
  const [currentSource, setCurrentSource] = useState(source);
  const parsed = useMemo(() => parseQuiddity(currentSource), [currentSource]);
  const rows = useMemo(() => buildHabitRows(parsed.config.habits, parsed.timeline), [parsed.config.habits, parsed.timeline]);
  const scrollKey = useMemo(() => getScrollKey(ctx, el), [ctx, el]);
  const gridStyle = useMemo(() => ({
    "--quiddity-days": parsed.timeline.length,
    gridTemplateColumns: `minmax(8.5rem, 11rem) repeat(${parsed.timeline.length}, var(--quiddity-cell-size))`
  }) as React.CSSProperties, [parsed.timeline.length]);

  useLayoutEffect(() => {
    const scrollLeft = SCROLL_POSITIONS.get(scrollKey);
    if (scrollLeft !== undefined && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollLeft;
    }
  }, [currentSource, scrollKey]);

  const handleToggle = useCallback(async (habit: Habit, date: string) => {
    if (isWritingRef.current) return;

    isWritingRef.current = true;
    cacheScroll(scrollKey, scrollRef.current);
    setCurrentSource((previous) => toggleHabitDateInSource(previous, habit.name, date));

    try {
      const changed = await toggleHabitDateInFile(app, ctx, el, habit.name, date);
      if (!changed) {
        setCurrentSource((previous) => toggleHabitDateInSource(previous, habit.name, date));
      }
    } catch (error) {
      setCurrentSource((previous) => toggleHabitDateInSource(previous, habit.name, date));
      throw error;
    } finally {
      cacheScroll(scrollKey, scrollRef.current);
      isWritingRef.current = false;
    }
  }, [app, ctx, el, scrollKey]);

  return (
    <section className="quiddity-root">
      <Diagnostics parsed={parsed} />
      <div
        className="quiddity-scroll"
        onScroll={() => cacheScroll(scrollKey, scrollRef.current)}
        ref={scrollRef}
      >
        <div className="quiddity-grid" style={gridStyle}>
          <DateHeader timeline={parsed.timeline} />
          {rows.map((row) => (
            <HabitRow
              key={row.habit.name}
              row={row}
              onToggle={handleToggle}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Diagnostics({ parsed }: { parsed: ParsedQuiddity }) {
  if (parsed.diagnostics.length === 0) return null;

  return (
    <div className="quiddity-diagnostics">
      {parsed.diagnostics.map((diagnostic, index) => (
        <div key={`${diagnostic.line}-${index}`}>Line {diagnostic.line}: {diagnostic.message}</div>
      ))}
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
  row,
  onToggle
}: {
  row: HabitRowView;
  onToggle: (habit: Habit, date: string) => Promise<void>;
}) {
  return (
    <>
      <div className="quiddity-habit-name">{row.habit.name}</div>
      {row.cells.map((cell) => (
        <HabitCell
          cell={cell}
          habit={row.habit}
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
  onToggle
}: {
  cell: StreakCell;
  habit: Habit;
  onToggle: (habit: Habit, date: string) => Promise<void>;
}) {
  const label = `${habit.name} · ${formatTooltipDate(cell.date)} · ${cell.active ? "done" : "empty"}`;

  return (
    <button
      aria-label={label}
      className={cellClass(cell)}
      onClick={() => {
        void onToggle(habit, cell.date);
      }}
      title={label}
      type="button"
    >
      {cell.active ? <span className="quiddity-mark">{cell.end ? cell.length : ""}</span> : null}
    </button>
  );
});

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

function cacheScroll(key: string, element: HTMLDivElement | null): void {
  if (element) SCROLL_POSITIONS.set(key, element.scrollLeft);
}

function getScrollKey(ctx: MarkdownPostProcessorContext, el: HTMLElement): string {
  const section = ctx.getSectionInfo(el);
  return section ? `${ctx.sourcePath}:${section.lineStart}:${section.lineEnd}` : ctx.sourcePath;
}
