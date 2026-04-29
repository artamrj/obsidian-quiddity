import React, { useMemo, useState } from "react";
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
  active: boolean;
  start: boolean;
  end: boolean;
  length: number;
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

  async function handleToggle(habit: Habit, date: string) {
    const cellKey = `${habit.name}:${date}`;
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
      {parsed.config.title ? <h3 className="quiddity-title">{parsed.config.title}</h3> : null}
      {parsed.diagnostics.length > 0 ? <Diagnostics parsed={parsed} /> : null}
      <div className="quiddity-scroll">
        <div className="quiddity-grid" style={{ gridTemplateColumns: `minmax(12rem, 14rem) repeat(${parsed.timeline.length}, 2.35rem)` }}>
          <div className="quiddity-corner" />
          {parsed.timeline.map((date) => (
            <div className="quiddity-date" key={date}>{toDisplayDay(date)}</div>
          ))}

          {parsed.config.habits.map((habit) => {
            const streaks = buildStreakCells(habit, parsed.timeline);

            return (
              <React.Fragment key={habit.name}>
                <div className="quiddity-habit-name">{habit.name}</div>
                {parsed.timeline.map((date, index) => {
                  const cell = streaks[index];
                  const isPending = pendingCell === `${habit.name}:${date}`;
                  const label = `${habit.name} · ${formatTooltipDate(date)} · ${cell.active ? "done" : "empty"}`;

                  return (
                    <button
                      className={cellClass(cell, isPending)}
                      key={date}
                      title={label}
                      aria-label={label}
                      onClick={() => handleToggle(habit, date)}
                      type="button"
                    >
                      {cell.active ? <span className="quiddity-mark">{cell.end ? cell.length : ""}</span> : null}
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Diagnostics({ parsed }: { parsed: ParsedQuiddity }) {
  return (
    <div className="quiddity-diagnostics">
      {parsed.diagnostics.map((diagnostic, index) => (
        <div key={`${diagnostic.line}-${index}`}>Line {diagnostic.line}: {diagnostic.message}</div>
      ))}
    </div>
  );
}

function buildStreakCells(habit: Habit, timeline: string[]): StreakCell[] {
  const done = new Set(habit.entries);
  const cells = timeline.map((date) => ({
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
