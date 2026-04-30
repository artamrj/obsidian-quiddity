import React, { memo, useMemo, useState } from "react";
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
  accent: string;
  cells: StreakCell[];
};

const THEME_COLORS: Record<string, string> = {
  violet: "#a78bfa",
  blue: "#60a5fa",
  green: "#34d399"
};

export function QuiddityRenderer({ app, ctx, el, source }: QuiddityRendererProps) {
  const [currentSource, setCurrentSource] = useState(source);
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const parsed = useMemo(() => parseQuiddity(currentSource), [currentSource]);
  const accent = resolveTheme(parsed.config.theme);
  const rows = useMemo(() => buildHabitRows(parsed.config.habits, parsed.timeline, accent), [accent, parsed.config.habits, parsed.timeline]);
  const gridStyle = useMemo(() => ({
    "--quiddity-accent": accent,
    "--quiddity-days": parsed.timeline.length,
    gridTemplateColumns: `minmax(8.5rem, 11rem) repeat(${parsed.timeline.length}, var(--quiddity-cell-size))`
  }) as React.CSSProperties, [accent, parsed.timeline.length]);

  async function handleToggle(habit: Habit, date: string) {
    const cellKey = `${habit.name}:${date}`;
    if (pendingCell === cellKey) return;

    setPendingCell(cellKey);

    try {
      const changed = await toggleHabitDateInFile(app, ctx, el, habit.name, date);
      if (changed) {
        setCurrentSource((previous) => toggleHabitDateInSource(previous, habit.name, date));
      }
    } finally {
      setPendingCell(null);
    }
  }

  return (
    <section className="quiddity-root" style={{ "--quiddity-accent": accent } as React.CSSProperties}>
      <Header title={parsed.config.title} habits={rows.length} days={parsed.timeline.length} />
      <Diagnostics parsed={parsed} />
      <div className="quiddity-scroll">
        <div className="quiddity-grid" style={gridStyle}>
          <DateHeader timeline={parsed.timeline} />
          {rows.map((row) => (
            <HabitRow
              key={row.habit.name}
              pendingCell={pendingCell}
              row={row}
              onToggle={handleToggle}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Header({ title, habits, days }: { title?: string; habits: number; days: number }) {
  if (!title && habits === 0) return null;

  return (
    <div className="quiddity-header">
      {title ? <h3 className="quiddity-title">{title}</h3> : <span />}
      <div className="quiddity-meta">{habits} habits · {days} days</div>
    </div>
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
  pendingCell,
  onToggle
}: {
  row: HabitRowView;
  pendingCell: string | null;
  onToggle: (habit: Habit, date: string) => Promise<void>;
}) {
  return (
    <>
      <div className="quiddity-habit-name" style={{ "--quiddity-row-accent": row.accent } as React.CSSProperties}>{row.habit.name}</div>
      {row.cells.map((cell) => (
        <HabitCell
          cell={cell}
          habit={row.habit}
          isPending={pendingCell === `${row.habit.name}:${cell.date}`}
          key={cell.date}
          onToggle={onToggle}
          rowAccent={row.accent}
        />
      ))}
    </>
  );
});

const HabitCell = memo(function HabitCell({
  cell,
  habit,
  isPending,
  onToggle,
  rowAccent
}: {
  cell: StreakCell;
  habit: Habit;
  isPending: boolean;
  onToggle: (habit: Habit, date: string) => Promise<void>;
  rowAccent: string;
}) {
  const label = `${habit.name} · ${formatTooltipDate(cell.date)} · ${cell.active ? "done" : "empty"}`;

  return (
    <button
      aria-label={label}
      className={cellClass(cell, isPending)}
      disabled={isPending}
      onClick={() => {
        void onToggle(habit, cell.date);
      }}
      style={{ "--quiddity-row-accent": rowAccent } as React.CSSProperties}
      title={label}
      type="button"
    >
      {cell.active ? <span className="quiddity-mark">{cell.end ? cell.length : ""}</span> : null}
    </button>
  );
});

function buildHabitRows(habits: Habit[], timeline: string[], fallbackAccent: string): HabitRowView[] {
  return habits.map((habit) => ({
    habit,
    accent: habit.color ?? fallbackAccent,
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

function cellClass(cell: StreakCell, pending: boolean): string {
  const classes = ["quiddity-cell"];
  if (cell.active) classes.push("is-active");
  if (cell.start) classes.push("is-start");
  if (cell.end) classes.push("is-end");
  if (cell.length === 1) classes.push("is-single");
  if (pending) classes.push("is-pending");
  return classes.join(" ");
}

function resolveTheme(theme: string): string {
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(theme)) return theme;
  return THEME_COLORS[theme] ?? THEME_COLORS.violet;
}
